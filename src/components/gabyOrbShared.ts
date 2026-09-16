import { colors } from '@/theme';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';
export type Emotion = 'neutral' | 'feliz' | 'enojo' | 'tristeza' | 'mareado' | 'confundido';

/** Emoción por defecto para cada estado técnico de la conversación. */
export const STATE_EMOTION: Record<OrbState, Emotion> = {
  idle: 'neutral',
  listening: 'feliz',
  thinking: 'mareado',
  speaking: 'feliz',
};

/** Paleta de color + velocidad de "respiración" por emoción, usada tanto por el
 * rostro vectorial (GabyOrb, respaldo nativo) como por la malla de partículas
 * (GabyParticleFace, la cara real en web). */
export const EMOTION_META: Record<Emotion, { colors: [string, string]; speed: number }> = {
  neutral: { colors: [colors.accent, colors.primary], speed: 2600 },
  feliz: { colors: [colors.success, colors.accent], speed: 1800 },
  enojo: { colors: [colors.error, colors.primary], speed: 900 },
  tristeza: { colors: [colors.textMuted, colors.primary], speed: 3600 },
  mareado: { colors: [colors.primary, colors.accent], speed: 550 },
  confundido: { colors: [colors.accent, colors.textMuted], speed: 2000 },
};
