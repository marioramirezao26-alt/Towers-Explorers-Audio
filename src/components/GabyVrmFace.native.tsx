import React from 'react';
import GabyParticleOrb from './GabyParticleOrb';
import { Emotion, OrbState } from './gabyOrbShared';

interface Props {
  state: OrbState;
  emotion: Emotion;
  size: number;
  modelUrl: string;
  talkPulse?: number;
}

/**
 * El avatar VRM es solo para web: @pixiv/three-vrm y Three.js necesitan WebGL
 * del DOM, que en React Native no existe, y cargarlos aquí cerraba la app al
 * abrirla. Metro elige este archivo en iOS y Android por el sufijo .native, de
 * modo que esas librerías no entran en el paquete del teléfono.
 *
 * En la práctica no se llega a dibujar (GabyOrb solo usa el avatar VRM en web),
 * pero devuelve el orbe en vez de null para que, si algún día se usa, Gaby siga
 * apareciendo en lugar de dejar un hueco.
 */
export default function GabyVrmFace({ state, emotion, size, talkPulse }: Props) {
  return <GabyParticleOrb state={state} emotion={emotion} size={size} talkPulse={talkPulse} />;
}
