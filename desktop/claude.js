const { BrowserWindow, dialog } = require('electron');
const { execFile, spawn } = require('node:child_process');

/**
 * Dictarle tareas de programación a Claude Code por voz.
 *
 * Claude Code se lanza en modo no interactivo (-p) dentro de la carpeta del
 * proyecto que se haya elegido, y lo que responde se muestra en una ventana y
 * se resume en voz alta.
 *
 * Tres decisiones que no son de comodidad sino de seguridad:
 *
 * 1. Claude Code corre en modo plan: lee el proyecto y propone, pero no escribe
 *    nada. Esto es voz dictando cambios de código, y la cadena entera —micrófono,
 *    transcripción, interpretación— puede equivocarse en cualquier eslabón. Que
 *    lo propuesto pase a los archivos es una decisión aparte, tuya, mirando el
 *    plan.
 * 2. Siempre se pide confirmación antes de lanzar, con el texto exacto que se
 *    entendió a la vista: así se ve si la transcripción salió mal antes de
 *    gastar varios minutos en la tarea equivocada.
 * 3. La carpeta se elige a mano desde el menú de la bandeja y queda guardada.
 *    No se deduce de lo que se dijo: "trabaja en el proyecto de la tienda" no
 *    debería poder apuntar a cualquier sitio del disco.
 */

/** Más de esto y se da por colgado. Una tarea de programación puede tardar. */
const LIMITE_MS = 10 * 60 * 1000;

/**
 * Si el proyecto está en git, se dice en la confirmación.
 *
 * En modo plan no se escribe nada, así que esto es informativo. Sigue estando
 * porque el día que se permita aplicar los cambios, git es lo que separa un
 * error recuperable (`git diff`, `git checkout`) de uno que no lo es — y ahí
 * dejará de ser un aviso para ser un requisito.
 */
function estadoDeGit(carpeta) {
  return new Promise((resolve) => {
    execFile('git', ['status', '--porcelain'], { cwd: carpeta }, (error, stdout) => {
      if (error) {
        resolve({ esRepo: false });
        return;
      }
      resolve({ esRepo: true, limpio: stdout.trim().length === 0 });
    });
  });
}

/** Lo que se dice en voz alta: el resto se lee en la ventana. */
const MAXIMO_HABLADO = 320;

function resumir(texto) {
  const limpio = texto.trim().replace(/\s+/g, ' ');
  if (limpio.length <= MAXIMO_HABLADO) return limpio;
  // Se corta en el último punto que quepa, para no dejar una frase a medias.
  const recorte = limpio.slice(0, MAXIMO_HABLADO);
  const punto = recorte.lastIndexOf('. ');
  return punto > 80 ? recorte.slice(0, punto + 1) : `${recorte}…`;
}

/** Ventana simple para leer la respuesta completa, que suele ser larga. */
function mostrarResultado(tarea, salida) {
  const ventana = new BrowserWindow({
    width: 860,
    height: 640,
    backgroundColor: '#03060f',
    title: 'Claude Code',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  ventana.setMenuBarVisibility(false);

  const escapar = (t) =>
    String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

  // Se carga como data: URL y no como archivo porque es contenido de un solo
  // uso; y el texto va escapado porque la salida de Claude trae código.
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<style>
  body { margin:0; padding:28px 32px; background:#03060f; color:#E6EAF5;
         font:14px/1.6 system-ui, sans-serif; }
  h1 { font-size:13px; letter-spacing:2px; color:#7DD3FC; text-transform:uppercase; margin:0 0 6px; }
  .tarea { color:#94A3B8; margin:0 0 24px; }
  pre { white-space:pre-wrap; word-wrap:break-word; font:13px/1.65 ui-monospace, monospace; margin:0; }
</style></head><body>
<h1>Le pediste</h1><p class="tarea">${escapar(tarea)}</p>
<h1>Claude Code respondió</h1><pre>${escapar(salida)}</pre>
</body></html>`;

  ventana.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return ventana;
}

/**
 * @param {string} tarea  Lo que se entendió por el micrófono.
 * @param {string} carpeta  Carpeta del proyecto, elegida desde la bandeja.
 * @param {BrowserWindow} [padre]  Para que el diálogo salga sobre la app.
 */
async function ejecutarTarea(tarea, carpeta, padre) {
  if (!carpeta) {
    return {
      hablado:
        'Primero dime en qué proyecto. Elige la carpeta desde el icono de Gaby, en la bandeja.',
    };
  }

  const git = await estadoDeGit(carpeta);
  const nota = git.esRepo ? '' : '\n\n(Esa carpeta no está en git.)';

  const { response } = await dialog.showMessageBox(padre ?? undefined, {
    type: 'question',
    buttons: ['Cancelar', 'Dale'],
    defaultId: 1,
    cancelId: 0,
    title: 'Gaby → Claude Code',
    message: '¿Le paso esto a Claude Code?',
    detail:
      `"${tarea}"\n\nEn: ${carpeta}\n\n` +
      `Va a leer el proyecto y proponerte un plan. No modifica archivos.${nota}`,
  });
  if (response !== 1) return { hablado: 'Listo, no le mando nada.' };

  const salida = await new Promise((resolve) => {
    // --permission-mode plan: lee y propone, no escribe. Ver la cabecera.
    // --permission-prompts none: sin esto, cualquier cosa que normalmente
    // preguntaría se quedaría esperando una respuesta que aquí no hay nadie
    // para dar, y el proceso colgaría hasta agotar el límite de tiempo.
    const proceso = spawn(
      'claude',
      [
        '-p',
        tarea,
        '--output-format',
        'json',
        '--permission-mode',
        'plan',
        '--permission-prompts',
        'none',
      ],
      { cwd: carpeta, windowsHide: true, shell: process.platform === 'win32' },
    );

    let stdout = '';
    let stderr = '';
    proceso.stdout.on('data', (d) => {
      stdout += d;
    });
    proceso.stderr.on('data', (d) => {
      stderr += d;
    });

    const reloj = setTimeout(() => {
      proceso.kill();
      resolve({ error: 'Claude Code tardó más de diez minutos y lo detuve.' });
    }, LIMITE_MS);

    proceso.on('error', (e) => {
      clearTimeout(reloj);
      resolve({
        error:
          e.code === 'ENOENT'
            ? 'No encuentro Claude Code en este computador. Se instala con: npm install -g @anthropic-ai/claude-code'
            : `No pude lanzar Claude Code: ${e.message}`,
      });
    });

    proceso.on('close', (codigo) => {
      clearTimeout(reloj);
      if (codigo !== 0 && !stdout.trim()) {
        resolve({ error: stderr.trim() || `Claude Code terminó con el código ${codigo}.` });
        return;
      }
      try {
        // --output-format json devuelve un objeto con el texto en `result`.
        const datos = JSON.parse(stdout);
        resolve({ texto: String(datos.result ?? stdout) });
      } catch {
        // Si algún día cambia el formato, mejor enseñar la salida en crudo que
        // perderla por no saber interpretarla.
        resolve({ texto: stdout.trim() });
      }
    });
  });

  if (salida.error) {
    mostrarResultado(tarea, salida.error);
    return { hablado: salida.error };
  }

  mostrarResultado(tarea, salida.texto);
  return { hablado: resumir(salida.texto) };
}

module.exports = { ejecutarTarea };
