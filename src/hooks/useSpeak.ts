import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

interface SpeakOptions {
  lang?: string;
  onStart?: () => void;
  onEnd?: () => void;
  /** Se dispara en cada límite de palabra que reporte el motor de voz — úsalo para
   * animar la boca del avatar en sync con el habla real (no todos los navegadores
   * ni voces lo disparan; si nunca llega, el avatar cae a una animación genérica). */
  onBoundary?: () => void;
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

/**
 * Limpia el texto antes de hablarlo: quita emojis y símbolos de formato markdown
 * (**negrita**, _cursiva_, `código`, # encabezados, listas con - o *) que la voz
 * de otra forma leería literalmente ("asterisco asterisco...").
 */
function sanitizeForSpeech(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/️/g, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/[*_#`]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Lee texto en voz alta (respuestas de Gaby). Solo funciona en web. */
export function useSpeak() {
  const supported = Platform.OS === 'web' && typeof window !== 'undefined' && !!window.speechSynthesis;
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  // Chrome puede recolectar (GC) el objeto SpeechSynthesisUtterance antes de que
  // termine de hablar si nada más lo referencia, dejando la voz en silencio sin
  // ningún error visible — por eso lo guardamos aquí mientras dura.
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

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
      const clean = sanitizeForSpeech(text);
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
      utterance.onboundary = (event) => {
        if (event.name === 'word' || event.name === undefined) opts?.onBoundary?.();
      };
      utterance.onend = () => {
        utteranceRef.current = null;
        opts?.onEnd?.();
      };
      utterance.onerror = () => {
        utteranceRef.current = null;
        opts?.onEnd?.();
      };
      utteranceRef.current = utterance;
      // Llamar a speak() en el mismo tick que cancel() a veces hace que Chrome se
      // quede en silencio sin avisar — un pequeño respiro evita esa carrera.
      setTimeout(() => {
        if (utteranceRef.current === utterance) {
          window.speechSynthesis.speak(utterance);
        }
      }, 50);
    },
    [supported],
  );

  const cancel = useCallback(() => {
    utteranceRef.current = null;
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  return { supported, speak, cancel };
}
