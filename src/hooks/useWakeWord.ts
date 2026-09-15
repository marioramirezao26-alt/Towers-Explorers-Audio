import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type WakeWordStatus = 'idle' | 'listening' | 'awaiting-command' | 'unsupported' | 'error';

interface UseWakeWordOptions {
  onCommand: (command: string) => void;
  wakeWord?: string;
  lang?: string;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * Escucha continuamente por el micrófono mientras esta pestaña esté abierta y en
 * primer plano, buscando la palabra clave ("gaby"). Solo funciona en web (Safari/
 * Chrome) — no hay forma de escuchar con la pantalla apagada o la app en segundo
 * plano dentro de una PWA, eso es una restricción del sistema, no de este código.
 */
export function useWakeWord({ onCommand, wakeWord = 'gaby', lang = 'es-MX' }: UseWakeWordOptions) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<WakeWordStatus>('idle');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const awaitingCommandRef = useRef(false);
  const enabledRef = useRef(false);
  const pausedRef = useRef(false);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  const supported =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const stop = useCallback(() => {
    enabledRef.current = false;
    pausedRef.current = false;
    setEnabled(false);
    setStatus('idle');
    recognitionRef.current?.abort();
  }, []);

  const start = useCallback(() => {
    if (!supported) {
      setStatus('unsupported');
      return;
    }
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const transcript = normalize(last?.[0]?.transcript ?? '');
      if (!transcript) return;

      const wake = normalize(wakeWord);
      if (transcript.includes(wake)) {
        const after = transcript.split(wake).pop()?.trim() ?? '';
        if (after) {
          awaitingCommandRef.current = false;
          setStatus('listening');
          onCommandRef.current(after);
        } else {
          awaitingCommandRef.current = true;
          setStatus('awaiting-command');
        }
      } else if (awaitingCommandRef.current) {
        awaitingCommandRef.current = false;
        setStatus('listening');
        onCommandRef.current(transcript);
      }
    };

    recognition.onerror = () => {
      // 'no-speech', 'not-allowed', etc. — se reintenta solo en onend.
    };

    recognition.onend = () => {
      if (enabledRef.current && !pausedRef.current) {
        try {
          recognition.start();
        } catch {
          // ya estaba iniciado; se ignora
        }
      }
    };

    recognitionRef.current = recognition;
    enabledRef.current = true;
    pausedRef.current = false;
    setEnabled(true);
    setStatus('listening');
    try {
      recognition.start();
    } catch {
      setStatus('error');
    }
  }, [supported, wakeWord, lang]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    recognitionRef.current?.abort();
  }, []);

  const resume = useCallback(() => {
    if (!enabledRef.current) return;
    pausedRef.current = false;
    setStatus('listening');
    try {
      recognitionRef.current?.start();
    } catch {
      // ya estaba iniciado; se ignora
    }
  }, []);

  useEffect(() => stop, [stop]);

  return { supported, enabled, status, start, stop, pause, resume };
}
