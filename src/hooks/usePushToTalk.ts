import { useCallback, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';

interface TranscribeResponse {
  text: string;
}

/** Convierte el audio grabado a base64 vía fetch+Blob+FileReader — funciona igual
 * en web (URI tipo blob:) y nativo (URI de archivo local), a diferencia de
 * expo-file-system, que en web no lee cualquier blob URI. */
async function uriToBase64(uri: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const mimeType = blob.type || 'audio/m4a';
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(new Error('No se pudo leer el audio grabado.'));
    reader.readAsDataURL(blob);
  });
  return { base64, mimeType };
}

/**
 * Grabar-y-soltar como respaldo de voz para cuando el navegador no soporta (o
 * falla seguido con) la Web Speech API: graba un audio corto y lo manda a la
 * Cloud Function transcribeCommand (Whisper) para convertirlo a texto —
 * inspirado en el CloudSTTProvider de Scowld. A diferencia de la escucha
 * continua del navegador (gratis), esto sí tiene costo por cada uso, así que es
 * un respaldo, no el modo por defecto.
 */
export function usePushToTalk() {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const startRecording = useCallback(async () => {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Necesitamos permiso de micrófono para escucharte.');
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    recordingRef.current = recording;
    setIsRecording(true);
  }, []);

  /** Detiene la grabación y devuelve el texto transcrito (cadena vacía si no se pudo). */
  const stopAndTranscribe = useCallback(async (): Promise<string> => {
    const recording = recordingRef.current;
    setIsRecording(false);
    if (!recording) return '';
    recordingRef.current = null;
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    if (!uri) return '';

    setIsTranscribing(true);
    try {
      const { base64, mimeType } = await uriToBase64(uri);
      const callable = httpsCallable<{ audioBase64: string; mimeType: string }, TranscribeResponse>(
        functions,
        'transcribeCommand',
      );
      const result = await callable({ audioBase64: base64, mimeType });
      return result.data.text;
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const cancelRecording = useCallback(async () => {
    const recording = recordingRef.current;
    recordingRef.current = null;
    setIsRecording(false);
    if (recording) await recording.stopAndUnloadAsync().catch(() => {});
  }, []);

  return { isRecording, isTranscribing, startRecording, stopAndTranscribe, cancelRecording };
}
