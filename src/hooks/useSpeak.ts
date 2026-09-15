import { useCallback } from 'react';
import { Platform } from 'react-native';

interface SpeakOptions {
  lang?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

/** Lee texto en voz alta (respuestas de Gaby). Solo funciona en web. */
export function useSpeak() {
  const supported = Platform.OS === 'web' && typeof window !== 'undefined' && !!window.speechSynthesis;

  const speak = useCallback(
    (text: string, opts?: SpeakOptions) => {
      if (!supported || !text.trim()) {
        opts?.onEnd?.();
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = opts?.lang ?? 'es-MX';
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
