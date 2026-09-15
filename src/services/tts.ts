import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';

interface SpeakWithElevenLabsResponse {
  audioBase64: string;
  mimeType: string;
}

/** Convierte texto a voz con ElevenLabs (Cloud Function). Devuelve un data: URI reproducible. */
export async function synthesizeSpeech(text: string): Promise<string> {
  const callable = httpsCallable<{ text: string }, SpeakWithElevenLabsResponse>(
    functions,
    'speakWithElevenLabs',
  );
  const result = await callable({ text });
  return `data:${result.data.mimeType};base64,${result.data.audioBase64}`;
}
