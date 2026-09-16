import React, { useEffect, useRef } from 'react';
import { Emotion, EMOTION_META, OrbState } from './gabyOrbShared';

interface Props {
  state: OrbState;
  emotion: Emotion;
  size: number;
}

// Espacio virtual en el que se generan los puntos (independiente del tamaño real
// en pantalla) — luego se escala a `size` al dibujar.
const BASE = 200;
const CENTER = BASE / 2;

interface Point {
  baseX: number;
  baseY: number;
  radius: number;
  isEye: boolean;
  isMouth: boolean;
  glow: number; // intensidad relativa del brillo (0..1)
  phase: number; // fase del "flotar" individual, para que no se muevan todos igual
  freq: number;
  amp: number;
}

interface Edge {
  a: number;
  b: number;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Genera la nube de puntos que forma el rostro: silueta de la cabeza, relleno
 * interior disperso, ojos (más brillantes) y una línea de boca. */
function generatePoints(): Point[] {
  const points: Point[] = [];

  // Silueta de la cabeza: elipse con algo de ruido para que no se vea perfecta.
  const SIL_COUNT = 46;
  for (let i = 0; i < SIL_COUNT; i++) {
    const angle = (i / SIL_COUNT) * Math.PI * 2;
    const rx = 62 + rand(-2.5, 2.5);
    const ry = 80 + rand(-2.5, 2.5);
    points.push({
      baseX: CENTER + Math.cos(angle) * rx,
      baseY: CENTER + Math.sin(angle) * ry,
      radius: 1.3,
      isEye: false,
      isMouth: false,
      glow: 0.5,
      phase: rand(0, Math.PI * 2),
      freq: rand(0.5, 1.1),
      amp: rand(0.6, 1.4),
    });
  }

  // Relleno interior: puntos dispersos dentro de la elipse (rechazo simple para
  // que no queden pegados entre sí).
  const inside: Point[] = [];
  let attempts = 0;
  while (inside.length < 110 && attempts < 4000) {
    attempts++;
    const x = rand(CENTER - 58, CENTER + 58);
    const y = rand(CENTER - 74, CENTER + 74);
    const nx = (x - CENTER) / 58;
    const ny = (y - CENTER) / 74;
    if (nx * nx + ny * ny > 0.82) continue; // fuera del óvalo (deja margen con la silueta)
    const tooClose = inside.some((p) => {
      const dx = p.baseX - x;
      const dy = p.baseY - y;
      return dx * dx + dy * dy < 8 * 8;
    });
    if (tooClose) continue;
    inside.push({
      baseX: x,
      baseY: y,
      radius: rand(0.7, 1.3),
      isEye: false,
      isMouth: false,
      glow: rand(0.25, 0.5),
      phase: rand(0, Math.PI * 2),
      freq: rand(0.4, 1.2),
      amp: rand(0.5, 1.6),
    });
  }
  points.push(...inside);

  // Ojos: un puñado de puntos por ojo, con uno más grande/brillante al centro.
  for (const ex of [CENTER - 22, CENTER + 22]) {
    for (let i = 0; i < 5; i++) {
      const isCore = i === 0;
      const a = (i / 5) * Math.PI * 2;
      const r = isCore ? 0 : 4;
      points.push({
        baseX: ex + Math.cos(a) * r,
        baseY: CENTER - 8 + Math.sin(a) * r,
        radius: isCore ? 2.6 : 1,
        isEye: true,
        isMouth: false,
        glow: isCore ? 1 : 0.6,
        phase: rand(0, Math.PI * 2),
        freq: rand(0.8, 1.4),
        amp: rand(0.3, 0.7),
      });
    }
  }

  // Boca: arco de puntos, se anima al "hablar" y se curva un poco según la emoción.
  const MOUTH_COUNT = 7;
  for (let i = 0; i < MOUTH_COUNT; i++) {
    const t = i / (MOUTH_COUNT - 1);
    points.push({
      baseX: CENTER - 20 + t * 40,
      baseY: CENTER + 42,
      radius: 1.1,
      isEye: false,
      isMouth: true,
      glow: 0.55,
      phase: rand(0, Math.PI * 2),
      freq: rand(0.6, 1),
      amp: rand(0.4, 0.9),
    });
  }

  // Puente de la nariz: una mini línea vertical, le da algo de estructura central.
  for (let i = 0; i < 4; i++) {
    points.push({
      baseX: CENTER + rand(-1.5, 1.5),
      baseY: CENTER + 2 + i * 8,
      radius: 0.9,
      isEye: false,
      isMouth: false,
      glow: 0.35,
      phase: rand(0, Math.PI * 2),
      freq: rand(0.5, 1),
      amp: rand(0.3, 0.8),
    });
  }

  return points;
}

/** Conecta cada punto con sus vecinos más cercanos (hasta MAX_NEIGHBORS, dentro de
 * MAX_DIST) — así se arma la "red" de líneas sin volverse una maraña sólida. */
function generateEdges(points: Point[]): Edge[] {
  const MAX_DIST = 26;
  const MAX_NEIGHBORS = 4;
  const edgeSet = new Set<string>();
  const edges: Edge[] = [];

  for (let i = 0; i < points.length; i++) {
    const distances: { j: number; d: number }[] = [];
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      const dx = points[i].baseX - points[j].baseX;
      const dy = points[i].baseY - points[j].baseY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= MAX_DIST) distances.push({ j, d });
    }
    distances.sort((a, b) => a.d - b.d);
    for (const { j } of distances.slice(0, MAX_NEIGHBORS)) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      edges.push({ a: Math.min(i, j), b: Math.max(i, j) });
    }
  }

  return edges;
}

/**
 * Rostro de Gaby como una malla de partículas: puntos brillantes conectados por
 * líneas finas, con resplandor (glow) vía canvas — inspirado en visualizaciones de
 * "red neuronal" holográfica. Solo corre en web (usa <canvas> del DOM).
 */
export default function GabyParticleFace({ state, emotion, size }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointsRef = useRef<Point[]>();
  const edgesRef = useRef<Edge[]>();
  const rafRef = useRef<number>();
  const startRef = useRef(Date.now());
  const stateRef = useRef(state);
  const emotionRef = useRef(emotion);
  stateRef.current = state;
  emotionRef.current = emotion;

  if (!pointsRef.current) {
    pointsRef.current = generatePoints();
    edgesRef.current = generateEdges(pointsRef.current);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const scale = (size / BASE) * dpr;

    const points = pointsRef.current!;
    const edges = edgesRef.current!;

    const draw = () => {
      const t = (Date.now() - startRef.current) / 1000;
      const meta = EMOTION_META[emotionRef.current];
      const [colorA, colorB] = meta.colors;
      const pulse = 0.55 + 0.45 * Math.sin((t * 2 * Math.PI) / (meta.speed / 1000));
      const speaking = stateRef.current === 'speaking';
      const thinking = stateRef.current === 'thinking';
      const mouthCurve = emotionRef.current === 'feliz' ? -3 : emotionRef.current === 'tristeza' ? 3 : 0;
      const jitterScale = thinking ? 1.8 : 1;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(scale, scale);

      const pos = (p: Point): { x: number; y: number } => {
        let x = p.baseX + Math.sin(t * p.freq + p.phase) * p.amp * jitterScale;
        let y = p.baseY + Math.cos(t * p.freq * 0.8 + p.phase) * p.amp * jitterScale;
        if (p.isMouth) {
          y += mouthCurve;
          if (speaking) y += Math.sin(t * 14 + p.phase) * 3.5;
        }
        return { x, y };
      };

      // Líneas primero, para que los puntos queden encima.
      ctx.lineWidth = 0.5;
      for (const e of edges) {
        const pa = pos(points[e.a]);
        const pb = pos(points[e.b]);
        const dx = pa.x - pb.x;
        const dy = pa.y - pb.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const opacity = Math.max(0, 1 - dist / 26) * 0.35 * pulse;
        if (opacity <= 0.01) continue;
        ctx.strokeStyle = colorA;
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }

      // Puntos, con resplandor vía shadowBlur (fake bloom, barato en canvas 2D).
      ctx.globalAlpha = 1;
      for (const p of points) {
        const { x, y } = pos(p);
        const glowBoost = p.isEye ? 1 : pulse;
        ctx.shadowBlur = (p.isEye ? 10 : 5) * glowBoost;
        ctx.shadowColor = p.isEye ? colorB : colorA;
        ctx.fillStyle = p.isEye ? '#EAFBFF' : colorA;
        ctx.globalAlpha = Math.min(1, p.glow * (0.7 + 0.3 * pulse));
        ctx.beginPath();
        ctx.arc(x, y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [size]);

  return (
    // 'canvas' va directo al DOM vía ReactDOM (no pasa por el flattening de estilos
    // de React Native Web) — por eso el style es un objeto plano, no un array como en RN.
    <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block' }} />
  );
}
