import * as chrono from 'chrono-node';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { createAppointment, deleteAppointment, getAppointmentsOnce } from '@/services/appointments';
import { saveNoteText } from '@/services/voiceNotes';
import { normalizeText } from '@/utils/normalizeText';
import { Appointment } from '@/types';

interface Context {
  workspaceId: string;
  uid: string;
}

export interface LocalResult {
  handled: boolean;
  reply?: string;
}

const DELETE_RE = /\b(cancela(?:me)?|elimina(?:me)?|borra(?:me)?|quita(?:me)?)\b/i;
const LIST_RE = /\b(qu[eé] tengo|mis citas|mu[eé]strame|revisa mi agenda|mi agenda|qu[eé] hay agendado|qu[eé] citas tengo)\b/i;
const CREATE_RE = /\b(agend[ae](?:me)?|programa(?:me)?|reserva(?:me)?)\b/i;
const NOTE_RE = /\b(apunta(?:me)?|anota(?:me)?|recu[eé]rdame|guarda(?:me)?)\b\s*(que\s+)?/i;

const FILLER_WORDS = /^(una|un|la|el)\s+(cita|reunión|reunion)\s+(con|de|para)\s+|^(con|de|para)\s+/i;

function pick<T>(options: T[]): T {
  return options[Math.floor(Math.random() * options.length)];
}

function formatDateEs(date: Date): string {
  return format(date, "EEEE d 'de' MMMM 'a las' h:mm a", { locale: es });
}

function extractAppointmentTitle(text: string, dateSpan?: { index: number; text: string }): string {
  let rest = text;
  if (dateSpan) {
    rest = (text.slice(0, dateSpan.index) + ' ' + text.slice(dateSpan.index + dateSpan.text.length)).trim();
  }
  rest = rest.replace(CREATE_RE, '').trim();
  rest = rest.replace(FILLER_WORDS, '').trim();
  rest = rest.replace(/\s{2,}/g, ' ').trim();
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : 'Reunión';
}

function findMatchingAppointments(appointments: Appointment[], term: string): Appointment[] {
  const needle = normalizeText(term);
  if (!needle) return [];
  return appointments.filter((a) => normalizeText(a.title).includes(needle));
}

async function handleDelete(text: string, ctx: Context): Promise<LocalResult> {
  let term = text.replace(DELETE_RE, '').trim().replace(FILLER_WORDS, '').trim();
  term = term.replace(/\b(la|el)\s+(cita|reunión|reunion)\b/gi, '').trim();
  if (!term) {
    return { handled: true, reply: '¿Cuál cita quieres que elimine? Dime con quién es o su título.' };
  }

  const appointments = await getAppointmentsOnce(ctx.workspaceId);
  const matches = findMatchingAppointments(appointments, term);

  if (matches.length === 0) {
    return { handled: true, reply: `No encontré ninguna cita que coincida con "${term}". ¿Puedes darme más detalles?` };
  }
  if (matches.length > 1) {
    const list = matches.map((m) => `"${m.title}" (${formatDateEs(new Date(m.startTime))})`).join(', ');
    return { handled: true, reply: `Encontré varias citas parecidas: ${list}. Dime cuál en específico.` };
  }

  await deleteAppointment(ctx.workspaceId, matches[0].id);
  return {
    handled: true,
    reply: pick([`Listo, eliminé la cita "${matches[0].title}".`, `Hecho, borré "${matches[0].title}" del calendario.`]),
  };
}

async function handleList(ctx: Context): Promise<LocalResult> {
  const appointments = await getAppointmentsOnce(ctx.workspaceId);
  const upcoming = appointments.filter((a) => a.endTime >= Date.now());

  if (upcoming.length === 0) {
    return { handled: true, reply: 'No tienes citas agendadas por ahora.' };
  }
  const list = upcoming
    .slice(0, 6)
    .map((a) => `"${a.title}" el ${formatDateEs(new Date(a.startTime))}`)
    .join('; ');
  return { handled: true, reply: `Tienes ${upcoming.length} cita${upcoming.length === 1 ? '' : 's'}: ${list}.` };
}

async function handleCreate(text: string, ctx: Context): Promise<LocalResult> {
  const now = new Date();
  const results = chrono.es.parse(text, now, {});
  const first = results[0];

  const title = extractAppointmentTitle(text, first ? { index: first.index, text: first.text } : undefined);

  if (!first) {
    return { handled: true, reply: `¿Para cuándo quieres que agende "${title}"? Dime el día y la hora en el mismo mensaje.` };
  }

  const start = first.start.date();
  const end = first.end ? first.end.date() : new Date(start.getTime() + 60 * 60 * 1000);

  await createAppointment(ctx.workspaceId, {
    title,
    description: '',
    location: '',
    startTime: start.getTime(),
    endTime: end.getTime(),
    createdBy: ctx.uid,
  });

  return {
    handled: true,
    reply: pick([
      `Listo, agendé "${title}" para el ${formatDateEs(start)}.`,
      `Hecho — quedó "${title}" en el calendario para el ${formatDateEs(start)}.`,
      `Anotado en el calendario: "${title}" el ${formatDateEs(start)}.`,
    ]),
  };
}

async function handleNote(text: string, ctx: Context): Promise<LocalResult> {
  const content = text.replace(NOTE_RE, '').trim();
  if (!content) {
    return { handled: true, reply: '¿Qué quieres que anote?' };
  }
  const title = content.length > 40 ? content.slice(0, 40).trim() + '…' : content;
  await saveNoteText(ctx.workspaceId, ctx.uid, title, content);
  return {
    handled: true,
    reply: pick([`Anotado: "${content}".`, `Listo, lo guardé como nota.`, `Hecho, quedó guardado: "${content}".`]),
  };
}

/**
 * Router "nativo" (sin IA) para las tareas breves y frecuentes de Gaby: agendar,
 * revisar y eliminar citas, y guardar notas. Reconoce frases en español con
 * patrones de texto — no entiende cualquier forma de decirlo, solo las más
 * comunes. Si no reconoce la intención, devuelve handled:false para que el
 * llamador la mande a OpenAI (para preguntas de investigación/conocimiento general).
 */
export async function tryHandleLocally(text: string, ctx: Context): Promise<LocalResult> {
  const trimmed = text.trim();
  if (!trimmed) return { handled: false };

  if (DELETE_RE.test(trimmed)) return handleDelete(trimmed, ctx);
  if (LIST_RE.test(trimmed)) return handleList(ctx);
  if (CREATE_RE.test(trimmed)) return handleCreate(trimmed, ctx);
  if (NOTE_RE.test(trimmed)) return handleNote(trimmed, ctx);

  return { handled: false };
}
