import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

const elevenLabsApiKey = defineSecret('ELEVENLABS_API_KEY');
const elevenLabsVoiceId = defineSecret('ELEVENLABS_VOICE_ID');

// Voz multilingüe por defecto de ElevenLabs (funciona bien en español). Se puede
// sobreescribir con el secreto ELEVENLABS_VOICE_ID si prefieren otra voz de su cuenta.
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

export const speakWithElevenLabs = onCall(
  { secrets: [elevenLabsApiKey, elevenLabsVoiceId], cpu: 1, memory: '256MiB', timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }

    const { text } = (request.data ?? {}) as { text?: string };
    if (!text?.trim()) {
      throw new HttpsError('invalid-argument', 'Falta text.');
    }

    const voiceId = elevenLabsVoiceId.value() || DEFAULT_VOICE_ID;

    let response: Response;
    try {
      response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsApiKey.value(),
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });
    } catch (error) {
      console.error('Error de red hacia ElevenLabs:', error);
      throw new HttpsError('unavailable', 'No se pudo contactar el servicio de voz.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs respondió con error:', response.status, errorText);
      if (response.status === 401) {
        throw new HttpsError('failed-precondition', 'La API key de ElevenLabs no es válida.');
      }
      if (response.status === 429) {
        throw new HttpsError('resource-exhausted', 'Se alcanzó el límite de uso de ElevenLabs.');
      }
      throw new HttpsError('internal', `ElevenLabs (${response.status}): ${errorText.slice(0, 200)}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return { audioBase64: buffer.toString('base64'), mimeType: 'audio/mpeg' };
  },
);
