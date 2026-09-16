import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, VRM } from '@pixiv/three-vrm';
import { Emotion, EMOTION_META, OrbState } from './gabyOrbShared';

interface Props {
  state: OrbState;
  emotion: Emotion;
  size: number;
  /**
   * URL pública a un archivo .vrm. Sin esto se muestra un marcador de posición
   * (una figura simple girando) — no se incluye ningún avatar de terceros aquí
   * porque los modelos VRM de muestra tienen licencias propias (ej. "VRM Public
   * License") que no cubren redistribuirlos dentro de esta app. Consigue el tuyo
   * gratis en VRoid Studio (https://vroid.com/studio) —lo creas tú, es tuyo— o
   * cómpralo con licencia de redistribución, y pásalo aquí.
   */
  modelUrl?: string;
  /** Voltea el modelo 180° en Y — algunos VRM 0.x quedan mirando "hacia atrás". */
  flip?: boolean;
  /** Se incrementa en cada límite de palabra real del habla (ver useSpeak.onBoundary) —
   * abre/cierra la boca en sync con el audio real en vez de una onda genérica. Si no
   * llegan pulsos recientes mientras `state === 'speaking'`, cae a la onda genérica. */
  talkPulse?: number;
}

/**
 * Rostro de Gaby como un avatar VRM real (Three.js + @pixiv/three-vrm), inspirado
 * en cómo Scowld (github.com/apoorvdarshan/scowld) renderiza su personaje animado.
 * Solo corre en web por ahora (usa un <canvas> del DOM con un WebGLRenderer) — la
 * versión para iOS nativo (WebView embebido, como hace Scowld con Swift) es el
 * siguiente paso, una vez que se confirme que este visor se ve bien.
 */
export default function GabyVrmFace({ state, emotion, size, modelUrl, flip = true, talkPulse = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const vrmRef = useRef<VRM | null>(null);
  const stateRef = useRef(state);
  const emotionRef = useRef(emotion);
  const talkPulseRef = useRef(talkPulse);
  stateRef.current = state;
  emotionRef.current = emotion;
  talkPulseRef.current = talkPulse;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 20);
    camera.position.set(0, 1.38, 1.1);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(dpr);
    renderer.setSize(size, size, false);

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(0.6, 1.6, 1.2);
    scene.add(dirLight);

    // Marcador de posición mientras no haya un modelo VRM configurado (o mientras
    // termina de cargar uno): un icosaedro simple con el color de la emoción.
    const placeholderColor = new THREE.Color(EMOTION_META[emotion].colors[0]);
    const placeholder = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.22, 1),
      new THREE.MeshStandardMaterial({ color: placeholderColor, wireframe: true }),
    );
    placeholder.position.set(0, 1.4, 0);
    scene.add(placeholder);

    let disposed = false;

    if (modelUrl) {
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));
      loader.load(
        modelUrl,
        (gltf) => {
          if (disposed) return;
          const vrm = gltf.userData.vrm as VRM;
          VRMUtils.removeUnnecessaryVertices(gltf.scene);
          VRMUtils.removeUnnecessaryJoints(gltf.scene);
          if (flip) vrm.scene.rotation.y = Math.PI;
          scene.remove(placeholder);
          scene.add(vrm.scene);
          vrmRef.current = vrm;
        },
        undefined,
        (error) => {
          console.error('No se pudo cargar el modelo VRM:', error);
        },
      );
    }

    const clock = new THREE.Clock();
    let rafId: number;
    let blinkAt = 2 + Math.random() * 2;
    let lastSeenPulse = talkPulseRef.current;
    let lastPulseTime = -10;

    const animate = () => {
      const delta = clock.getDelta();
      const t = clock.getElapsedTime();
      const vrm = vrmRef.current;

      if (talkPulseRef.current !== lastSeenPulse) {
        lastSeenPulse = talkPulseRef.current;
        lastPulseTime = t;
      }

      if (vrm) {
        // Parpadeo cada tanto, y boca hablando cuando el estado es "speaking".
        blinkAt -= delta;
        if (blinkAt <= 0) {
          blinkAt = 2.5 + Math.random() * 2.5;
        }
        const blink = blinkAt > 2.5 - 0.12 ? 0 : Math.max(0, 1 - Math.abs(blinkAt - 1.2) * 6);
        vrm.expressionManager?.setValue('blink', blink);
        if (stateRef.current === 'speaking') {
          const sinceBoundary = t - lastPulseTime;
          // Si llegaron límites de palabra recientes, la boca "aplaude" en sync con
          // cada uno (lip-sync real); si no (voz/navegador que no los reporta), cae
          // a una onda genérica para que igual se vea que está hablando.
          const mouth =
            sinceBoundary < 0.6
              ? Math.max(0, 1 - sinceBoundary / 0.32) * 0.75
              : Math.max(0, Math.sin(t * 12)) * 0.6;
          vrm.expressionManager?.setValue('aa', mouth);
        } else {
          vrm.expressionManager?.setValue('aa', 0);
        }
        vrm.scene.position.y = Math.sin(t * 0.9) * 0.01;
        vrm.update(delta);
      } else {
        placeholder.rotation.y += delta * 0.6;
        placeholder.rotation.x += delta * 0.25;
        placeholder.material.color.set(EMOTION_META[emotionRef.current].colors[0]);
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrl, flip, size]);

  return (
    // 'canvas' va directo al DOM vía ReactDOM — el style debe ser un objeto plano.
    <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block' }} />
  );
}
