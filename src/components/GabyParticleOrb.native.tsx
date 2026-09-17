import React, { useEffect, useRef, useState } from 'react';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { Emotion, EMOTION_META, OrbState } from './gabyOrbShared';

interface Props {
  state: OrbState;
  emotion: Emotion;
  size: number;
  /** Se incrementa en cada límite de palabra real del habla — ver useSpeak.onBoundary. */
  talkPulse?: number;
}

/**
 * El mismo orbe de Gaby, dibujado para el teléfono.
 *
 * La versión de al lado (GabyParticleOrb.tsx) usa Three.js, que necesita un
 * <canvas> y WebGL del DOM: nada de eso existe en React Native. Importarla aquí
 * no solo no funcionaba, sino que cerraba la app al abrirla, porque Three.js
 * falla al cargarse bajo Hermes. Metro elige este archivo en iOS y Android por
 * el sufijo .native, así que Three.js ni siquiera entra en el paquete del
 * teléfono.
 *
 * Aquí los puntos se proyectan a mano sobre un SVG. Para que siga siendo fluido,
 * no se dibuja un círculo por punto (serían 150 elementos nuevos por cuadro):
 * los puntos se agrupan por profundidad en unas pocas capas, y cada capa es un
 * solo <Path> con todos sus círculos dentro.
 */

const POINT_COUNT = 150;
/** Grupos de profundidad. Más capas = degradado más fino, pero más elementos. */
const CAPAS = 6;
const DURACION_PULSO = 1.25;
const CUADROS_POR_SEGUNDO = 30;

interface Punto {
  x: number;
  y: number;
  z: number;
}

/** Distribución pareja de puntos sobre una esfera (algoritmo de Fibonacci). */
function esferaFibonacci(count: number): Punto[] {
  const pts: Punto[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r });
  }
  return pts;
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

function aRgb(hex: string): [number, number, number] {
  const limpio = hex.replace('#', '');
  const n = parseInt(
    limpio.length === 3
      ? limpio
          .split('')
          .map((c) => c + c)
          .join('')
      : limpio,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mezclar(a: string, b: string, t: number): string {
  const [r1, g1, b1] = aRgb(a);
  const [r2, g2, b2] = aRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${c(r1, r2)},${c(g1, g2)},${c(b1, b2)})`;
}

/** Velocidad de giro según lo que Gaby esté haciendo, en radianes por segundo. */
const VELOCIDAD: Record<OrbState, number> = {
  idle: 0.18,
  listening: 0.34,
  thinking: 0.8,
  speaking: 0.3,
};

interface Capa {
  d: string;
  color: string;
  opacity: number;
}

/** Un círculo como comando de path, para poder meter muchos en un solo <Path>. */
function circuloPath(cx: number, cy: number, r: number): string {
  const x = (cx - r).toFixed(2);
  const y = cy.toFixed(2);
  const d = (r * 2).toFixed(2);
  return `M${x} ${y}a${r.toFixed(2)},${r.toFixed(2)} 0 1,0 ${d},0a${r.toFixed(2)},${r.toFixed(2)} 0 1,0 -${d},0`;
}

export default function GabyParticleOrb({ state, emotion, size, talkPulse = 0 }: Props) {
  const puntos = useRef<Punto[]>();
  if (!puntos.current) puntos.current = esferaFibonacci(POINT_COUNT);

  const inicio = useRef(Date.now()).current;
  /** Instante (en segundos desde `inicio`) en que arrancó cada onda viva. */
  const pulsos = useRef<number[]>([]);
  const [capas, setCapas] = useState<Capa[]>([]);

  const estadoRef = useRef(state);
  const emocionRef = useRef(emotion);
  estadoRef.current = state;
  emocionRef.current = emotion;

  useEffect(() => {
    // talkPulse arranca en 0 y sube con cada palabra; el 0 inicial no es habla.
    if (talkPulse > 0) pulsos.current.push((Date.now() - inicio) / 1000);
  }, [talkPulse, inicio]);

  useEffect(() => {
    let vivo = true;
    let handle = 0;
    let ultimoDibujo = 0;

    const dibujar = () => {
      if (!vivo) return;
      handle = requestAnimationFrame(dibujar);

      const ahora = Date.now();
      if (ahora - ultimoDibujo < 1000 / CUADROS_POR_SEGUNDO) return;
      ultimoDibujo = ahora;

      const t = (ahora - inicio) / 1000;
      pulsos.current = pulsos.current.filter((p) => t - p <= DURACION_PULSO);

      const meta = EMOTION_META[emocionRef.current];
      const [colorA, colorB] = meta.colors;
      const respiro = 1 + 0.025 * Math.sin((t * 2 * Math.PI * 1000) / meta.speed);

      const ang = t * VELOCIDAD[estadoRef.current];
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);
      // Ladeo fijo del eje, para que la esfera no se vea de perfil plano.
      const cosI = Math.cos(0.32);
      const sinI = Math.sin(0.32);

      const trozos: string[][] = Array.from({ length: CAPAS + 1 }, () => []);

      for (const p of puntos.current!) {
        let amp = 0;
        for (const inicioPulso of pulsos.current) amp += ondaPulso(t - inicioPulso, p.y);
        amp = Math.min(1, amp);

        const x = p.x * cosA + p.z * sinA;
        const zGiro = -p.x * sinA + p.z * cosA;
        const y = p.y * cosI - zGiro * sinI;
        const z = p.y * sinI + zGiro * cosI;

        // La onda empuja los puntos hacia afuera al pasar por su latitud.
        const radio = 33 * respiro * (1 + 0.16 * amp);
        // Perspectiva suave: lo de adelante un poco más grande que lo de atrás.
        const persp = 1 / (1 - z * 0.22);
        const cx = 50 + x * radio * persp;
        const cy = 50 - y * radio * persp;

        const profundidad = (z + 1) / 2;
        const capa =
          amp > 0.2 ? CAPAS : Math.min(CAPAS - 1, Math.max(0, Math.floor(profundidad * CAPAS)));
        const r = capa === CAPAS ? 1.9 : 0.5 + 1.15 * ((capa + 0.5) / CAPAS);
        trozos[capa].push(circuloPath(cx, cy, r));
      }

      const nuevas: Capa[] = [];
      for (let capa = 0; capa <= CAPAS; capa++) {
        if (!trozos[capa].length) continue;
        const f = capa === CAPAS ? 1 : (capa + 0.5) / CAPAS;
        nuevas.push({
          d: trozos[capa].join(''),
          // Los puntos de atrás tiran al color secundario; los de adelante, al
          // principal. Los que lleva la onda salen casi blancos, que es lo que
          // hace visible el pulso al hablar.
          color: capa === CAPAS ? mezclar(colorA, '#FFFFFF', 0.65) : mezclar(colorB, colorA, f),
          opacity: capa === CAPAS ? 1 : 0.18 + 0.72 * f,
        });
      }
      setCapas(nuevas);
    };

    handle = requestAnimationFrame(dibujar);
    return () => {
      vivo = false;
      cancelAnimationFrame(handle);
    };
  }, [inicio]);

  const [colorA] = EMOTION_META[emotion].colors;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="gabyHalo" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colorA} stopOpacity="0.30" />
          <Stop offset="0.55" stopColor={colorA} stopOpacity="0.10" />
          <Stop offset="1" stopColor={colorA} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={50} cy={50} r={49} fill="url(#gabyHalo)" />
      {capas.map((capa, i) => (
        <Path key={i} d={capa.d} fill={capa.color} opacity={capa.opacity} />
      ))}
    </Svg>
  );
}
