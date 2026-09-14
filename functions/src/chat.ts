import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import OpenAI from 'openai';

const xaiApiKey = defineSecret('XAI_API_KEY');

const GROK_MODEL = 'grok-4';

const CREATE_APPOINTMENT_TOOL = {
  type: 'function' as const,
  function: {
    name: 'create_appointment',
    description: 'Crea una cita/reunión en el calendario compartido del espacio de trabajo.',
    parameters: {
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
  },
};

function systemPrompt(): string {
  return (
    'Eres Gaby, la asistente personal compartida de un socio y su equipo. Ayudas a agendar ' +
    'citas en un calendario compartido usando la herramienta create_appointment. Interpreta ' +
    'fechas relativas ("mañana", "el viernes", "en dos horas") respecto a la fecha y hora ' +
    'actual que se te da abajo, y usa formato ISO 8601 sin zona horaria para startTime/endTime. ' +
    `La fecha y hora actual es ${new Date().toISOString()}. ` +
    'Responde siempre en español, de forma breve, natural y cálida.'
  );
}

export const chatWithGaby = onCall(
  { secrets: [xaiApiKey], cpu: 1, memory: '256MiB', timeoutSeconds: 60 },
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
    const history = historySnap.docs
      .map((d) => d.data())
      .reverse()
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content as string }));

    const client = new OpenAI({
      apiKey: xaiApiKey.value(),
      baseURL: 'https://api.x.ai/v1',
      maxRetries: 2,
      timeout: 30000,
    });

    let finalText: string;
    try {
      const baseMessages: any[] = [{ role: 'system', content: systemPrompt() }, ...history];

      const completion = await client.chat.completions.create({
        model: GROK_MODEL,
        messages: baseMessages,
        tools: [CREATE_APPOINTMENT_TOOL],
      });

      const choice = completion.choices[0];
      const toolCalls = choice.message.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        const toolResultMessages: any[] = [];
        for (const call of toolCalls) {
          if (call.function.name === 'create_appointment') {
            const args = JSON.parse(call.function.arguments);
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
            toolResultMessages.push({
              tool_call_id: call.id,
              role: 'tool',
              content: JSON.stringify({ success: true, appointmentId: apptRef.id }),
            });
          }
        }

        const followUp = await client.chat.completions.create({
          model: GROK_MODEL,
          messages: [
            ...baseMessages,
            {
              role: 'assistant',
              content: choice.message.content ?? '',
              tool_calls: toolCalls,
            },
            ...toolResultMessages,
          ],
        });
        finalText = followUp.choices[0].message.content ?? 'Listo.';
      } else {
        finalText = choice.message.content ?? 'No entendí bien, ¿puedes repetirlo?';
      }
    } catch (error: any) {
      console.error('Error consultando a Grok:', error, 'cause:', error?.cause);
      finalText = `No pude responder (${error?.code ?? error?.status ?? 'error'}): ${error?.message ?? error}`;
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
