import * as chrono from 'chrono-node';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DocumentReference } from 'firebase-admin/firestore';

/**
 * Router "nativo" (sin IA) para las tareas breves y frecuentes de Gaby: agendar,
 * revisar y cancelar citas, y guardar notas.
 *
 * Es el mismo router que la app web tenía del lado del cliente
 * (src/services/localAssistant.ts), movido aquí para que funcione igual desde
 * cualquier cliente: la app de iOS y el Stack-chan hablan con deviceCommand y
 * antes se saltaban este camino por completo — pedirle "agéndame el martes"
 * desde el teléfono solo conversaba, sin crear nada.
 *
 * Reconoce frases comunes en español por patrones de texto, no cualquier forma
 * de decirlo. Si no reconoce la intención devuelve handled:false, y quien llama
 * manda el mensaje a OpenAI.
 */

export interface RouterResult {
  handled: boolean;
  reply?: string;
}

interface Cita {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
}

// Al añadirle el pronombre, el verbo se acentúa ("cancela" → "cancélame"), así
// que cada patrón acepta las dos formas. Sin esto, justamente las frases con
// pronombre —las más naturales al hablarle— no se reconocían.
const DELETE_RE = /\b(canc[eé]la(?:me)?|elim[ií]na(?:me)?|b[oó]rra(?:me)?|qu[ií]ta(?:me)?)\b/i;
const LIST_RE = /\b(qu[eé] tengo|mis citas|mu[eé]strame|revisa mi agenda|mi agenda|qu[eé] hay agendado|qu[eé] citas tengo)\b/i;
const CREATE_RE = /\b(ag[eé]nd[ae](?:me)?|progr[aá]ma(?:me)?|res[eé]rva(?:me)?)\b/i;
const NOTE_RE = /\b(ap[uú]nta(?:me)?|an[oó]ta(?:me)?|recu[eé]rdame|gu[aá]rda(?:me)?)\b\s*(que\s+)?/i;

const FILLER_WORDS = /^(una|un|la|el)\s+(cita|reunión|reunion)\s+(con|de|para|del|de la)\s+|^(con|de|para|del|de la)\s+/i;

/** Restos que quedan al recortar la fecha: "Reunión con Ana el" → "Reunión con Ana". */
const TRAILING_WORDS = /\s+(el|la|los|las|de|del|a|en|para|por)$/i;

/** Minúsculas y sin acentos, para comparar sin importar tildes. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function elegir<T>(opciones: T[]): T {
  return opciones[Math.floor(Math.random() * opciones.length)];
}

function fechaEnEspanol(fecha: Date): string {
  return format(fecha, "EEEE d 'de' MMMM 'a las' h:mm a", { locale: es });
}

function extraerTitulo(texto: string, tramoFecha?: { index: number; text: string }): string {
  let resto = texto;
  if (tramoFecha) {
    resto = (texto.slice(0, tramoFecha.index) + ' ' + texto.slice(tramoFecha.index + tramoFecha.text.length)).trim();
  }
  resto = resto.replace(CREATE_RE, '').trim();
  resto = resto.replace(FILLER_WORDS, '').trim();
  resto = resto.replace(/\s{2,}/g, ' ').trim();
  // Se repite porque suelen quedar dos seguidas ("... con Ana el de" → "... con Ana").
  while (TRAILING_WORDS.test(resto)) resto = resto.replace(TRAILING_WORDS, '');
  return resto ? resto.charAt(0).toUpperCase() + resto.slice(1) : 'Reunión';
}

async function leerCitas(workspaceRef: DocumentReference): Promise<Cita[]> {
  const snap = await workspaceRef.collection('appointments').get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: String(data.title ?? ''),
      startTime: Number(data.startTime ?? 0),
      endTime: Number(data.endTime ?? 0),
    };
  });
}

async function cancelar(texto: string, workspaceRef: DocumentReference): Promise<RouterResult> {
  let termino = texto.replace(DELETE_RE, '').trim().replace(FILLER_WORDS, '').trim();
  termino = termino.replace(/\b(la|el)\s+(cita|reunión|reunion)\b/gi, '').trim();
  if (!termino) {
    return { handled: true, reply: '¿Cuál cita quieres que elimine? Dime con quién es o su título.' };
  }

  const aguja = normalizar(termino);
  const coincidencias = (await leerCitas(workspaceRef)).filter((c) => normalizar(c.title).includes(aguja));

  if (coincidencias.length === 0) {
    return { handled: true, reply: `No encontré ninguna cita que coincida con "${termino}". ¿Puedes darme más detalles?` };
  }
  if (coincidencias.length > 1) {
    const lista = coincidencias.map((c) => `"${c.title}" (${fechaEnEspanol(new Date(c.startTime))})`).join(', ');
    return { handled: true, reply: `Encontré varias citas parecidas: ${lista}. Dime cuál en específico.` };
  }

  await workspaceRef.collection('appointments').doc(coincidencias[0].id).delete();
  return {
    handled: true,
    reply: elegir([
      `Listo, eliminé la cita "${coincidencias[0].title}".`,
      `Hecho, borré "${coincidencias[0].title}" del calendario.`,
    ]),
  };
}

async function listar(workspaceRef: DocumentReference): Promise<RouterResult> {
  const proximas = (await leerCitas(workspaceRef))
    .filter((c) => c.endTime >= Date.now())
    .sort((a, b) => a.startTime - b.startTime);

  if (proximas.length === 0) {
    return { handled: true, reply: 'No tienes citas agendadas por ahora.' };
  }
  const lista = proximas
    .slice(0, 6)
    .map((c) => `"${c.title}" el ${fechaEnEspanol(new Date(c.startTime))}`)
    .join('; ');
  return {
    handled: true,
    reply: `Tienes ${proximas.length} cita${proximas.length === 1 ? '' : 's'}: ${lista}.`,
  };
}

/**
 * chrono no interpreta "de la tarde/noche" como PM: "mañana a las 3 de la
 * tarde" lo entendía como las 3:00 AM — doce horas antes de la cita real. Se
 * traducen a am/pm antes de analizarlo.
 *
 * "de la mañana" se maneja aparte de "mañana" a secas, que significa el día
 * siguiente y debe quedar intacto.
 */
function marcarAmPm(texto: string): string {
  return texto
    .replace(/\bde la mañana\b/gi, 'am')
    .replace(/\bde la (tarde|noche)\b/gi, 'pm')
    .replace(/\bdel mediod[ií]a\b/gi, 'pm');
}

async function agendar(texto: string, workspaceRef: DocumentReference, createdBy: string): Promise<RouterResult> {
  // El título se recorta sobre el mismo texto que se analizó: los índices que
  // devuelve chrono son de ese texto, y usarlos contra el original cortaría por
  // donde no es.
  const textoFecha = marcarAmPm(texto);
  // forwardDate: al agendar, un día suelto ("el lunes") siempre es el próximo.
  // Sin esto chrono resolvía al lunes que ya pasó y la cita nacía vencida.
  const resultados = chrono.es.parse(textoFecha, new Date(), { forwardDate: true });
  const primero = resultados[0];
  const titulo = extraerTitulo(textoFecha, primero ? { index: primero.index, text: primero.text } : undefined);

  if (!primero) {
    return {
      handled: true,
      reply: `¿Para cuándo quieres que agende "${titulo}"? Dime el día y la hora en el mismo mensaje.`,
    };
  }

  const inicio = primero.start.date();
  const fin = primero.end ? primero.end.date() : new Date(inicio.getTime() + 60 * 60 * 1000);

  await workspaceRef.collection('appointments').add({
    title: titulo,
    description: '',
    location: '',
    startTime: inicio.getTime(),
    endTime: fin.getTime(),
    createdBy,
    createdAt: Date.now(),
    googleEventIds: {},
  });

  return {
    handled: true,
    reply: elegir([
      `Listo, agendé "${titulo}" para el ${fechaEnEspanol(inicio)}.`,
      `Hecho — quedó "${titulo}" en el calendario para el ${fechaEnEspanol(inicio)}.`,
      `Anotado en el calendario: "${titulo}" el ${fechaEnEspanol(inicio)}.`,
    ]),
  };
}

async function anotar(texto: string, workspaceRef: DocumentReference, createdBy: string): Promise<RouterResult> {
  const contenido = texto.replace(NOTE_RE, '').trim();
  if (!contenido) {
    return { handled: true, reply: '¿Qué quieres que anote?' };
  }
  const titulo = contenido.length > 40 ? contenido.slice(0, 40).trim() + '…' : contenido;

  await workspaceRef.collection('voiceNotes').add({
    title: titulo,
    audioPath: '',
    audioUrl: null,
    transcript: contenido,
    status: 'done',
    durationMillis: 0,
    createdBy,
    createdAt: Date.now(),
  });

  return {
    handled: true,
    reply: elegir([`Anotado: "${contenido}".`, 'Listo, lo guardé como nota.', `Hecho, quedó guardado: "${contenido}".`]),
  };
}

export async function tryHandleCommand(
  texto: string,
  workspaceRef: DocumentReference,
  createdBy: string,
): Promise<RouterResult> {
  const limpio = texto.trim();
  if (!limpio) return { handled: false };

  // Los verbos explícitos van primero, y listar de último por ser el patrón más
  // laxo: "anota que tengo que comprar leche" contiene "que tengo" y se
  // interpretaba como "¿qué tengo?", así que listaba citas en vez de anotar.
  if (DELETE_RE.test(limpio)) return cancelar(limpio, workspaceRef);
  if (CREATE_RE.test(limpio)) return agendar(limpio, workspaceRef, createdBy);
  if (NOTE_RE.test(limpio)) return anotar(limpio, workspaceRef, createdBy);
  if (LIST_RE.test(limpio)) return listar(workspaceRef);

  return { handled: false };
}
