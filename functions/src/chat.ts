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

function systemPrompt(): string {
  return (
    'Eres Gaby, la asistente personal compartida de un socio y su equipo. Tienes acceso a dos ' +
    'herramientas: create_appointment para agendar citas en el calendario compartido, y ' +
    'save_note para guardar ideas o recordatorios como notas de texto (aparecen en la pestaña ' +
    '"Notas de voz"). Usa la que corresponda según lo que te pidan — no preguntes cuál usar, ' +
    'decide sola. Interpreta fechas relativas ("mañana", "el viernes", "en dos horas") respecto ' +
    'a la fecha y hora actual que se te da abajo, y usa formato ISO 8601 sin zona horaria para ' +
    `startTime/endTime. La fecha y hora actual es ${new Date().toISOString()}. ` +
    'Responde siempre en español, de forma breve, natural y cálida, en texto plano — tus ' +
    'respuestas se leen en voz alta, así que nunca uses markdown (nada de **negritas**, ' +
    '_cursivas_, `código`, encabezados con #, ni listas con guiones o asteriscos).'
  );
}

function extractText(content: Anthropic.ContentBlock[]): string | null {
  const block = content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  return block?.text ?? null;
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
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        system: systemPrompt(),
        messages: history,
        tools: [CREATE_APPOINTMENT_TOOL, SAVE_NOTE_TOOL],
      });

      if (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        );

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of toolUseBlocks) {
          if (block.name === 'create_appointment') {
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
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify({ success: true, appointmentId: apptRef.id }),
            });
          } else if (block.name === 'save_note') {
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
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify({ success: true, noteId: noteRef.id }),
            });
          }
        }

        const followUp = await client.messages.create({
          model: MODEL,
          max_tokens: 16000,
          system: systemPrompt(),
          messages: [
            ...history,
            { role: 'assistant', content: response.content },
            { role: 'user', content: toolResults },
          ],
        });

        finalText = extractText(followUp.content) ?? 'Listo.';
      } else if (response.stop_reason === 'refusal') {
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
