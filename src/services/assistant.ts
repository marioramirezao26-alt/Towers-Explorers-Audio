import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/config/firebase';
import { AssistantMessage } from '@/types';

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

interface ChatWithGabyResponse {
  reply: string;
}

/**
 * Manda un mensaje a Gaby (Claude vía Cloud Function). La función guarda tanto el
 * mensaje del usuario como la respuesta del asistente en Firestore, así que no hace
 * falta escribirlos por separado — el listener de subscribeToAssistantMessages los recibe.
 */
export async function sendAssistantMessage(workspaceId: string, message: string): Promise<string> {
  const callable = httpsCallable<{ workspaceId: string; message: string }, ChatWithGabyResponse>(
    functions,
    'chatWithGaby',
  );
  const result = await callable({ workspaceId, message });
  return result.data.reply;
}
