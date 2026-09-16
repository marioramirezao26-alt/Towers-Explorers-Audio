import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Emotion, EMOTION_META, OrbState } from './gabyOrbShared';

interface Props {
  state: OrbState;
  emotion: Emotion;
  size: number;
  /** Se incrementa en cada límite de palabra real del habla — ver useSpeak.onBoundary. */
  talkPulse?: number;
}

interface PointSpec {
  x: number;
  y: number;
  z: number;
  isEye: boolean;
  isMouth: boolean;
  size: number;
  brightness: number;
}

// Dimensiones de la "cabeza" en unidades de mundo — más angosta que alta, con algo
// de profundidad real (no es un plano) para que se vea como un busto 3D de verdad
// al rotar, como la referencia.
const RX = 0.55;
const RY = 0.78;
const RZ = 0.62;

/** Distribución pareja de puntos sobre una esfera (algoritmo de Fibonacci), luego
 * escalada a la elipsoide de la cabeza — da una nube de puntos con volumen real. */
function fibonacciSphere(count: number): { x: number; y: number; z: number }[] {
  const points: { x: number; y: number; z: number }[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2;
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    points.push({ x: Math.cos(theta) * radiusAtY, y, z: Math.sin(theta) * radiusAtY });
  }
  return points;
}

function buildPoints(): PointSpec[] {
  const points: PointSpec[] = [];

  // Volumen general de la cabeza.
  for (const p of fibonacciSphere(230)) {
    points.push({
      x: p.x * RX,
      y: p.y * RY,
      z: p.z * RZ,
      isEye: false,
      isMouth: false,
      size: 0.014 + Math.random() * 0.01,
      brightness: 0.4 + Math.random() * 0.3,
    });
  }

  // Contorno frontal (silueta) más denso, justo al borde visible de frente — refuerza
  // el óvalo de la cara como en la referencia.
  const CONTOUR_COUNT = 46;
  for (let i = 0; i < CONTOUR_COUNT; i++) {
    const a = (i / CONTOUR_COUNT) * Math.PI * 2;
    points.push({
      x: Math.cos(a) * RX * (0.94 + Math.random() * 0.05),
      y: Math.sin(a) * RY * (0.94 + Math.random() * 0.05),
      z: RZ * (0.55 + Math.random() * 0.08),
      isEye: false,
      isMouth: false,
      size: 0.016,
      brightness: 0.55,
    });
  }

  // Ojos: puntos brillantes, ligeramente al frente de la superficie.
  for (const ex of [-0.32, 0.32]) {
    for (let i = 0; i < 6; i++) {
      const isCore = i === 0;
      const a = (i / 6) * Math.PI * 2;
      const r = isCore ? 0 : 0.045;
      points.push({
        x: ex * RX + Math.cos(a) * r,
        y: 0.08 * RY + Math.sin(a) * r,
        z: RZ * 0.98,
        isEye: true,
        isMouth: false,
        size: isCore ? 0.03 : 0.016,
        brightness: isCore ? 1 : 0.7,
      });
    }
  }

  // Puente de la nariz, protruyendo un poco hacia adelante.
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    points.push({
      x: (Math.random() - 0.5) * 0.02,
      y: 0.05 * RY - t * 0.28 * RY,
      z: RZ * (0.98 + t * 0.06),
      isEye: false,
      isMouth: false,
      size: 0.014,
      brightness: 0.5,
    });
  }

  // Boca: arco de puntos, se anima al hablar.
  const MOUTH_COUNT = 8;
  for (let i = 0; i < MOUTH_COUNT; i++) {
    const t = i / (MOUTH_COUNT - 1) - 0.5;
    points.push({
      x: t * 0.42 * RX,
      y: -0.42 * RY,
      z: RZ * 0.95,
      isEye: false,
      isMouth: true,
      size: 0.016,
      brightness: 0.6,
    });
  }

  return points;
}

interface Edge {
  a: number;
  b: number;
}

function buildEdges(points: PointSpec[]): Edge[] {
  const MAX_DIST = 0.16;
  const MAX_NEIGHBORS = 4;
  const seen = new Set<string>();
  const edges: Edge[] = [];

  for (let i = 0; i < points.length; i++) {
    const candidates: { j: number; d: number }[] = [];
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const dz = points[i].z - points[j].z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d <= MAX_DIST) candidates.push({ j, d });
    }
    candidates.sort((a, b) => a.d - b.d);
    for (const { j } of candidates.slice(0, MAX_NEIGHBORS)) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ a: Math.min(i, j), b: Math.max(i, j) });
    }
  }
  return edges;
}

/**
 * Rostro de Gaby como una nube de partículas 3D real (Three.js), con resplandor
 * (bloom) de verdad — a diferencia de una versión plana en 2D, esta sí tiene
 * profundidad y se ve como un busto real al girar, como la referencia que pidió
 * el usuario (cabeza translúcida de puntos y líneas brillantes).
 */
export default function GabyParticleFace({ state, emotion, size, talkPulse = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  const emotionRef = useRef(emotion);
  const talkPulseRef = useRef(talkPulse);
  stateRef.current = state;
  emotionRef.current = emotion;
  talkPulseRef.current = talkPulse;

  const pointsSpecRef = useRef<PointSpec[]>();
  const edgesRef = useRef<Edge[]>();
  if (!pointsSpecRef.current) {
    pointsSpecRef.current = buildPoints();
    edgesRef.current = buildEdges(pointsSpecRef.current);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const specs = pointsSpecRef.current!;
    const edges = edgesRef.current!;
    const mouthIndices = specs.map((p, i) => (p.isMouth ? i : -1)).filter((i) => i >= 0);

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
    camera.position.set(0, 0, 1.9);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: false });
    renderer.setPixelRatio(dpr);
    renderer.setSize(size, size, false);
    renderer.setClearColor(0x000000, 0);

    const group = new THREE.Group();
    scene.add(group);

    // Puntos.
    const positions = new Float32Array(specs.length * 3);
    const colors = new Float32Array(specs.length * 3);
    const sizes = new Float32Array(specs.length);
    const baseColor = new THREE.Color(EMOTION_META[emotion].colors[0]);
    const eyeColor = new THREE.Color('#EAFBFF');
    specs.forEach((p, i) => {
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      const c = p.isEye ? eyeColor : baseColor;
      colors[i * 3] = c.r * p.brightness;
      colors[i * 3 + 1] = c.g * p.brightness;
      colors[i * 3 + 2] = c.b * p.brightness;
      sizes[i] = p.size;
    });

    const pointsGeometry = new THREE.BufferGeometry();
    pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pointsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const pointsMaterial = new THREE.PointsMaterial({
      size: 0.022,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pointCloud = new THREE.Points(pointsGeometry, pointsMaterial);
    group.add(pointCloud);

    // Líneas entre puntos cercanos.
    const linePositions = new Float32Array(edges.length * 2 * 3);
    edges.forEach((e, i) => {
      linePositions[i * 6] = specs[e.a].x;
      linePositions[i * 6 + 1] = specs[e.a].y;
      linePositions[i * 6 + 2] = specs[e.a].z;
      linePositions[i * 6 + 3] = specs[e.b].x;
      linePositions[i * 6 + 4] = specs[e.b].y;
      linePositions[i * 6 + 5] = specs[e.b].z;
    });
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    group.add(lines);

    // Resplandor (bloom) real — sin esto, los puntos brillantes no "sangran" luz
    // hacia afuera como en la referencia.
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(dpr);
    composer.setSize(size, size);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(size * dpr, size * dpr), 1.1, 0.55, 0.1);
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    const clock = new THREE.Clock();
    let rafId: number;
    let lastSeenPulse = talkPulseRef.current;
    let lastPulseTime = -10;

    const animate = () => {
      const delta = clock.getDelta();
      const t = clock.getElapsedTime();
      const meta = EMOTION_META[emotionRef.current];
      const pulse = 0.5 + 0.5 * Math.sin((t * 2 * Math.PI) / (meta.speed / 1000));

      if (talkPulseRef.current !== lastSeenPulse) {
        lastSeenPulse = talkPulseRef.current;
        lastPulseTime = t;
      }

      // Giro ambiental suave (efecto "vivo"), como si mirara alrededor.
      group.rotation.y = Math.sin(t * 0.35) * 0.32;
      group.rotation.x = Math.sin(t * 0.5) * 0.06;
      group.scale.setScalar(0.97 + pulse * 0.04);

      // Boca: reacciona a los límites de palabra reales si llegan, si no cae a una
      // onda genérica mientras habla.
      const speaking = stateRef.current === 'speaking';
      const sinceBoundary = t - lastPulseTime;
      const mouthOpen = !speaking
        ? 0
        : sinceBoundary < 0.6
        ? Math.max(0, 1 - sinceBoundary / 0.32)
        : Math.max(0, Math.sin(t * 12));
      const colorAttr = pointsGeometry.getAttribute('color') as THREE.BufferAttribute;
      const posAttr = pointsGeometry.getAttribute('position') as THREE.BufferAttribute;
      for (const idx of mouthIndices) {
        const base = specs[idx];
        posAttr.setY(idx, base.y - mouthOpen * 0.05);
        const boost = 1 + mouthOpen * 0.8;
        colorAttr.setXYZ(idx, baseColor.r * base.brightness * boost, baseColor.g * base.brightness * boost, baseColor.b * base.brightness * boost);
      }
      posAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;

      lineMaterial.color.set(EMOTION_META[emotionRef.current].colors[0]);

      composer.render();
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      pointsGeometry.dispose();
      pointsMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      composer.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  return (
    // 'canvas' va directo al DOM vía ReactDOM — el style debe ser un objeto plano.
    <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block' }} />
  );
}
