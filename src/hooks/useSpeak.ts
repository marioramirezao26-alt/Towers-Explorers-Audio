import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { synthesizeSpeech } from '@/services/tts';

interface SpeakOptions {
  lang?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

const LANG_PRIORITY = ['es-MX', 'es-US', 'es-419', 'es-ES', 'es'];

/** Elige la voz en español que suene menos robótica de las que ofrezca el dispositivo (respaldo). */
function pickBestVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const spanish = voices.filter((v) => v.lang.toLowerCase().startsWith('es'));
  if (spanish.length === 0) return undefined;

  const priorities = [lang, ...LANG_PRIORITY];
  const score = (v: SpeechSynthesisVoice) => {
    const langRank = priorities.findIndex((p) => v.lang.toLowerCase() === p.toLowerCase());
    const networkBonus = v.localService ? 0 : 100;
    return networkBonus - (langRank === -1 ? priorities.length : langRank);
  };

  return [...spanish].sort((a, b) => score(b) - score(a))[0];
}

/**
 * Lee texto en voz alta (respuestas de Gaby). Usa la voz humana de ElevenLabs (Cloud Function)
 * y, si falla (sin secreto configurado, sin cuota, sin red), cae de vuelta a la voz del
 * navegador para que Gaby nunca se quede muda. Solo funciona en web.
 */
export function useSpeak() {
  const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
  const supported = isWeb && (!!window.speechSynthesis || typeof window.Audio !== 'undefined');
  const speechSynthesisSupported = isWeb && !!window.speechSynthesis;
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!speechSynthesisSupported) return;
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, [speechSynthesisSupported]);

  const speakWithBrowserVoice = useCallback(
    (text: string, opts?: SpeakOptions) => {
      if (!speechSynthesisSupported || !text.trim()) {
        opts?.onEnd?.();
        return;
      }
      window.speechSynthesis.cancel();
      const lang = opts?.lang ?? 'es-MX';
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      const voice = pickBestVoice(voicesRef.current, lang);
      if (voice) utterance.voice = voice;
      utterance.rate = 0.97;
      utterance.pitch = 1.04;
      utterance.onstart = () => opts?.onStart?.();
      utterance.onend = () => opts?.onEnd?.();
      utterance.onerror = () => opts?.onEnd?.();
      window.speechSynthesis.speak(utterance);
    },
    [speechSynthesisSupported],
  );

  const speak = useCallback(
    (text: string, opts?: SpeakOptions) => {
      if (!text.trim()) {
        opts?.onEnd?.();
        return;
      }
      if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.Audio === 'undefined') {
        speakWithBrowserVoice(text, opts);
        return;
      }

      (async () => {
        try {
          const dataUri = await synthesizeSpeech(text);
          const audio = new window.Audio(dataUri);
          audioRef.current = audio;
          audio.onplay = () => opts?.onStart?.();
          audio.onended = () => opts?.onEnd?.();
          audio.onerror = () => {
            console.warn('La voz de ElevenLabs falló al reproducirse, usando la del navegador.');
            speakWithBrowserVoice(text, opts);
          };
          await audio.play();
        } catch (error) {
          console.warn('No se pudo usar la voz de ElevenLabs, usando la del navegador:', error);
          speakWithBrowserVoice(text, opts);
        }
      })();
    },
    [speakWithBrowserVoice],
  );

  const cancel = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (speechSynthesisSupported) window.speechSynthesis.cancel();
  }, [speechSynthesisSupported]);

  return { supported, speak, cancel };
}
