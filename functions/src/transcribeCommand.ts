import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import OpenAI from 'openai';
import { redactSecrets } from './security';

const openaiApiKey = defineSecret('OPENAI_API_KEY');

/**
 * Transcribe un audio corto grabado en el momento (a diferencia de
 * transcribeVoiceNote, que reacciona a un archivo ya subido a Storage). Es el
 * respaldo "en la nube" para dar una orden de voz cuando el navegador no soporta
 * la Web Speech API (ej. Firefox) o cuando falla seguido (ver useWakeWord,
 * estado "degraded") — inspirado en el CloudSTTProvider de Scowld, que deja
 * elegir entre reconocimiento nativo o un proveedor en la nube.
 */
export const transcribeCommand = onCall(
  { secrets: [openaiApiKey], cpu: 1, memory: '512MiB', timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }

    const { audioBase64, mimeType } = (request.data ?? {}) as {
      audioBase64?: string;
      mimeType?: string;
    };
    if (!audioBase64) {
      throw new HttpsError('invalid-argument', 'Falta audioBase64.');
    }
    // Límite generoso para un comando hablado corto (unos ~2 minutos de m4a) —
    // evita que alguien mande un audio enorme y dispare un costo grande de OpenAI.
    const MAX_BASE64_LENGTH = 15_000_000;
    if (audioBase64.length > MAX_BASE64_LENGTH) {
      throw new HttpsError('invalid-argument', 'El audio es demasiado largo.');
    }

    const extension = (mimeType ?? '').includes('mp4') || (mimeType ?? '').includes('m4a') ? 'm4a' : 'webm';
    const tempFilePath = path.join(os.tmpdir(), `gaby-command-${crypto.randomUUID()}.${extension}`);

    try {
      await fs.promises.writeFile(tempFilePath, Buffer.from(audioBase64, 'base64'));

      const openai = new OpenAI({ apiKey: openaiApiKey.value().trim(), maxRetries: 2, timeout: 30000 });
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'whisper-1',
        language: 'es',
      });

      return { text: transcription.text.trim() };
    } catch (error) {
      console.error('Error transcribiendo comando de voz:', redactSecrets(String((error as Error)?.stack ?? error)));
      throw new HttpsError('internal', redactSecrets(`No se pudo transcribir: ${(error as Error)?.message ?? error}`));
    } finally {
      fs.promises.unlink(tempFilePath).catch(() => {});
    }
  },
);
