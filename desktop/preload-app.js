const { contextBridge, ipcRenderer } = require('electron');

/**
 * El puente entre Gaby y el computador.
 *
 * Se exponen tres cosas: pedir una acción del catálogo, enterarse de que el
 * orbe oyó un aplauso, y contarle al orbe en qué va la conversación.
 *
 * La lista de acciones vive en el proceso principal (acciones.js) y no se puede
 * ampliar desde aquí, así que lo peor que puede hacer la página es pedir algo
 * que no existe y recibir un error.
 *
 * `disponible` permite que la misma app sepa dónde está corriendo: dentro del
 * programa de escritorio ofrece estas capacidades, y en un navegador normal
 * simplemente no aparecen.
 */
contextBridge.exposeInMainWorld('gabyPC', {
  disponible: true,
  plataforma: process.platform,

  ejecutar: (accion, args) => ipcRenderer.invoke('gaby-pc', { accion, args }),

  /**
   * Avisa cuando el orbe reconoció el aplauso. Quien oye es el orbe, para que
   * funcione sin ninguna ventana abierta; quien graba y transcribe es esta
   * página, que es la que tiene la sesión iniciada.
   *
   * Devuelve la función para dejar de escuchar: sin eso, recargar la página
   * dejaría suscripciones colgadas que se acumularían.
   */
  alAplaudir: (callback) => {
    const manejar = () => callback();
    ipcRenderer.on('aplauso', manejar);
    return () => ipcRenderer.off('aplauso', manejar);
  },

  /** En qué va la conversación, para que el orbe lo muestre. */
  avisarEstado: (fase, emocion) => ipcRenderer.send('gaby-estado', { fase, emocion }),

  /** Un pulso por cada palabra dicha, para que el orbe lata al hablar. */
  pulsoAlHablar: () => ipcRenderer.send('gaby-pulso'),
});
