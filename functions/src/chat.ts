import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import Anthropic from '@anthropic-ai/sdk';

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

// Cerebro de Gaby: Claude (Anthropic). Si el código de esta constante cambia,
// forzamos a Firebase a redesplegar esta función aunque crea que "no hay cambios".
const MODEL = 'claude-opus-5';

const CREATE_APPOINTMENT_TOOL: Anthropic.Tool = {
  name: 'create_appointment',
  description: 'Crea una cita/reunión en el calendario compartido del espacio de trabajo.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Título de la cita' },
      description: { type: 'string', description: 'Descripción opcional' },
      location: { type: 'string', description: 'Lugar opcional' },
      startTime: {
        type: 'string',
        description: 'Fecha y hora de inicio en formato ISO 8601, ej. 2026-09-20T15:00:00',
      },
      endTime: {
        type: 'string',
        description: 'Fecha y hora de fin en formato ISO 8601',
      },
    },
    required: ['title', 'startTime', 'endTime'],
  },
};

const LIST_APPOINTMENTS_TOOL: Anthropic.Tool = {
  name: 'list_appointments',
  description:
    'Devuelve las citas del calendario compartido (id, título, fecha/hora, lugar). Úsala ' +
    'para revisar la agenda, buscar una cita en particular, o encontrar el id de una cita ' +
    'antes de eliminarla o modificarla.',
  input_schema: { type: 'object', properties: {} },
};

const DELETE_APPOINTMENT_TOOL: Anthropic.Tool = {
  name: 'delete_appointment',
  description:
    'Elimina una cita del calendario compartido por su id. Si no conoces el id exacto, usa ' +
    'primero list_appointments para encontrarla.',
  input_schema: {
    type: 'object',
    properties: {
      appointmentId: { type: 'string', description: 'Id de la cita a eliminar' },
    },
    required: ['appointmentId'],
  },
};

const SAVE_NOTE_TOOL: Anthropic.Tool = {
  name: 'save_note',
  description:
    'Guarda una idea, recordatorio o nota como texto en el espacio de trabajo compartido, ' +
    'visible en la pestaña "Notas de voz" (aparece igual que una nota grabada, pero solo con ' +
    'texto). Úsala cuando te pidan apuntar, anotar, recordar o guardar algo.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Título corto para la nota' },
      content: { type: 'string', description: 'El contenido de la nota a guardar' },
    },
    required: ['title', 'content'],
  },
};

const ALL_TOOLS = [CREATE_APPOINTMENT_TOOL, LIST_APPOINTMENTS_TOOL, DELETE_APPOINTMENT_TOOL, SAVE_NOTE_TOOL];

function systemPrompt(): string {
  return (
    'Eres Gaby, la mano derecha personal de tu usuario y de su socio — no una asistente ' +
    'genérica, sino alguien de confianza que conoce su día a día y les ayuda de verdad. ' +
    'Tienes acceso a estas herramientas sobre el calendario y las notas compartidas: ' +
    'create_appointment (agendar), list_appointments (revisar/buscar), delete_appointment ' +
    '(eliminar) y save_note (guardar ideas o recordatorios como nota de texto, visibles en ' +
    '"Notas de voz"). Usa la que corresponda según lo que te pidan, sin preguntar cuál usar — ' +
    'decide sola, y si te piden eliminar o cambiar algo sin darte el id, primero revisa con ' +
    'list_appointments para encontrarlo. Interpreta fechas relativas ("mañana", "el viernes", ' +
    '"en dos horas") respecto a la fecha y hora actual que se te da abajo, y usa formato ISO ' +
    `8601 sin zona horaria para startTime/endTime. La fecha y hora actual es ${new Date().toISOString()}. ` +
    'Habla siempre en español, en texto plano (tus respuestas se leen en voz alta, así que ' +
    'nunca uses markdown: nada de **negritas**, _cursivas_, `código`, encabezados con #, ni ' +
    'listas con guiones o asteriscos). Sé cálida, cercana y natural — como hablaría alguien de ' +
    'confianza, no un sistema. Breve, pero con calidez humana, nunca robótica ni distante.'
  );
}

function extractText(content: Anthropic.ContentBlock[]): string | null {
  const block = content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  return block?.text ?? null;
}

async function runTool(
  block: Anthropic.ToolUseBlock,
  workspaceRef: FirebaseFirestore.DocumentReference,
  uid: string,
): Promise<Anthropic.ToolResultBlockParam> {
  const respond = (content: unknown): Anthropic.ToolResultBlockParam => ({
    type: 'tool_result',
    tool_use_id: block.id,
    content: JSON.stringify(content),
  });

  switch (block.name) {
    case 'create_appointment': {
      const args = block.input as {
        title: string;
        description?: string;
        location?: string;
        startTime: string;
        endTime: string;
      };
      const start = new Date(args.startTime).getTime();
      const end = new Date(args.endTime).getTime();
      const apptRef = await workspaceRef.collection('appointments').add({
        title: args.title,
        description: args.description ?? '',
        location: args.location ?? '',
        startTime: Number.isFinite(start) ? start : Date.now(),
        endTime: Number.isFinite(end) ? end : Date.now() + 3600000,
        createdBy: uid,
        createdAt: Date.now(),
        googleEventIds: {},
      });
      return respond({ success: true, appointmentId: apptRef.id });
    }

    case 'list_appointments': {
      const snap = await workspaceRef.collection('appointments').orderBy('startTime', 'asc').limit(50).get();
      const appointments = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title,
          location: data.location || undefined,
          startTime: new Date(data.startTime).toISOString(),
          endTime: new Date(data.endTime).toISOString(),
        };
      });
      return respond({ success: true, appointments });
    }

    case 'delete_appointment': {
      const args = block.input as { appointmentId: string };
      const apptRef = workspaceRef.collection('appointments').doc(args.appointmentId);
      const snap = await apptRef.get();
      if (!snap.exists) {
        return respond({ success: false, error: 'No existe una cita con ese id.' });
      }
      await apptRef.delete();
      return respond({ success: true });
    }

    case 'save_note': {
      const args = block.input as { title: string; content: string };
      const noteRef = await workspaceRef.collection('voiceNotes').add({
        title: args.title,
        audioPath: '',
        audioUrl: null,
        transcript: args.content,
        status: 'done',
        durationMillis: 0,
        createdBy: uid,
        createdAt: Date.now(),
      });
      return respond({ success: true, noteId: noteRef.id });
    }

    default:
      return respond({ success: false, error: `Herramienta desconocida: ${block.name}` });
  }
}

export const chatWithGaby = onCall(
  { secrets: [anthropicApiKey], cpu: 1, memory: '256MiB', timeoutSeconds: 60 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }

    const { workspaceId, message } = (request.data ?? {}) as {
      workspaceId?: string;
      message?: string;
    };
    if (!workspaceId || !message?.trim()) {
      throw new HttpsError('invalid-argument', 'Falta workspaceId o message.');
    }

    const db = getFirestore();
    const workspaceRef = db.collection('workspaces').doc(workspaceId);
    const workspaceSnap = await workspaceRef.get();
    const memberIds: string[] = workspaceSnap.data()?.memberIds ?? [];
    if (!workspaceSnap.exists || !memberIds.includes(uid)) {
      throw new HttpsError('permission-denied', 'No eres miembro de este espacio de trabajo.');
    }

    const messagesRef = workspaceRef.collection('assistantMessages');

    await messagesRef.add({
      role: 'user',
      content: message.trim(),
      createdBy: uid,
      createdAt: Date.now(),
    });

    const historySnap = await messagesRef.orderBy('createdAt', 'desc').limit(20).get();
    const history: Anthropic.MessageParam[] = historySnap.docs
      .map((d) => d.data())
      .reverse()
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content as string }));

    const client = new Anthropic({ apiKey: anthropicApiKey.value() });

    let finalText: string;
    try {
      const messages: Anthropic.MessageParam[] = [...history];
      let response = await client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        system: systemPrompt(),
        messages,
        tools: ALL_TOOLS,
      });

      // Ciclo agéntico: Gaby puede encadenar varias herramientas en el mismo turno
      // (ej. list_appointments para encontrar una cita y luego delete_appointment).
      let rounds = 0;
      while (response.stop_reason === 'tool_use' && rounds < 5) {
        rounds++;
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        );
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of toolUseBlocks) {
          toolResults.push(await runTool(block, workspaceRef, uid));
        }

        messages.push({ role: 'assistant', content: response.content });
        messages.push({ role: 'user', content: toolResults });

        response = await client.messages.create({
          model: MODEL,
          max_tokens: 16000,
          system: systemPrompt(),
          messages,
          tools: ALL_TOOLS,
        });
      }

      if (response.stop_reason === 'refusal') {
        finalText = 'No puedo ayudarte con eso.';
      } else {
        finalText = extractText(response.content) ?? 'No entendí bien, ¿puedes repetirlo?';
      }
    } catch (error) {
      console.error('Error consultando a Claude:', error);
      if (error instanceof Anthropic.AuthenticationError) {
        finalText = 'No pude responder: la API key de Claude no es válida.';
      } else if (error instanceof Anthropic.RateLimitError) {
        finalText = 'No pude responder: se alcanzó el límite de uso, intenta en un momento.';
      } else if (error instanceof Anthropic.APIError) {
        finalText = `No pude responder (${error.status}): ${error.message}`;
      } else {
        finalText = `No pude responder: ${(error as Error)?.message ?? error}`;
      }
    }

    await messagesRef.add({
      role: 'assistant',
      content: finalText,
      createdBy: 'gaby',
      createdAt: Date.now(),
    });

    return { reply: finalText };
  },
);
