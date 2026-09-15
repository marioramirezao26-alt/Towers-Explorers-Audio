import { getFirestore, DocumentReference } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import OpenAI from 'openai';
import { redactSecrets } from './security';

export const openaiApiKey = defineSecret('OPENAI_API_KEY');

// Se usa solo para preguntas de investigación/conocimiento general — todo lo que
// tenga que ver con agendar, revisar o eliminar citas, o guardar notas, ya se
// resuelve antes de llegar aquí (ver src/services/localAssistant.ts en la app).
const MODEL = 'gpt-4o-mini';

function systemPrompt(): string {
  return (
    'Eres Gaby, la mano derecha personal de tu usuario y de su socio. Esta pregunta ya se ' +
    'determinó que es de investigación o conocimiento general — no puedes agendar citas ni ' +
    'guardar notas desde aquí, así que si te piden eso, diles que te lo repitan como una ' +
    'instrucción directa (ej. "agéndame..." o "apunta que..."). Responde en español, en texto ' +
    'plano (tus respuestas se leen en voz alta: nunca uses markdown — nada de **negritas**, ' +
    '_cursivas_, `código`, encabezados con #, ni listas con guiones o asteriscos). Sé cálida, ' +
    'cercana y breve, como hablaría alguien de confianza.'
  );
}

/**
 * Guarda el mensaje del usuario, le pregunta a OpenAI con el historial reciente del
 * espacio de trabajo como contexto, guarda la respuesta y la devuelve. Compartido por
 * `researchWithOpenAI` (llamado desde la app) y `deviceCommand` (llamado desde un
 * dispositivo físico como un Stack-chan) para no duplicar la llamada a OpenAI ni el
 * manejo de errores.
 */
export async function answerWithOpenAI(
  workspaceRef: DocumentReference,
  message: string,
  createdBy: string,
): Promise<string> {
  const messagesRef = workspaceRef.collection('assistantMessages');

  await messagesRef.add({
    role: 'user',
    content: message.trim(),
    createdBy,
    createdAt: Date.now(),
  });

  const historySnap = await messagesRef.orderBy('createdAt', 'desc').limit(20).get();
  const history = historySnap.docs
    .map((d) => d.data())
    .reverse()
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content as string }));

  let finalText: string;
  try {
    const openai = new OpenAI({ apiKey: openaiApiKey.value().trim() });
    const completion = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 800,
      messages: [{ role: 'system', content: systemPrompt() }, ...history],
    });
    finalText = completion.choices[0]?.message?.content?.trim() || 'No encontré una respuesta clara para eso.';
  } catch (error) {
    console.error('Error consultando a OpenAI:', error);
    if (error instanceof OpenAI.AuthenticationError) {
      finalText = 'No pude responder: la API key de OpenAI no es válida.';
    } else if (error instanceof OpenAI.RateLimitError) {
      finalText = 'No pude responder: se alcanzó el límite de uso, intenta en un momento.';
    } else if (error instanceof OpenAI.APIError) {
      finalText = redactSecrets(`No pude responder (${error.status}): ${error.message}`);
    } else {
      finalText = redactSecrets(`No pude responder: ${(error as Error)?.message ?? error}`);
    }
  }

  await messagesRef.add({
    role: 'assistant',
    content: finalText,
    createdBy: 'gaby',
    createdAt: Date.now(),
  });

  return finalText;
}

export const researchWithOpenAI = onCall(
  { secrets: [openaiApiKey], cpu: 1, memory: '256MiB', timeoutSeconds: 60 },
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

    const reply = await answerWithOpenAI(workspaceRef, message, uid);
    return { reply };
  },
);
