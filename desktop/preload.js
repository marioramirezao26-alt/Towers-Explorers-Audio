const { ipcRenderer } = require('electron');

/**
 * Adapta el orbe (que es el mismo archivo que usa iOS) a una ventana de
 * escritorio, sin tocarlo.
 *
 * Hacen falta tres cosas que en el teléfono no: fondo transparente en vez del
 * azul oscuro, poder arrastrarlo por la pantalla, y una forma de abrir la app.
 * Todo eso se añade aquí, desde fuera, para que el orbe siga siendo un solo
 * archivo compartido entre las tres plataformas.
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
  document.body.append(arrastre, acciones);
});
