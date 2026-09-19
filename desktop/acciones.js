const { app, dialog, shell } = require('electron');
const { spawn } = require('node:child_process');

/**
 * Lo que Gaby puede hacer en el computador.
 *
 * Es un catálogo cerrado a propósito. La orden llega de una transcripción de
 * voz, y el margen de error de eso no es cero: si el puente aceptara comandos
 * libres, una frase mal entendida podría borrar archivos. Aquí cada acción es
 * una función con nombre propio y argumentos validados, y lo que no está en la
 * lista sencillamente no se puede pedir.
 *
 * Por lo mismo, ningún texto del usuario llega nunca a una línea de comandos:
 * los nombres de programa se resuelven contra el mapa de abajo, y lo que no
 * esté en él se rechaza.
 */

/** Programas conocidos → cómo se abren en Windows. */
const PROGRAMAS = {
  chrome: { tipo: 'exe', valor: 'chrome' },
  edge: { tipo: 'exe', valor: 'msedge' },
  spotify: { tipo: 'exe', valor: 'spotify' },
  whatsapp: { tipo: 'url', valor: 'whatsapp://' },
  explorador: { tipo: 'exe', valor: 'explorer' },
  bloc: { tipo: 'exe', valor: 'notepad' },
  calculadora: { tipo: 'exe', valor: 'calc' },
  word: { tipo: 'exe', valor: 'winword' },
  excel: { tipo: 'exe', valor: 'excel' },
  vscode: { tipo: 'exe', valor: 'code' },
  terminal: { tipo: 'exe', valor: 'wt' },
  configuracion: { tipo: 'url', valor: 'ms-settings:' },
  correo: { tipo: 'url', valor: 'https://mail.google.com' },
  calendario: { tipo: 'url', valor: 'https://calendar.google.com' },
};

/** Carpetas que se pueden abrir, por nombre de Electron. */
const CARPETAS = {
  descargas: 'downloads',
  documentos: 'documents',
  escritorio: 'desktop',
  imagenes: 'pictures',
  musica: 'music',
  videos: 'videos',
};

/** Códigos de tecla de Windows para medios y volumen. */
const TECLAS = {
  silenciar: 0xad,
  bajar: 0xae,
  subir: 0xaf,
  siguiente: 0xb0,
  anterior: 0xb1,
  parar: 0xb2,
  reproducir: 0xb3,
};

/**
 * Pulsa una tecla de sistema (volumen, medios).
 *
 * No hay API de Electron para esto: hay que llamar a keybd_event de user32.dll.
 * Se hace desde PowerShell para no depender de ningún programa externo
 * descargado, que sería otra cosa más que mantener y en la que confiar.
 */
function pulsarTecla(codigo, veces = 1) {
  if (process.platform !== 'win32') throw new Error('Solo disponible en Windows.');
  const guion = [
    "Add-Type -Name T -Namespace G -MemberDefinition '[DllImport(\"user32.dll\")] public static extern void keybd_event(byte b, byte s, uint f, System.IntPtr e);'",
    `1..${veces} | ForEach-Object {`,
    `  [G.T]::keybd_event(${codigo},0,0,[System.IntPtr]::Zero)`,
    `  [G.T]::keybd_event(${codigo},0,2,[System.IntPtr]::Zero)`,
    '  Start-Sleep -Milliseconds 40',
    '}',
  ].join('\n');

  spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', guion], {
    windowsHide: true,
    detached: true,
    stdio: 'ignore',
  }).unref();
}

function abrirPrograma(nombre) {
  const entrada = PROGRAMAS[nombre];
  if (!entrada) throw new Error(`No conozco el programa "${nombre}".`);
  if (entrada.tipo === 'url') return shell.openExternal(entrada.valor);
  // El nombre sale del mapa de arriba, nunca del texto del usuario, así que no
  // hay forma de colar otra cosa en la línea de comandos.
  spawn('cmd', ['/c', 'start', '', entrada.valor], {
    windowsHide: true,
    detached: true,
    stdio: 'ignore',
  }).unref();
  return undefined;
}

function abrirCarpeta(nombre) {
  const clave = CARPETAS[nombre];
  if (!clave) throw new Error(`No conozco la carpeta "${nombre}".`);
  return shell.openPath(app.getPath(clave));
}

function abrirWeb(url) {
  let destino;
  try {
    destino = new URL(url);
  } catch {
    throw new Error('Esa dirección no es válida.');
  }
  // Solo http(s): sin esto, un "abre esto" podría lanzar un file:// o un
  // protocolo registrado por otro programa.
  if (destino.protocol !== 'http:' && destino.protocol !== 'https:') {
    throw new Error('Solo puedo abrir direcciones web.');
  }
  return shell.openExternal(destino.toString());
}

function buscarEnGoogle(texto) {
  return shell.openExternal(`https://www.google.com/search?q=${encodeURIComponent(texto)}`);
}

function bloquear() {
  if (process.platform !== 'win32') throw new Error('Solo disponible en Windows.');
  spawn('rundll32.exe', ['user32.dll,LockWorkStation'], { windowsHide: true, detached: true, stdio: 'ignore' }).unref();
}

/** Apagar y reiniciar siempre preguntan: son irreversibles y cuestan trabajo perdido. */
async function apagarOReiniciar(que, ventana) {
  if (process.platform !== 'win32') throw new Error('Solo disponible en Windows.');
  const esApagar = que === 'apagar';
  const { response } = await dialog.showMessageBox(ventana ?? undefined, {
    type: 'warning',
    buttons: ['Cancelar', esApagar ? 'Apagar' : 'Reiniciar'],
    defaultId: 0,
    cancelId: 0,
    title: 'Gaby',
    message: esApagar ? '¿Apagar el computador?' : '¿Reiniciar el computador?',
    detail: 'Se cerrará todo lo que tengas abierto. Guarda tu trabajo antes de continuar.',
  });
  if (response !== 1) return { cancelado: true };
  spawn('shutdown', [esApagar ? '/s' : '/r', '/t', '20'], { windowsHide: true, detached: true, stdio: 'ignore' }).unref();
  return { programado: true };
}

/**
 * Cada entrada recibe los argumentos ya validados por main.js y devuelve lo que
 * haya que contarle al usuario. Añadir una capacidad nueva es añadir una fila.
 */
const ACCIONES = {
  abrirPrograma: ({ nombre }) => abrirPrograma(String(nombre)),
  abrirCarpeta: ({ nombre }) => abrirCarpeta(String(nombre)),
  abrirWeb: ({ url }) => abrirWeb(String(url)),
  buscar: ({ texto }) => buscarEnGoogle(String(texto)),

  reproducir: () => pulsarTecla(TECLAS.reproducir),
  pausar: () => pulsarTecla(TECLAS.reproducir),
  siguiente: () => pulsarTecla(TECLAS.siguiente),
  anterior: () => pulsarTecla(TECLAS.anterior),

  // Cada pulsación mueve el volumen un 2 %; los pasos hacen que "sube el
  // volumen" se note sin dejarlo al máximo de golpe.
  subirVolumen: ({ pasos }) => pulsarTecla(TECLAS.subir, Math.min(20, Math.max(1, Number(pasos) || 5))),
  bajarVolumen: ({ pasos }) => pulsarTecla(TECLAS.bajar, Math.min(20, Math.max(1, Number(pasos) || 5))),
  silenciar: () => pulsarTecla(TECLAS.silenciar),

  bloquear: () => bloquear(),
  apagar: (_args, ventana) => apagarOReiniciar('apagar', ventana),
  reiniciar: (_args, ventana) => apagarOReiniciar('reiniciar', ventana),
};

module.exports = { ACCIONES, PROGRAMAS, CARPETAS };
