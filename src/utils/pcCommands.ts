/**
 * Reconoce las órdenes que se resuelven en el computador mismo, sin pasar por
 * el asistente: abrir un programa, subir el volumen, bloquear la pantalla.
 *
 * Se hace aquí y no en el modelo por dos razones. Son instantáneas —esperar una
 * respuesta de red para subir el volumen se nota—, y son las órdenes donde
 * equivocarse cuesta caro, así que conviene que dependan de reglas que se
 * pueden leer y probar, no de una interpretación.
 *
 * Solo funcionan dentro del programa de escritorio, que es quien expone
 * window.gabyPC. En un navegador normal esta función no llega a llamarse.
 */

export interface ComandoPC {
  accion: string;
  args: Record<string, unknown>;
  /** Lo que Gaby contesta al hacerlo. */
  respuesta: string;
}

/** Nombres con que uno llama a los programas, en el orden en que se prueban. */
const PROGRAMAS: Array<[RegExp, string, string]> = [
  [/\b(chrome|el navegador|google chrome)\b/, 'chrome', 'Chrome'],
  [/\b(edge|microsoft edge)\b/, 'edge', 'Edge'],
  [/\b(spotify)\b/, 'spotify', 'Spotify'],
  [/\b(whats?app)\b/, 'whatsapp', 'WhatsApp'],
  [/\b(el explorador|explorador de archivos|mis archivos)\b/, 'explorador', 'el explorador'],
  [/\b(bloc de notas|notepad)\b/, 'bloc', 'el bloc de notas'],
  [/\b(la calculadora|calculadora)\b/, 'calculadora', 'la calculadora'],
  [/\b(word)\b/, 'word', 'Word'],
  [/\b(excel)\b/, 'excel', 'Excel'],
  [/\b(visual studio code|vs code|vscode)\b/, 'vscode', 'VS Code'],
  [/\b(la terminal|terminal|powershell)\b/, 'terminal', 'la terminal'],
  [/\b(la configuraci[oó]n|configuraci[oó]n|ajustes)\b/, 'configuracion', 'la configuración'],
  [/\b(el correo|gmail|mi correo)\b/, 'correo', 'el correo'],
  [/\b(el calendario|calendar)\b/, 'calendario', 'el calendario'],
];

const CARPETAS: Array<[RegExp, string, string]> = [
  [/\b(descargas)\b/, 'descargas', 'Descargas'],
  [/\b(documentos)\b/, 'documentos', 'Documentos'],
  [/\b(el escritorio|escritorio)\b/, 'escritorio', 'el Escritorio'],
  [/\b(im[aá]genes|fotos)\b/, 'imagenes', 'Imágenes'],
  [/\b(m[uú]sica)\b/, 'musica', 'Música'],
  [/\b(videos|v[ií]deos)\b/, 'videos', 'Vídeos'],
];

/**
 * Quita tildes y signos para que "súbeme" y "subeme" se traten igual.
 *
 * El punto se conserva a propósito: separa los dominios ("youtube.com" no puede
 * volverse "youtube com" o deja de parecer una dirección). Solo se recorta el
 * punto final de la frase, que sí sobra.
 */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/, '');
}

/** "sube mucho el volumen" mueve más que "sube el volumen". */
function pasosDeVolumen(t: string): number {
  if (/\b(mucho|bastante|al maximo|todo)\b/.test(t)) return 12;
  if (/\b(un poco|poquito|poco|algo)\b/.test(t)) return 2;
  return 5;
}

export function interpretarComandoPC(texto: string): ComandoPC | null {
  const t = normalizar(texto);

  // --- Dictarle a Claude Code ---
  // Va lo primero: la tarea es texto libre y puede contener cualquiera de las
  // palabras de abajo ("Claude, sube el volumen del reproductor" es una tarea de
  // programación, no una orden de volumen).
  //
  // Se busca sobre el texto original y no sobre el normalizado porque la tarea
  // se le pasa tal cual a Claude Code: con sus tildes y su puntuación, no
  // aplanada. Se aceptan "cloud" y "clod" porque es lo que suele entender la
  // transcripción cuando uno dice "Claude" en español.
  const claude =
    /^\s*(?:oye\s+|hey\s+)?(?:claude|cloud|clod)\s*[,:]?\s+(.+)$/i.exec(texto) ??
    /\b(?:dile|d[ií]le|p[ií]dele)\s+a\s+(?:claude|cloud|clod)\s+que\s+(.+)$/i.exec(texto);
  if (claude && claude[1].trim().length > 3) {
    return {
      accion: 'claudeCode',
      args: { tarea: claude[1].trim() },
      respuesta: 'Se lo paso a Claude Code.',
    };
  }

  // --- Volumen ---
  if (/\b(silencia|silenciar|mutea|quita el sonido|sin sonido)\b/.test(t)) {
    return { accion: 'silenciar', args: {}, respuesta: 'Listo, silenciado.' };
  }
  // sub\w* cubre sube, súbeme, súbele, subir, subime — la gente conjuga de todo.
  if (/\b(sub[ei]\w*|aumenta\w*|mas)\b.*\b(volumen|sonido)\b/.test(t)) {
    return { accion: 'subirVolumen', args: { pasos: pasosDeVolumen(t) }, respuesta: 'Subiendo el volumen.' };
  }
  if (/\b(baj[ae]\w*|reduce\w*|disminuye\w*|menos)\b.*\b(volumen|sonido)\b/.test(t)) {
    return { accion: 'bajarVolumen', args: { pasos: pasosDeVolumen(t) }, respuesta: 'Bajando el volumen.' };
  }

  // --- Música y reproducción ---
  // Va antes que "abrir", porque "pon música" no es abrir una carpeta llamada música.
  if (/\b(siguiente|proxima|otra)\b.*\b(cancion|tema|pista)\b|\bsiguiente cancion\b|\bpasa la cancion\b/.test(t)) {
    return { accion: 'siguiente', args: {}, respuesta: 'Siguiente.' };
  }
  if (/\b(anterior|previa)\b.*\b(cancion|tema|pista)\b|\bcancion anterior\b|\bregresa la cancion\b/.test(t)) {
    return { accion: 'anterior', args: {}, respuesta: 'La anterior.' };
  }
  if (/\b(pausa|pausar|para|detén|deten|detener)\b.*\b(musica|cancion|reproduccion|video)\b|\bpausa\b$|\bpausala\b/.test(t)) {
    return { accion: 'pausar', args: {}, respuesta: 'Pausado.' };
  }
  if (/\b(pon|ponme|reproduce|dale play|play|continua|sigue)\b.*\b(musica|cancion|algo de musica)\b|\bpon musica\b/.test(t)) {
    return { accion: 'reproducir', args: {}, respuesta: 'Dale.' };
  }

  // --- Sistema ---
  if (/\b(bloquea|bloquear|bloquea la pantalla|bloquea el computador|cierra sesion)\b/.test(t)) {
    return { accion: 'bloquear', args: {}, respuesta: 'Bloqueando.' };
  }
  if (/\b(apaga|apagar)\b.*\b(computador|pc|equipo|maquina)\b/.test(t)) {
    return { accion: 'apagar', args: {}, respuesta: 'Te pregunto antes de apagar.' };
  }
  if (/\b(reinicia|reiniciar)\b.*\b(computador|pc|equipo|maquina)\b/.test(t)) {
    return { accion: 'reiniciar', args: {}, respuesta: 'Te pregunto antes de reiniciar.' };
  }

  // --- Buscar en Google ---
  const busqueda = t.match(/\b(busca|buscar|buscame|googlea)\b\s+(.+?)(?:\s+en google)?$/);
  if (busqueda?.[2]) {
    return {
      accion: 'buscar',
      args: { texto: busqueda[2] },
      respuesta: `Buscando ${busqueda[2]}.`,
    };
  }

  // --- Abrir cosas ---
  if (/\b(abre|abrir|abreme|lanza|inicia|ejecuta)\b/.test(t)) {
    for (const [patron, nombre, comoSeLlama] of PROGRAMAS) {
      if (patron.test(t)) {
        return { accion: 'abrirPrograma', args: { nombre }, respuesta: `Abriendo ${comoSeLlama}.` };
      }
    }
    for (const [patron, nombre, comoSeLlama] of CARPETAS) {
      // "la carpeta de música" sí es una carpeta; "pon música" ya se resolvió arriba.
      if (/\b(carpeta|archivos)\b/.test(t) && patron.test(t)) {
        return { accion: 'abrirCarpeta', args: { nombre }, respuesta: `Abriendo ${comoSeLlama}.` };
      }
    }

    const sitio = t.match(/\b(?:abre|abrir|abreme)\b\s+(?:la\s+)?(?:pagina\s+|web\s+|sitio\s+)?([a-z0-9-]+\.[a-z]{2,}(?:\/\S*)?)/);
    if (sitio?.[1]) {
      return {
        accion: 'abrirWeb',
        args: { url: `https://${sitio[1]}` },
        respuesta: `Abriendo ${sitio[1]}.`,
      };
    }
  }

  return null;
}
