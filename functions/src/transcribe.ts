import { getFirestore } from 'firebase-admin/firestore';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { defineSecret } from 'firebase-functions/params';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import OpenAI from 'openai';
import { redactSecrets } from './security';

const openaiApiKey = defineSecret('OPENAI_API_KEY');

// Coincide con el path que usa uploadVoiceNote() en la app:
// workspaces/{workspaceId}/voiceNotes/{noteId}.m4a
const AUDIO_PATH_REGEX = /^workspaces\/([^/]+)\/voiceNotes\/([^/.]+)\.[a-zA-Z0-9]+$/;

export const transcribeVoiceNote = onObjectFinalized(
  { secrets: [openaiApiKey], cpu: 1, memory: '512MiB', timeoutSeconds: 300 },
  async (event) => {
    const filePath = event.data.name;
    const bucketName = event.data.bucket;
    if (!filePath) return;

    const match = AUDIO_PATH_REGEX.exec(filePath);
    if (!match) {
      console.log(`Ignorando archivo fuera del patrón esperado: ${filePath}`);
      return;
    }
    const [, workspaceId, noteId] = match;
    const db = getFirestore();
    const noteRef = db
      .collection('workspaces')
      .doc(workspaceId)
      .collection('voiceNotes')
      .doc(noteId);

    const bucket = require('firebase-admin/storage').getStorage().bucket(bucketName);
    const tempFilePath = path.join(os.tmpdir(), path.basename(filePath));

    try {
      await bucket.file(filePath).download({ destination: tempFilePath });

      const apiKey = openaiApiKey.value().trim();
      const openai = new OpenAI({ apiKey, maxRetries: 3, timeout: 60000 });
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'whisper-1',
        language: 'es',
      });

      await noteRef.update({
        transcript: transcription.text,
        status: 'done',
      });
    } catch (error: any) {
      console.error('Error transcribiendo nota de voz:', redactSecrets(String(error?.stack ?? error)));
      const detail =
        error?.response?.data?.error?.message ??
        (error?.cause ? `${error.message} (${error.cause.code ?? ''} ${error.cause.message ?? ''})`.trim() : null) ??
        error?.message ??
        String(error);
      await noteRef
        .update({ status: 'error', transcript: redactSecrets(`Error al transcribir: ${detail}`) })
        .catch(() => {});
    } finally {
      fs.promises.unlink(tempFilePath).catch(() => {});
    }
  },
);
