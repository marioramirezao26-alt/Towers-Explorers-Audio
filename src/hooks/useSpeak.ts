import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

interface SpeakOptions {
  lang?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

const LANG_PRIORITY = ['es-MX', 'es-US', 'es-419', 'es-ES', 'es'];

/** Elige la voz en español que suene menos robótica de las que ofrezca el dispositivo. */
function pickBestVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const spanish = voices.filter((v) => v.lang.toLowerCase().startsWith('es'));
  if (spanish.length === 0) return undefined;

  const priorities = [lang, ...LANG_PRIORITY];
  const score = (v: SpeechSynthesisVoice) => {
    const langRank = priorities.findIndex((p) => v.lang.toLowerCase() === p.toLowerCase());
    // Las voces "no locales" (de red, ej. "Google español") suenan mucho más naturales
    // que los motores TTS instalados en el dispositivo.
    const networkBonus = v.localService ? 0 : 100;
    return networkBonus - (langRank === -1 ? priorities.length : langRank);
  };

  return [...spanish].sort((a, b) => score(b) - score(a))[0];
}

/** Quita emojis del texto antes de hablarlo — algunos motores de voz intentan "leerlos". */
function stripEmojis(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/️/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Lee texto en voz alta (respuestas de Gaby). Solo funciona en web. */
export function useSpeak() {
  const supported = Platform.OS === 'web' && typeof window !== 'undefined' && !!window.speechSynthesis;
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!supported) return;
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, [supported]);

  const speak = useCallback(
    (text: string, opts?: SpeakOptions) => {
      const clean = stripEmojis(text);
      if (!supported || !clean) {
        opts?.onEnd?.();
        return;
      }
      window.speechSynthesis.cancel();
      const lang = opts?.lang ?? 'es-MX';
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = lang;
      const voice = pickBestVoice(voicesRef.current, lang);
      if (voice) utterance.voice = voice;
      // Un poco más lento y con algo más de variación de tono: suena menos plano/robótico.
      utterance.rate = 0.97;
      utterance.pitch = 1.04;
      utterance.onstart = () => opts?.onStart?.();
      utterance.onend = () => opts?.onEnd?.();
      utterance.onerror = () => opts?.onEnd?.();
      window.speechSynthesis.speak(utterance);
    },
    [supported],
  );

  const cancel = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  return { supported, speak, cancel };
}
