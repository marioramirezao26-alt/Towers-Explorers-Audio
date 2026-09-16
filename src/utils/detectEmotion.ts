import { Emotion } from '@/components/gabyOrbShared';
import { normalizeText } from '@/utils/normalizeText';

/**
 * Motor de emociones simple (inspirado en el EmotionEngine de Scowld, pero por
 * palabras clave en vez de un modelo aparte): mira el texto de la respuesta de
 * Gaby y decide con qué cara debería decirla, en vez de usar siempre la emoción
 * fija del estado técnico (ej. "feliz" cada vez que habla). Devuelve `undefined`
 * cuando no hay ninguna señal clara, para que el llamador use su emoción por
 * defecto en ese caso.
 */
export function detectEmotionFromText(text: string): Emotion | undefined {
  const t = normalizeText(text);
  if (!t) return undefined;

  const SAD = /\b(lo siento|lamento|no pude|no logre|no encontre|fallo|fall[oó]|error|disculpa)\b/;
  const ANGRY = /\b(no puedo hacer eso|no esta permitido|limite alcanzado|no tengo acceso)\b/;
  const CONFUSED = /\b(no entendi|no te entendi|puedes repetir|no me quedo claro|a que te refieres)\?|\?{2,}/;
  const HAPPY = /\b(listo|hecho|genial|perfecto|con gusto|claro que si|anotado)\b|!{1,}/;

  if (SAD.test(t)) return 'tristeza';
  if (ANGRY.test(t)) return 'enojo';
  if (CONFUSED.test(t)) return 'confundido';
  if (HAPPY.test(t)) return 'feliz';
  return undefined;
}
