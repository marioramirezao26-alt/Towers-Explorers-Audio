const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, net, protocol, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

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

function abrirGaby() {
  if (ventanaApp && !ventanaApp.isDestroyed()) {
    if (ventanaApp.isMinimized()) ventanaApp.restore();
    ventanaApp.focus();
    return;
  }

  ventanaApp = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 380,
    backgroundColor: '#03060f',
    title: 'Gaby',
    icon: path.join(__dirname, 'icono.png'),
  });
  ventanaApp.setMenuBarVisibility(false);
  ventanaApp.loadURL(URL_GABY);
  ventanaApp.on('closed', () => {
    ventanaApp = null;
  });
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
  });

  // A propósito no se cierra la app al cerrar las ventanas: Gaby vive en la
  // bandeja y se sale desde ahí.
  app.on('window-all-closed', () => {});
}
