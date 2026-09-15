import { addDoc, collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/config/firebase';
import { AssistantMessage } from '@/types';
import { tryHandleLocally } from '@/services/localAssistant';

function assistantMessagesCollection(workspaceId: string) {
  return collection(db, 'workspaces', workspaceId, 'assistantMessages');
}

export function subscribeToAssistantMessages(
  workspaceId: string,
  onChange: (messages: AssistantMessage[]) => void,
) {
  const q = query(assistantMessagesCollection(workspaceId), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ ...(d.data() as AssistantMessage), id: d.id })));
  });
}

interface ResearchResponse {
  reply: string;
}

/**
 * Manda un mensaje a Gaby. Primero intenta resolverlo "nativamente" (sin IA, ver
 * localAssistant.ts) para lo breve y frecuente: agendar, revisar o eliminar citas,
 * guardar notas. Si no reconoce la frase, la manda a OpenAI (Cloud Function
 * researchWithOpenAI) para preguntas de investigación/conocimiento general — esa
 * función es la que guarda el mensaje del usuario y la respuesta en Firestore;
 * para lo resuelto localmente, los guardamos aquí mismo.
 */
export async function sendAssistantMessage(
  workspaceId: string,
  uid: string,
  message: string,
): Promise<string> {
  const local = await tryHandleLocally(message, { workspaceId, uid });
  if (local.handled) {
    const messagesRef = assistantMessagesCollection(workspaceId);
    await addDoc(messagesRef, { role: 'user', content: message, createdBy: uid, createdAt: Date.now() });
    const reply = local.reply ?? 'Listo.';
    await addDoc(messagesRef, { role: 'assistant', content: reply, createdBy: 'gaby', createdAt: Date.now() });
    return reply;
  }

  const callable = httpsCallable<{ workspaceId: string; message: string }, ResearchResponse>(
    functions,
    'researchWithOpenAI',
  );
  const result = await callable({ workspaceId, message });
  return result.data.reply;
}
