/**
 * Detector de aplausos para la ventana del orbe.
 *
 * Un aplauso suena distinto de una voz y de un portazo en tres cosas medibles,
 * y son las tres que se miran: salta de golpe muy por encima del ruido de
 * fondo, casi toda su energía está por encima de los 2 kHz (la voz y los
 * muebles cargan los graves), y dura decenas de milisegundos.
 *
 * El umbral es relativo al ruido del sitio, no un número fijo: así funciona
 * igual en una habitación callada que con música puesta.
 *
 * Esto es lo mismo que hace useHandsFree dentro de la app, pero aquí vive en el
 * orbe para que escuchar no dependa de tener una ventana abierta. El orbe solo
 * reconoce el aplauso; grabar y transcribir sigue siendo cosa de la app, que es
 * la que tiene la sesión iniciada.
 */

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
const VENTANA_MS = 900;
/** Aplausos seguidos que hacen falta. Uno solo lo dispara cualquier cosa. */
const APLAUSOS = 2;

/**
 * @param {(n: number) => void} onAplauso  Se llama al completar la secuencia.
 * @returns {Promise<{ detener: () => void, pausar: (v: boolean) => void }>}
 */
async function iniciarDetector(onAplauso) {
  // Sin procesado del navegador: el cancelador de eco y el control automático
  // de ganancia están hechos para la voz y aplanan justo los golpes secos que
  // hay que detectar.
  const captura = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });

  const contexto = new AudioContext();
  if (contexto.state === 'suspended') await contexto.resume();

  const analizador = contexto.createAnalyser();
  analizador.fftSize = 1024;
  // Sin suavizado: interesa el golpe instantáneo, no la tendencia.
  analizador.smoothingTimeConstant = 0;
  contexto.createMediaStreamSource(captura).connect(analizador);

  const ondas = new Float32Array(analizador.fftSize);
  const espectro = new Uint8Array(analizador.frequencyBinCount);
  const primerBinAgudo = Math.floor(CORTE_AGUDOS_HZ / (contexto.sampleRate / analizador.fftSize));

  let vivo = true;
  let pausado = false;
  let cuadro = 0;
  let ruido = 0.01;
  let ultimo = 0;
  let recientes = [];

  const mirar = () => {
    if (!vivo) return;
    cuadro = requestAnimationFrame(mirar);

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

    const esGolpe = pico > PICO_MINIMO && pico > ruido * FACTOR_SOBRE_RUIDO;
    if (!esGolpe) {
      // El ruido de fondo solo se aprende fuera de los golpes: aprenderlo
      // durante uno subiría el listón y el segundo aplauso no se oiría.
      ruido = ruido * 0.97 + rms * 0.03;
      return;
    }

    // Mientras Gaby graba o habla, lo que entra por el micrófono es la
    // conversación en curso, no una llamada nueva. Se sigue aprendiendo el
    // ruido de fondo (arriba) pero no se cuentan golpes.
    if (pausado) return;
    if (ahora - ultimo < REFRACTARIO_MS) return;

    analizador.getByteFrequencyData(espectro);
    let total = 0;
    let agudos = 0;
    for (let i = 0; i < espectro.length; i++) {
      total += espectro[i];
      if (i >= primerBinAgudo) agudos += espectro[i];
    }
    if (total === 0 || agudos / total < AGUDOS_MINIMOS) return;

    ultimo = ahora;
    recientes = [...recientes.filter((t) => ahora - t <= VENTANA_MS), ahora];
    if (recientes.length < APLAUSOS) return;

    recientes = [];
    onAplauso(ahora);
  };

  cuadro = requestAnimationFrame(mirar);

  return {
    detener() {
      vivo = false;
      cancelAnimationFrame(cuadro);
      captura.getTracks().forEach((t) => t.stop());
      contexto.close();
    },
    pausar(valor) {
      pausado = valor;
      if (valor) recientes = [];
    },
  };
}

module.exports = { iniciarDetector };
