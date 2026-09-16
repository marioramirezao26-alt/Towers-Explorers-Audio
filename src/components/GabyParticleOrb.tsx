import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Emotion, EMOTION_META, OrbState } from './gabyOrbShared';

interface Props {
  state: OrbState;
  emotion: Emotion;
  size: number;
  /** Se incrementa en cada límite de palabra real del habla — ver useSpeak.onBoundary. */
  talkPulse?: number;
}

const R = 1.0;
const POINT_COUNT = 420;
const MAX_DIST = 0.26;
const MAX_NEIGHBORS = 3;
const DURACION_PULSO = 1.25;

/** Distribución pareja de puntos sobre una esfera (algoritmo de Fibonacci). */
function esferaFibonacci(count: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    pts.push(new THREE.Vector3(Math.cos(th) * r * R, y * R, Math.sin(th) * r * R));
  }
  return pts;
}

function construirAristas(pts: THREE.Vector3[]): [number, number][] {
  const aristas: [number, number][] = [];
  const vistos = new Set<string>();
  for (let i = 0; i < pts.length; i++) {
    const cand: { j: number; d: number }[] = [];
    for (let j = 0; j < pts.length; j++) {
      if (i === j) continue;
      const d = pts[i].distanceTo(pts[j]);
      if (d <= MAX_DIST) cand.push({ j, d });
    }
    cand.sort((a, b) => a.d - b.d);
    for (const { j } of cand.slice(0, MAX_NEIGHBORS)) {
      const k = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (vistos.has(k)) continue;
      vistos.add(k);
      aristas.push([Math.min(i, j), Math.max(i, j)]);
    }
  }
  return aristas;
}

/** El halo suave de cada punto es lo que da la sensación de luz. */
function texturaResplandor(): THREE.Texture {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0.0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.16, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.42, 'rgba(255,255,255,0.25)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Onda que recorre el orbe: 0 antes de llegar, sube y baja al pasar. */
function ondaPulso(edad: number, latitud: number): number {
  if (edad < 0 || edad > DURACION_PULSO) return 0;
  const avance = edad / DURACION_PULSO;
  const frente = avance * 2.2 - 0.6;
  const distancia = Math.abs(latitud - frente);
  const ancho = 0.42;
  if (distancia > ancho) return 0;
  const forma = Math.cos((distancia / ancho) * (Math.PI / 2));
  return forma * forma * (1 - avance);
}

/**
 * Gaby: un orbe de partículas que emite un pulso por cada palabra que habla y
 * cambia de color según su estado de ánimo. Mismo lenguaje visual que el ícono
 * de la app iOS y que su visor nativo
 * (ios-native/Scowld/Resources/amica.bundle/index.html), para que se vea igual
 * en los dos lados.
 *
 * El resplandor sale de sprites con degradado radial y mezcla aditiva, en vez
 * de una cadena de postprocesado: se ve prácticamente igual y pesa mucho menos.
 */
export default function GabyParticleOrb({ state, emotion, size, talkPulse = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  const emotionRef = useRef(emotion);
  const talkPulseRef = useRef(talkPulse);
  stateRef.current = state;
  emotionRef.current = emotion;
  talkPulseRef.current = talkPulse;

  const puntosRef = useRef<THREE.Vector3[]>();
  const aristasRef = useRef<[number, number][]>();
  if (!puntosRef.current) {
    puntosRef.current = esferaFibonacci(POINT_COUNT);
    aristasRef.current = construirAristas(puntosRef.current);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const base = puntosRef.current!;
    const aristas = aristasRef.current!;

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    const mitadFov = THREE.MathUtils.degToRad(camera.fov) / 2;
    const tan = Math.tan(mitadFov);
    camera.position.z = (R * 1.3) / tan;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(dpr);
    renderer.setSize(size, size, false);
    renderer.setClearColor(0x000000, 0);

    const grupo = new THREE.Group();
    scene.add(grupo);

    const colorBase = new THREE.Color(EMOTION_META[emotion].colors[0]);
    const colorClaro = new THREE.Color('#EAFBFF');

    const posiciones = new Float32Array(POINT_COUNT * 3);
    const colores = new Float32Array(POINT_COUNT * 3);
    const tamanos = new Float32Array(POINT_COUNT);
    const tamanoBase = new Float32Array(POINT_COUNT);
    base.forEach((p, i) => {
      posiciones[i * 3] = p.x;
      posiciones[i * 3 + 1] = p.y;
      posiciones[i * 3 + 2] = p.z;
      tamanoBase[i] = 0.03 + Math.random() * 0.012;
      tamanos[i] = tamanoBase[i];
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colores, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(tamanos, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: texturaResplandor() },
        uScale: { value: ((size * dpr) / (2 * tan)) * 1.6 },
      },
      vertexShader: `
        attribute float aSize;
        uniform float uScale;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        varying vec3 vColor;
        void main() {
          gl_FragColor = vec4(vColor, 1.0) * texture2D(uTexture, gl_PointCoord);
        }
      `,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    grupo.add(new THREE.Points(geo, material));

    const posLineas = new Float32Array(aristas.length * 6);
    const geoLineas = new THREE.BufferGeometry();
    geoLineas.setAttribute('position', new THREE.BufferAttribute(posLineas, 3));
    const materialLineas = new THREE.LineBasicMaterial({
      color: colorBase,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    grupo.add(new THREE.LineSegments(geoLineas, materialLineas));

    const reloj = new THREE.Clock();
    const v = new THREE.Vector3();
    let pulsos: number[] = [];
    let ultimoPulsoVisto = talkPulseRef.current;
    let rafId: number;

    const animar = () => {
      const t = reloj.getElapsedTime();
      const meta = EMOTION_META[emotionRef.current];
      const respiracion = 0.5 + 0.5 * Math.sin((t * 2 * Math.PI) / (meta.speed / 1000));

      if (talkPulseRef.current !== ultimoPulsoVisto) {
        ultimoPulsoVisto = talkPulseRef.current;
        pulsos.push(t);
      }
      pulsos = pulsos.filter((inicio) => t - inicio <= DURACION_PULSO);

      colorBase.set(meta.colors[0]);
      materialLineas.color.set(meta.colors[0]);

      grupo.rotation.y = t * 0.16;
      grupo.rotation.x = Math.sin(t * 0.4) * 0.12;

      const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
      const colorAttr = geo.getAttribute('color') as THREE.BufferAttribute;
      const sizeAttr = geo.getAttribute('aSize') as THREE.BufferAttribute;

      for (let i = 0; i < POINT_COUNT; i++) {
        const p = base[i];
        const latitud = (p.y / R + 1) / 2;

        let energia = 0;
        for (const inicio of pulsos) energia += ondaPulso(t - inicio, latitud);
        energia = Math.min(energia, 1.6);

        // El pulso empuja cada punto hacia afuera y lo enciende: el frente de
        // onda se lee como luz recorriendo el orbe.
        v.copy(p).multiplyScalar(1 + energia * 0.22 + respiracion * 0.015);
        posAttr.setXYZ(i, v.x, v.y, v.z);

        const brillo = 0.55 + respiracion * 0.12 + energia * 0.9;
        const c = colorBase.clone().lerp(colorClaro, Math.min(energia * 0.8, 0.9));
        colorAttr.setXYZ(i, c.r * brillo, c.g * brillo, c.b * brillo);

        sizeAttr.setX(i, tamanoBase[i] * (1 + energia * 0.55));
      }
      posAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;

      for (let e = 0; e < aristas.length; e++) {
        const [a, b] = aristas[e];
        posLineas[e * 6] = posAttr.getX(a);
        posLineas[e * 6 + 1] = posAttr.getY(a);
        posLineas[e * 6 + 2] = posAttr.getZ(a);
        posLineas[e * 6 + 3] = posAttr.getX(b);
        posLineas[e * 6 + 4] = posAttr.getY(b);
        posLineas[e * 6 + 5] = posAttr.getZ(b);
      }
      geoLineas.getAttribute('position').needsUpdate = true;
      materialLineas.opacity =
        0.18 + (stateRef.current === 'speaking' ? 0.14 : 0) + respiracion * 0.05;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animar);
    };
    rafId = requestAnimationFrame(animar);

    return () => {
      cancelAnimationFrame(rafId);
      geo.dispose();
      material.dispose();
      geoLineas.dispose();
      materialLineas.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  return (
    // 'canvas' va directo al DOM vía ReactDOM — el style debe ser un objeto plano.
    <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block' }} />
  );
}
