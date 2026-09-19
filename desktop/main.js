const { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, net, protocol, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ACCIONES } = require('./acciones');
const { ejecutarTarea } = require('./claude');

/**
 * Gaby en el escritorio: el orbe flotando siempre encima de las demás ventanas,
 * y la app completa a un clic.
 *
 * La PWA del navegador no puede hacer esto — no puede quedar por encima de todo
 * ni tener el fondo transparente —, así que la ventana la crea Electron. El
 * orbe en sí es el mismo archivo que usa el visor de iOS: se copia al empaquetar
 * (ver copiar-orbe.mjs) para no tener dos versiones del mismo dibujo.
 */

const URL_GABY = process.env.GABY_URL ?? 'https://gaby-c76cf.web.app';
const LADO = 200;

/**
 * El orbe se sirve por un esquema propio en vez de abrir el archivo directo.
 *
 * Su dibujo es un módulo de JavaScript que importa Three.js, y Chromium bloquea
 * los módulos cargados desde file:// por política de origen cruzado: el archivo
 * abre, pero el script nunca corre y la ventana queda vacía. Un esquema propio
 * marcado como estándar y seguro sí los permite.
 */
const ESQUEMA = 'gaby';

protocol.registerSchemesAsPrivileged([
  {
    scheme: ESQUEMA,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

function servirOrbe() {
  const raiz = path.join(__dirname, 'orbe');

  protocol.handle(ESQUEMA, (peticion) => {
    const relativa = decodeURIComponent(new URL(peticion.url).pathname);
    const destino = path.join(raiz, relativa);

    // Sin esta comprobación, una ruta con '..' serviría cualquier archivo del
    // disco a través del esquema.
    if (destino !== raiz && !destino.startsWith(raiz + path.sep)) {
      return new Response('No encontrado', { status: 404 });
    }
    return net.fetch(pathToFileURL(destino).toString());
  });
}

let ventanaOrbe = null;
let ventanaApp = null;
let bandeja = null;

/** La posición del orbe se recuerda entre sesiones: moverlo cada vez molesta. */
function rutaEstado() {
  return path.join(app.getPath('userData'), 'estado.json');
}

function leerEstado() {
  try {
    return JSON.parse(fs.readFileSync(rutaEstado(), 'utf8'));
  } catch {
    // Primera vez, o el archivo quedó a medio escribir: se empieza de cero.
    return {};
  }
}

function guardarEstado(cambios) {
  try {
    fs.writeFileSync(rutaEstado(), JSON.stringify({ ...leerEstado(), ...cambios }));
  } catch {
    // Que no se pueda recordar la posición no es motivo para tumbar la app.
  }
}

/** Por defecto abajo a la derecha, sobre el área usable (sin tapar la barra de tareas). */
function posicionInicial() {
  const { x, y } = leerEstado();
  if (typeof x === 'number' && typeof y === 'number') {
    // Si cambió el monitor, una posición vieja puede caer fuera de la pantalla.
    const visible = screen.getAllDisplays().some((d) => {
      const a = d.workArea;
      return x >= a.x - LADO && x <= a.x + a.width && y >= a.y - LADO && y <= a.y + a.height;
    });
    if (visible) return { x, y };
  }
  const area = screen.getPrimaryDisplay().workArea;
  return { x: area.x + area.width - LADO - 24, y: area.y + area.height - LADO - 24 };
}

function crearOrbe() {
  const { x, y } = posicionInicial();

  ventanaOrbe = new BrowserWindow({
    width: LADO,
    height: LADO,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    // Fuera de la barra de tareas y del Alt+Tab: es un adorno vivo, no una
    // ventana que uno quiera seleccionar.
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 'screen-saver' es el nivel más alto: mantiene el orbe visible incluso sobre
  // aplicaciones a pantalla completa, que es donde un 'floating' normal se pierde.
  ventanaOrbe.setAlwaysOnTop(true, 'screen-saver');
  ventanaOrbe.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  ventanaOrbe.loadURL(`${ESQUEMA}://orbe/index.html`);

  ventanaOrbe.on('moved', () => {
    const [nx, ny] = ventanaOrbe.getPosition();
    guardarEstado({ x: nx, y: ny });
  });

  ventanaOrbe.on('closed', () => {
    ventanaOrbe = null;
  });
}

/**
 * La ventana de la app, que puede existir sin verse.
 *
 * Quien oye el aplauso es el orbe, pero grabar y transcribir sigue siendo cosa
 * de esta ventana: es la que tiene la sesión iniciada contra Firebase. Así que
 * al aplaudir se crea escondida si no existía, hace el trabajo y no aparece
 * nunca — hablarle a Gaby no debería abrir una ventana.
 */
function crearApp({ visible }) {
  ventanaApp = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 380,
    show: visible,
    backgroundColor: '#03060f',
    title: 'Gaby',
    icon: path.join(__dirname, 'icono.png'),
    webPreferences: {
      // Sin esto, Chromium ralentiza los temporizadores de una ventana que no
      // se ve, y la detección de silencio dejaría de funcionar justo cuando la
      // ventana está escondida, que es el caso normal aquí.
      backgroundThrottling: false,
      // Le da a la app el puente para manejar el computador. Va aislado y sin
      // Node en la página: lo único que cruza es pedir una acción del catálogo.
      preload: path.join(__dirname, 'preload-app.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  ventanaApp.setMenuBarVisibility(false);
  ventanaApp.loadURL(URL_GABY);
  ventanaApp.on('closed', () => {
    ventanaApp = null;
  });
}

/** Trae la app al frente, creándola si hace falta. */
function abrirGaby() {
  if (!ventanaApp || ventanaApp.isDestroyed()) {
    crearApp({ visible: true });
    return;
  }
  if (ventanaApp.isMinimized()) ventanaApp.restore();
  ventanaApp.show();
  ventanaApp.focus();
}

/** Se asegura de que exista, sin sacarla a la vista si estaba escondida. */
function asegurarApp() {
  if (!ventanaApp || ventanaApp.isDestroyed()) crearApp({ visible: false });
  return ventanaApp;
}

function alternarOrbe() {
  if (!ventanaOrbe) {
    crearOrbe();
    return;
  }
  if (ventanaOrbe.isVisible()) ventanaOrbe.hide();
  else ventanaOrbe.show();
}

function centrarOrbe() {
  if (!ventanaOrbe) return;
  const area = screen.getPrimaryDisplay().workArea;
  const x = Math.round(area.x + (area.width - LADO) / 2);
  const y = Math.round(area.y + (area.height - LADO) / 2);
  ventanaOrbe.setPosition(x, y);
  ventanaOrbe.show();
  guardarEstado({ x, y });
}

/**
 * Atiende las peticiones del puente: comprueba quién llama y qué pide, y solo
 * entonces ejecuta.
 *
 * La comprobación de origen es la que sostiene todo esto. El preload viaja con
 * una ventana que carga una página de internet; si esa página fuese sustituida
 * por otra (una redirección, un enlace que lleve fuera), seguiría teniendo el
 * puente delante. Exigiendo que quien pide sea exactamente el origen de Gaby,
 * cualquier otra página se queda sin él.
 */
async function manejarAccion(evento, carga) {
  try {
    const origenEsperado = new URL(URL_GABY).origin;
    const origenReal = new URL(evento.senderFrame?.url ?? '').origin;
    if (origenReal !== origenEsperado) {
      return { ok: false, error: 'Petición desde un origen no autorizado.' };
    }

    const { accion, args } = carga ?? {};

    // Dictarle a Claude Code no vive en el catálogo porque necesita algo que
    // solo conoce este proceso: la carpeta del proyecto que se eligió desde la
    // bandeja. Deducirla de lo que se dijo sería justo lo que no se quiere.
    if (accion === 'claudeCode') {
      const tarea = String(args?.tarea ?? '').trim();
      if (!tarea) return { ok: false, error: 'No entendí qué tarea pasarle.' };
      const resultado = await ejecutarTarea(tarea, leerEstado().carpetaProyecto, ventanaApp);
      return { ok: true, resultado };
    }

    // Object.hasOwn y no un acceso directo: 'constructor' o '__proto__' son
    // propiedades de cualquier objeto y no son acciones.
    if (typeof accion !== 'string' || !Object.hasOwn(ACCIONES, accion)) {
      return { ok: false, error: `No sé hacer "${accion}".` };
    }

    const resultado = await ACCIONES[accion](args ?? {}, ventanaApp);
    return { ok: true, resultado: resultado ?? null };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function construirMenu() {
  return Menu.buildFromTemplate([
    { label: 'Abrir Gaby', click: abrirGaby },
    { type: 'separator' },
    {
      label: 'Mostrar el orbe',
      type: 'checkbox',
      checked: Boolean(ventanaOrbe?.isVisible()),
      click: alternarOrbe,
    },
    { label: 'Traerlo al centro', click: centrarOrbe },
    { type: 'separator' },
    {
      label: carpetaProyecto()
        ? `Proyecto: ${path.basename(carpetaProyecto())}`
        : 'Elegir la carpeta del proyecto…',
      click: elegirProyecto,
    },
    {
      // Para poder ver el motivo cuando el orbe no se dibuje, sin tener que
      // compilar una versión aparte solo para mirar la consola.
      label: 'Ver la consola del orbe',
      click: () => ventanaOrbe?.webContents.openDevTools({ mode: 'detach' }),
    },
    { type: 'separator' },
    {
      label: 'Iniciar con Windows',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { type: 'separator' },
    { label: 'Salir', click: () => app.quit() },
  ]);
}

/** La carpeta donde trabaja Claude Code. Se elige a mano y queda recordada. */
function carpetaProyecto() {
  return leerEstado().carpetaProyecto ?? '';
}

async function elegirProyecto() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Carpeta del proyecto para Claude Code',
    properties: ['openDirectory'],
    defaultPath: carpetaProyecto() || undefined,
  });
  if (canceled || !filePaths[0]) return;
  guardarEstado({ carpetaProyecto: filePaths[0] });
  // El menú lleva el nombre de la carpeta, así que hay que rehacerlo.
  bandeja?.setContextMenu(construirMenu());
}

function crearBandeja() {
  // El icono de origen es de 1024 px; en la bandeja hay que bajarlo o Windows
  // lo muestra recortado.
  const icono = nativeImage
    .createFromPath(path.join(__dirname, 'icono.png'))
    .resize({ width: 16, height: 16 });

  bandeja = new Tray(icono);
  bandeja.setToolTip('Gaby');
  bandeja.on('click', abrirGaby);
  // El menú se reconstruye en cada apertura para que las casillas reflejen el
  // estado real (si el orbe está a la vista, si arranca con Windows).
  bandeja.on('right-click', () => bandeja.popUpContextMenu(construirMenu()));
  bandeja.setContextMenu(construirMenu());
}

// Una sola instancia: abrir el acceso directo dos veces debe traer la que ya
// está corriendo, no dejar dos orbes encima del escritorio.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (ventanaOrbe) ventanaOrbe.show();
    else crearOrbe();
  });

  app.whenReady().then(() => {
    servirOrbe();
    crearOrbe();
    crearBandeja();
    ipcMain.on('abrir-gaby', abrirGaby);
    ipcMain.on('ocultar-orbe', () => ventanaOrbe?.hide());
    ipcMain.handle('gaby-pc', manejarAccion);

    // El orbe oyó el aplauso; la app es quien graba y transcribe. Si todavía no
    // existe se crea escondida: hablarle a Gaby no debería abrir una ventana.
    ipcMain.on('orbe-aplauso', () => {
      const app = asegurarApp();
      // Recién creada, la página aún no está lista para recibir el aviso.
      if (app.webContents.isLoading()) {
        app.webContents.once('did-finish-load', () => app.webContents.send('aplauso'));
      } else {
        app.webContents.send('aplauso');
      }
    });

    // La app cuenta en qué va, y el orbe lo muestra y deja de contar aplausos
    // mientras tanto: durante la conversación, lo que entra por el micrófono es
    // la conversación misma.
    ipcMain.on('gaby-estado', (_evento, estado) => {
      ventanaOrbe?.webContents.send('estado-gaby', estado ?? { fase: 'libre' });
    });
    ipcMain.on('gaby-pulso', () => ventanaOrbe?.webContents.send('pulso-habla'));
  });

  // A propósito no se cierra la app al cerrar las ventanas: Gaby vive en la
  // bandeja y se sale desde ahí.
  app.on('window-all-closed', () => {});
}
