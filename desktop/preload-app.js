const { contextBridge, ipcRenderer } = require('electron');

/**
 * El puente entre Gaby y el computador.
 *
 * Solo se expone una función: pedir una acción por su nombre. La lista de
 * acciones vive en el proceso principal (acciones.js) y no se puede ampliar
 * desde aquí, así que lo peor que puede hacer la página es pedir algo que no
 * existe y recibir un error.
 *
 * `disponible` permite que la misma app sepa dónde está corriendo: dentro del
 * programa de escritorio ofrece estas capacidades, y en un navegador normal
 * simplemente no aparecen.
 */
contextBridge.exposeInMainWorld('gabyPC', {
  disponible: true,
  plataforma: process.platform,
  ejecutar: (accion, args) => ipcRenderer.invoke('gaby-pc', { accion, args }),
});
