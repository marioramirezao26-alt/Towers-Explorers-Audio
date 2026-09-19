const { ipcRenderer } = require('electron');

/**
 * El detector de aplausos va escrito aquí dentro, y no en un archivo aparte.
 *
 * Desde Electron 20 los renderizadores corren en sandbox por defecto, y un
 * preload en sandbox solo puede cargar unos pocos módulos internos: un
 * require de un archivo local lanza y se lleva por delante el preload entero.
 * Cuando pasó, el orbe perdió a la vez la transparencia y el oído, que es
 * justo todo lo que hace este archivo — un fallo silencioso que parecía dos
 * fallos distintos.
 *
 * Un aplauso suena distinto de una voz y de un portazo en tres cosas
 * medibles, y son las tres que se miran: salta de golpe muy por encima del
 * ruido de fondo, casi toda su energía está por encima de los 2 kHz (la voz y
 * los muebles cargan los graves), y dura decenas de milisegundos. El umbral es
 * relativo al ruido del sitio, no un número fijo, para que funcione igual en
 * silencio que con música puesta.
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

  let pausado = false;
  let ruido = 0.01;
  let ultimo = 0;
  let recientes = [];

  const mirar = () => {
    requestAnimationFrame(mirar);

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
    // conversación en curso, no una llamada nueva.
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
    onAplauso();
  };

  requestAnimationFrame(mirar);

  return {
    pausar(valor) {
      pausado = valor;
      if (valor) recientes = [];
    },
  };
}

/**
 * Adapta el orbe (que es el mismo archivo que usa iOS) a una ventana de
 * escritorio, y lo convierte en el que escucha.
 *
 * Hacen falta cuatro cosas que en el teléfono no: fondo transparente en vez del
 * azul oscuro, poder arrastrarlo por la pantalla, una forma de abrir la app, y
 * el oído. Todo se añade desde fuera para que el orbe siga siendo un solo
 * archivo compartido entre las tres plataformas.
 *
 * El oído vive aquí y no en la app a propósito: así aplaudir funciona sin tener
 * ninguna ventana abierta, que era lo que le quitaba la gracia a tener un orbe
 * flotando. El orbe solo reconoce el aplauso; grabar y transcribir sigue siendo
 * cosa de la app, que es la que tiene la sesión iniciada.
 */
window.addEventListener('DOMContentLoaded', () => {
  const estilo = document.createElement('style');
  estilo.textContent = `
    html, body { background: transparent !important; }

    /* Toda la ventana arrastra el orbe; el botón se excluye para que se pueda pulsar. */
    #gaby-arrastre {
      position: fixed;
      inset: 0;
      z-index: 1;
      -webkit-app-region: drag;
    }

    #gaby-acciones {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 6px;
      z-index: 2;
      display: flex;
      gap: 6px;
      justify-content: center;
      opacity: 0;
      transition: opacity 160ms ease;
      -webkit-app-region: no-drag;
    }
    body:hover #gaby-acciones { opacity: 1; }

    #gaby-acciones button {
      font: 600 11px system-ui, sans-serif;
      color: #E6EAF5;
      background: rgba(6, 12, 26, 0.82);
      border: 1px solid rgba(125, 211, 252, 0.45);
      border-radius: 999px;
      padding: 4px 11px;
      cursor: pointer;
    }
    #gaby-acciones button:hover { background: rgba(14, 26, 48, 0.95); }

    /* Qué está haciendo Gaby, en una línea bajo el orbe. */
    #gaby-estado {
      position: fixed;
      left: 0;
      right: 0;
      top: 6px;
      z-index: 2;
      text-align: center;
      font: 600 10px system-ui, sans-serif;
      letter-spacing: 0.5px;
      color: #7DD3FC;
      text-shadow: 0 1px 6px rgba(0,0,0,0.9);
      opacity: 0;
      transition: opacity 200ms ease;
      pointer-events: none;
    }
    #gaby-estado.visible { opacity: 1; }
  `;
  document.head.appendChild(estilo);

  const arrastre = document.createElement('div');
  arrastre.id = 'gaby-arrastre';

  const acciones = document.createElement('div');
  acciones.id = 'gaby-acciones';

  const abrir = document.createElement('button');
  abrir.textContent = 'Abrir';
  abrir.title = 'Abrir Gaby';
  abrir.addEventListener('click', () => ipcRenderer.send('abrir-gaby'));

  const ocultar = document.createElement('button');
  ocultar.textContent = 'Ocultar';
  ocultar.title = 'Ocultar el orbe (vuelve desde el icono de la bandeja)';
  ocultar.addEventListener('click', () => ipcRenderer.send('ocultar-orbe'));

  acciones.append(abrir, ocultar);

  const estado = document.createElement('div');
  estado.id = 'gaby-estado';

  document.body.append(arrastre, acciones, estado);

  const decirEstado = (texto) => {
    estado.textContent = texto ?? '';
    estado.classList.toggle('visible', Boolean(texto));
  };

  /* --- El oído ---------------------------------------------------------- */

  let detector = null;

  iniciarDetector(() => {
    decirEstado('TE ESCUCHO');
    ipcRenderer.send('orbe-aplauso');
  })
    .then((d) => {
      detector = d;
    })
    .catch(() => {
      // Sin permiso de micrófono el orbe sigue siendo útil como presencia y
      // como acceso a la app; solo se pierde el aplauso.
      decirEstado('SIN MICRÓFONO');
      setTimeout(() => decirEstado(''), 4000);
    });

  /**
   * La app avisa de lo que está haciendo para que el orbe lo muestre y deje de
   * contar aplausos mientras tanto: durante la conversación, lo que entra por
   * el micrófono es la conversación misma.
   */
  ipcRenderer.on('estado-gaby', (_e, { fase, emocion }) => {
    detector?.pausar(fase !== 'libre');

    const letreros = {
      libre: '',
      grabando: 'TE ESCUCHO',
      transcribiendo: 'ENTENDIENDO…',
      pensando: 'PENSANDO…',
      hablando: '',
    };
    decirEstado(letreros[fase] ?? '');

    // El orbe expone estas dos desde su propio script (ver amica.bundle).
    if (typeof window.gabySetSpeaking === 'function') {
      window.gabySetSpeaking(fase === 'hablando');
    }
    if (emocion && typeof window.gabySetEmotion === 'function') {
      window.gabySetEmotion(emocion);
    }
  });

  ipcRenderer.on('pulso-habla', () => {
    if (typeof window.gabyTalkPulse === 'function') window.gabyTalkPulse();
  });
});
