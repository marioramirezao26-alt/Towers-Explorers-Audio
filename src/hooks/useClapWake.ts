import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type ClapStatus = 'idle' | 'listening' | 'unsupported' | 'error';

interface UseClapWakeOptions {
  /** Se llama cuando se reconoce la secuencia completa de aplausos. */
  onClap: () => void;
  /** Mientras sea true, el micrófono queda abierto escuchando aplausos. */
  activo: boolean;
  /** Aplausos seguidos que hacen falta. Dos descartan casi todos los golpes sueltos. */
  aplausos?: number;
}

/**
 * Un aplauso suena muy distinto de una voz o de un portazo, y esas tres
 * diferencias son las que se miden aquí:
 *
 * 1. Es un golpe: la señal salta de golpe muy por encima del ruido de fondo.
 * 2. Es agudo: casi toda su energía está por encima de los 2 kHz, mientras que
 *    la voz y los golpes de muebles cargan sobre todo los graves.
 * 3. Es breve: dura unas decenas de milisegundos, no se sostiene.
 *
 * El umbral es relativo al ruido de fondo del sitio, no un número fijo: así
 * funciona igual en una habitación callada que con música de fondo.
 */

/** Por debajo de esto no se mira nada: es el suelo de un micrófono cualquiera. */
const PICO_MINIMO = 0.16;
/** Cuántas veces por encima del ruido de fondo tiene que estar el golpe. */
const FACTOR_SOBRE_RUIDO = 6;
/** Proporción de energía por encima de 2 kHz que separa un aplauso de una voz. */
const AGUDOS_MINIMOS = 0.35;
/** Tras un aplauso, el eco y la reverberación siguen sonando: no cuentan como otro. */
const REFRACTARIO_MS = 130;
/** Dos aplausos más separados que esto ya no se leen como una misma señal. */
const VENTANA_MS = 900;
/** Frecuencia a partir de la cual se considera "agudo". */
const CORTE_AGUDOS_HZ = 2000;

export function useClapWake({ onClap, activo, aplausos = 2 }: UseClapWakeOptions) {
  const [status, setStatus] = useState<ClapStatus>('idle');
  const onClapRef = useRef(onClap);
  onClapRef.current = onClap;

  const supported =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);

  useEffect(() => {
    if (!supported) {
      setStatus('unsupported');
      return undefined;
    }
    if (!activo) {
      setStatus('idle');
      return undefined;
    }

    let vivo = true;
    let cuadro = 0;
    let contexto: AudioContext | null = null;
    let pista: MediaStream | null = null;

    const escuchar = async () => {
      try {
        // Sin procesado del navegador: el cancelador de eco y el control
        // automático de ganancia están hechos para la voz, y justamente aplanan
        // los golpes secos que aquí hay que detectar.
        pista = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
        if (!vivo) {
          pista.getTracks().forEach((t) => t.stop());
          return;
        }

        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        contexto = new Ctor();
        if (contexto.state === 'suspended') await contexto.resume();

        const analizador = contexto.createAnalyser();
        analizador.fftSize = 1024;
        // Sin suavizado: aquí interesa el golpe instantáneo, no la tendencia.
        analizador.smoothingTimeConstant = 0;
        contexto.createMediaStreamSource(pista).connect(analizador);

        const ondas = new Float32Array(analizador.fftSize);
        const espectro = new Uint8Array(analizador.frequencyBinCount);
        const hzPorBin = contexto.sampleRate / analizador.fftSize;
        const primerBinAgudo = Math.floor(CORTE_AGUDOS_HZ / hzPorBin);

        let ruido = 0.01;
        let ultimoAplauso = 0;
        let recientes: number[] = [];

        setStatus('listening');

        const mirar = () => {
          if (!vivo) return;
          cuadro = requestAnimationFrame(mirar);

          analizador.getFloatTimeDomainData(ondas);
          let pico = 0;
          for (let i = 0; i < ondas.length; i++) {
            const v = Math.abs(ondas[i]);
            if (v > pico) pico = v;
          }

          const ahora = Date.now();
          const esGolpe = pico > PICO_MINIMO && pico > ruido * FACTOR_SOBRE_RUIDO;

          if (!esGolpe) {
            // El ruido de fondo solo se aprende fuera de los golpes; si no, un
            // aplauso subiría el listón y el segundo pasaría desapercibido.
            ruido = ruido * 0.97 + pico * 0.03;
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
          recientes = [...recientes.filter((t) => ahora - t <= VENTANA_MS), ahora];

          if (recientes.length >= aplausos) {
            recientes = [];
            onClapRef.current();
          }
        };

        cuadro = requestAnimationFrame(mirar);
      } catch {
        // Permiso denegado, o no hay micrófono. No se reintenta: sin permiso,
        // insistir solo repite el diálogo del navegador.
        if (vivo) setStatus('error');
      }
    };

    escuchar();

    return () => {
      vivo = false;
      cancelAnimationFrame(cuadro);
      pista?.getTracks().forEach((t) => t.stop());
      contexto?.close();
    };
  }, [activo, aplausos, supported]);

  return { supported, status };
}
