import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes, deleteObject } from 'firebase/storage';
import { db, storage } from '@/config/firebase';
import { VoiceNote } from '@/types';

function voiceNotesCollection(workspaceId: string) {
  return collection(db, 'workspaces', workspaceId, 'voiceNotes');
}

export function subscribeToVoiceNotes(
  workspaceId: string,
  onChange: (notes: VoiceNote[]) => void,
) {
  const q = query(voiceNotesCollection(workspaceId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ ...(d.data() as VoiceNote), id: d.id })));
  });
}

/**
 * Sube el audio grabado y crea el registro en Firestore. La transcripción la realiza
 * automáticamente una Cloud Function (ver /functions) cuando detecta el archivo nuevo
 * en Storage, y luego actualiza este mismo documento con el texto y status = 'done'.
 */
export async function uploadVoiceNote(
  workspaceId: string,
  uid: string,
  localUri: string,
  title: string,
  durationMillis: number,
): Promise<string> {
  const docRef = await addDoc(voiceNotesCollection(workspaceId), {
    title,
    audioPath: '',
    audioUrl: null,
    transcript: null,
    status: 'uploading',
    durationMillis,
    createdBy: uid,
    createdAt: Date.now(),
  } as Omit<VoiceNote, 'id'>);

  const storagePath = `workspaces/${workspaceId}/voiceNotes/${docRef.id}.m4a`;
  const storageRef = ref(storage, storagePath);

  const response = await fetch(localUri);
  const blob = await response.blob();
  await uploadBytes(storageRef, blob, { contentType: 'audio/m4a' });
  const audioUrl = await getDownloadURL(storageRef);

  await updateDoc(docRef, {
    audioPath: storagePath,
    audioUrl,
    status: 'transcribing',
  });

  return docRef.id;
}

export async function deleteVoiceNote(workspaceId: string, note: VoiceNote): Promise<void> {
  await deleteDoc(doc(db, 'workspaces', workspaceId, 'voiceNotes', note.id));
  if (note.audioPath) {
    try {
      await deleteObject(ref(storage, note.audioPath));
    } catch {
      // el archivo ya pudo haber sido borrado; no es crítico
    }
  }
}
