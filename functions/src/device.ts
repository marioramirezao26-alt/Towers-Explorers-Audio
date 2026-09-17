import { getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { answerWithOpenAI, openaiApiKey } from './research';
import { tryHandleCommand } from './commandRouter';

const deviceSharedSecret = defineSecret('DEVICE_SHARED_SECRET');

/**
 * Endpoint para dispositivos físicos (ej. un Stack-chan) que no pueden iniciar sesión
 * como un usuario normal de la app. En vez de un ID token de Firebase Auth, el
 * dispositivo manda un secreto compartido fijo en el header `x-device-secret`
 * (configúralo en el firmware con el mismo valor que guardaste en
 * `firebase functions:secrets:set DEVICE_SHARED_SECRET`).
 *
 * Pasa primero por el router de comandos (agendar/cancelar/listar/anotar) y solo
 * manda a OpenAI lo que ese router no reconoce.
 */
export const deviceCommand = onRequest(
  { secrets: [deviceSharedSecret, openaiApiKey], cpu: 1, memory: '256MiB', timeoutSeconds: 60 },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Método no permitido, usa POST.' });
      return;
    }

    const providedSecret = req.header('x-device-secret') ?? '';
    if (providedSecret !== deviceSharedSecret.value().trim()) {
      res.status(401).json({ error: 'Secreto de dispositivo inválido.' });
      return;
    }

    const { workspaceId, message } = (req.body ?? {}) as { workspaceId?: string; message?: string };
    if (!workspaceId || !message?.trim()) {
      res.status(400).json({ error: 'Falta workspaceId o message.' });
      return;
    }

    const db = getFirestore();
    const workspaceRef = db.collection('workspaces').doc(workspaceId);
    const workspaceSnap = await workspaceRef.get();
    if (!workspaceSnap.exists) {
      res.status(404).json({ error: 'Espacio de trabajo no encontrado.' });
      return;
    }

    // Primero el router de agendar/cancelar/listar/anotar: son las tareas más
    // frecuentes, y resolverlas aquí evita una llamada a OpenAI (más rápido y
    // más barato). Solo lo que no reconoce se manda al modelo.
    const local = await tryHandleCommand(message, workspaceRef, 'device');
    if (local.handled && local.reply) {
      res.status(200).json({ reply: local.reply });
      return;
    }

    const reply = await answerWithOpenAI(workspaceRef, message, 'device');
    res.status(200).json({ reply });
  },
);
