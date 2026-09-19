const { ipcRenderer } = require('electron');
const { iniciarDetector } = require('./escucha');

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
