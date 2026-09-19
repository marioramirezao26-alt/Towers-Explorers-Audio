import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';

export type HandsFreeStatus =
  | 'apagado'
  | 'no-soportado'
  | 'error'
  | 'esperando'
  | 'grabando'
  | 'transcribiendo';

interface UseHandsFreeOptions {
  /** Mientras sea true el micrófono queda abierto esperando el aplauso. */
  activo: boolean;
  /** Lo que se entendió, listo para mandarse como comando. */
  onTexto: (texto: string) => void;
  /** True mientras Gaby habla: no debe oírse a sí misma ni grabar su respuesta. */
  pausado?: boolean;
  /** Aplausos seguidos que hacen falta. Uno solo lo dispara cualquier cosa. */
  aplausos?: number;
}

/**
 * Manos libres completo: aplaudes, Gaby graba lo que dices, detecta cuándo
 * callaste, lo manda a transcribir y vuelve a quedarse a la espera.
 *
 * Todo cuelga de una sola captura de micrófono, compartida entre el detector de
 * aplausos, el de silencio y la grabación. Abrir el micrófono tres veces daría
 * tres diálogos de permiso y pelearía consigo mismo por el dispositivo.
 *
 * La transcripción va a transcribeCommand (Whisper) en vez de al reconocimiento
 * del navegador a propósito: dentro de la app de escritorio, Chromium no trae la
 * clave que ese reconocimiento necesita y falla siempre. Por la nube funciona
 * igual en el .exe, en Chrome y en el teléfono, y entiende mejor el español.
 */

/* --- Reconocer el aplauso ------------------------------------------------ */
/** Por debajo de esto no se mira nada: es el suelo de un micrófono cualquiera. */
const PICO_MINIMO = 0.16;
/** Cuántas veces por encima del ruido de fondo tiene que estar el golpe. */
const FACTOR_SOBRE_RUIDO = 6;
/** Proporción de energía por encima de 2 kHz que separa un aplauso de una voz. */
const AGUDOS_MINIMOS = 0.35;
const CORTE_AGUDOS_HZ = 2000;
/** Tras un aplauso el eco sigue sonando: no cuenta como otro. */
const REFRACTARIO_MS = 130;
/** Dos aplausos más separados que esto ya no son la misma señal. */
const VENTANA_APLAUSOS_MS = 900;

/* --- Grabar y saber cuándo parar ----------------------------------------- */
/** Margen tras el aplauso, para que su cola no entre en la grabación. */
const RETARDO_INICIO_MS = 250;
/** Silencio seguido que da por terminada la frase. */
const SILENCIO_MS = 1300;
/** Nunca se corta antes: da tiempo a empezar a hablar. */
const MINIMO_GRABACION_MS = 1200;
/** Tope duro, por si el silencio nunca llega (ventilador, calle, música). */
const MAXIMO_GRABACION_MS = 15000;
/** Volumen por encima del ruido de fondo que cuenta como "sigue hablando". */
const FACTOR_VOZ = 2.2;

async function aBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onloadend = () => resolve(String(lector.result).split(',')[1] ?? '');
    lector.onerror = () => reject(new Error('No se pudo leer el audio grabado.'));
    lector.readAsDataURL(blob);
  });
}

export function useHandsFree({ activo, onTexto, pausado = false, aplausos = 2 }: UseHandsFreeOptions) {
  const [status, setStatus] = useState<HandsFreeStatus>('apagado');
  const [error, setError] = useState<string | null>(null);

  const onTextoRef = useRef(onTexto);
  onTextoRef.current = onTexto;
  const pausadoRef = useRef(pausado);
  pausadoRef.current = pausado;

  const supported =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== 'undefined' &&
    !!(window.AudioContext ??
      (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);

  useEffect(() => {
    if (!supported) {
      setStatus('no-soportado');
      return undefined;
    }
    if (!activo) {
      setStatus('apagado');
      return undefined;
    }

    let vivo = true;
    let cuadro = 0;
    let contexto: AudioContext | null = null;
    let captura: MediaStream | null = null;
    let grabadora: MediaRecorder | null = null;

    const arrancar = async () => {
      try {
        // Sin procesado del navegador: el cancelador de eco y el control
        // automático de ganancia están hechos para la voz y aplanan justo los
        // golpes secos que hay que detectar.
        captura = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
        if (!vivo) {
          captura.getTracks().forEach((t) => t.stop());
          return;
        }

        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        contexto = new Ctor();
        if (contexto.state === 'suspended') await contexto.resume();

        const analizador = contexto.createAnalyser();
        analizador.fftSize = 1024;
        // Sin suavizado: interesa el golpe instantáneo, no la tendencia.
        analizador.smoothingTimeConstant = 0;
        contexto.createMediaStreamSource(captura).connect(analizador);

        const ondas = new Float32Array(analizador.fftSize);
        const espectro = new Uint8Array(analizador.frequencyBinCount);
        const primerBinAgudo = Math.floor(
          CORTE_AGUDOS_HZ / (contexto.sampleRate / analizador.fftSize),
        );

        let fase: 'esperando' | 'grabando' | 'transcribiendo' = 'esperando';
        let ruido = 0.01;
        let ultimoAplauso = 0;
        let recientes: number[] = [];
        let inicioGrabacion = 0;
        let ultimaVoz = 0;
        let trozos: Blob[] = [];

        const transcribir = async (blob: Blob) => {
          try {
            const audioBase64 = await aBase64(blob);
            if (!audioBase64) throw new Error('La grabación salió vacía.');
            const llamar = httpsCallable<{ audioBase64: string; mimeType: string }, { text: string }>(
              functions,
              'transcribeCommand',
            );
            const { data } = await llamar({ audioBase64, mimeType: blob.type || 'audio/webm' });
            const texto = data.text?.trim();
            if (texto) onTextoRef.current(texto);
            if (vivo) setError(null);
          } catch (e) {
            if (vivo) setError(e instanceof Error ? e.message : 'No se pudo transcribir lo que dijiste.');
          } finally {
            fase = 'esperando';
            recientes = [];
            if (vivo) setStatus('esperando');
          }
        };

        const detener = () => {
          if (grabadora?.state === 'recording') grabadora.stop();
        };

        const grabar = () => {
          trozos = [];
          const tipo = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : undefined;
          grabadora = new MediaRecorder(captura!, tipo ? { mimeType: tipo } : undefined);
          grabadora.ondataavailable = (e) => {
            if (e.data.size) trozos.push(e.data);
          };
          grabadora.onstop = () => {
            const blob = new Blob(trozos, { type: grabadora?.mimeType || 'audio/webm' });
            fase = 'transcribiendo';
            if (vivo) setStatus('transcribiendo');
            transcribir(blob);
          };
          grabadora.start();

          inicioGrabacion = Date.now();
          ultimaVoz = inicioGrabacion;
          fase = 'grabando';
          if (vivo) setStatus('grabando');
        };

        const mirar = () => {
          if (!vivo) return;
          cuadro = requestAnimationFrame(mirar);
          if (fase === 'transcribiendo') return;

          analizador.getFloatTimeDomainData(ondas);
          let pico = 0;
          let suma = 0;
          for (let i = 0; i < ondas.length; i++) {
            const v = Math.abs(ondas[i]);
            if (v > pico) pico = v;
            suma += ondas[i] * ondas[i];
          }
          const rms = Math.sqrt(suma / ondas.length);
          const ahora = Date.now();

          if (fase === 'grabando') {
            if (rms > ruido * FACTOR_VOZ) ultimaVoz = ahora;
            const bastante = ahora - inicioGrabacion > MINIMO_GRABACION_MS;
            const callado = ahora - ultimaVoz > SILENCIO_MS;
            if ((bastante && callado) || ahora - inicioGrabacion > MAXIMO_GRABACION_MS) detener();
            return;
          }

          // Mientras Gaby habla, lo que entra por el micrófono es su propia voz.
          if (pausadoRef.current) return;

          const esGolpe = pico > PICO_MINIMO && pico > ruido * FACTOR_SOBRE_RUIDO;
          if (!esGolpe) {
            // El ruido de fondo solo se aprende fuera de los golpes: aprenderlo
            // durante uno subiría el listón y el segundo aplauso no se oiría.
            ruido = ruido * 0.97 + rms * 0.03;
            return;
          }
          if (ahora - ultimoAplauso < REFRACTARIO_MS) return;

          analizador.getByteFrequencyData(espectro);
          let total = 0;
          let agudos = 0;
          for (let i = 0; i < espectro.length; i++) {
            total += espectro[i];
            if (i >= primerBinAgudo) agudos += espectro[i];
          }
          if (total === 0 || agudos / total < AGUDOS_MINIMOS) return;

          ultimoAplauso = ahora;
          recientes = [...recientes.filter((t) => ahora - t <= VENTANA_APLAUSOS_MS), ahora];
          if (recientes.length < aplausos) return;

          recientes = [];
          // El margen evita que la cola del aplauso entre en la grabación.
          setTimeout(() => {
            if (vivo && fase === 'esperando') grabar();
          }, RETARDO_INICIO_MS);
        };

        setStatus('esperando');
        cuadro = requestAnimationFrame(mirar);
      } catch {
        // Permiso denegado o sin micrófono. No se reintenta: sin permiso,
        // insistir solo repite el diálogo del navegador.
        if (vivo) {
          setStatus('error');
          setError('No se pudo usar el micrófono. Revisa el permiso del navegador.');
        }
      }
    };

    arrancar();

    return () => {
      vivo = false;
      cancelAnimationFrame(cuadro);
      if (grabadora?.state === 'recording') grabadora.stop();
      captura?.getTracks().forEach((t) => t.stop());
      contexto?.close();
    };
  }, [activo, aplausos, supported]);

  return { supported, status, error };
}
