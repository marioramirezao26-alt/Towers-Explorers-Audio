import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type WakeWordStatus = 'idle' | 'listening' | 'awaiting-command' | 'unsupported' | 'error';

interface UseWakeWordOptions {
  onCommand: (command: string) => void;
  wakeWord?: string;
  lang?: string;
}

// Errores que casi seguro significan que el micrófono no va a funcionar hasta que
// el usuario haga algo (dar permiso, revisar el hardware) — no vale la pena seguir
// reintentando en silencio, mejor avisar.
const FATAL_ERRORS = new Set(['not-allowed', 'audio-capture', 'service-not-allowed']);

// Si no pasa NADA (ni resultado, ni error, ni fin) en este tiempo, asumimos que el
// reconocimiento de voz se "colgó" (bug conocido de Android Chrome) y lo reiniciamos
// desde cero en vez de quedarnos escuchando en silencio para siempre.
const WATCHDOG_MS = 20000;

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
  const lastActivityRef = useRef(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  const supported =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const clearTimers = () => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    if (watchdogRef.current) clearInterval(watchdogRef.current);
    restartTimerRef.current = null;
    watchdogRef.current = null;
  };

  const stop = useCallback(() => {
    enabledRef.current = false;
    pausedRef.current = false;
    clearTimers();
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

    clearTimers();

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;

    const touch = () => {
      lastActivityRef.current = Date.now();
    };

    recognition.onstart = touch;

    recognition.onresult = (event) => {
      touch();
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

    recognition.onerror = (event) => {
      touch();
      console.warn('useWakeWord: error de reconocimiento de voz:', event?.error);
      if (FATAL_ERRORS.has(event?.error ?? '')) {
        setStatus('error');
      }
      // Errores transitorios ('no-speech', 'aborted', 'network') se recuperan solos en onend.
    };

    recognition.onend = () => {
      touch();
      if (!enabledRef.current || pausedRef.current) return;
      // Pequeña pausa antes de reiniciar: en Android Chrome, reiniciar de inmediato
      // (sin este respiro) hace que el reconocimiento se "cuelgue" en silencio.
      restartTimerRef.current = setTimeout(() => {
        if (!enabledRef.current || pausedRef.current) return;
        try {
          recognition.start();
        } catch {
          // ya estaba iniciado; se ignora
        }
      }, 300);
    };

    recognitionRef.current = recognition;
    enabledRef.current = true;
    pausedRef.current = false;
    setEnabled(true);
    setStatus('listening');
    touch();
    try {
      recognition.start();
    } catch {
      setStatus('error');
      return;
    }

    // Vigilante: si el reconocimiento deja de dar señales de vida, lo reiniciamos entero.
    watchdogRef.current = setInterval(() => {
      if (!enabledRef.current || pausedRef.current) return;
      if (Date.now() - lastActivityRef.current > WATCHDOG_MS) {
        console.warn('useWakeWord: sin actividad, reiniciando el reconocimiento de voz.');
        recognitionRef.current?.abort();
        start();
      }
    }, 5000);
  }, [supported, wakeWord, lang]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    recognitionRef.current?.abort();
  }, []);

  const resume = useCallback(() => {
    if (!enabledRef.current) return;
    pausedRef.current = false;
    setStatus('listening');
    lastActivityRef.current = Date.now();
    try {
      recognitionRef.current?.start();
    } catch {
      // ya estaba iniciado; se ignora
    }
  }, []);

  useEffect(() => stop, [stop]);

  return { supported, enabled, status, start, stop, pause, resume };
}
