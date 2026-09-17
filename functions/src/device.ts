import { timingSafeEqual } from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { answerWithOpenAI, openaiApiKey } from './research';
import { tryHandleCommand } from './commandRouter';

const deviceSharedSecret = defineSecret('DEVICE_SHARED_SECRET');

/**
 * Un secreto más corto que esto se trata como "sin configurar". No es una
 * política de contraseñas: es el umbral por debajo del cual un valor no puede
 * ser el que se pretendía guardar (vacío, un espacio, una tecla suelta).
 */
const MIN_SECRET_LENGTH = 16;

/**
 * Compara en tiempo constante, para no filtrar cuántos caracteres del principio
 * acertó quien llama: con una comparación normal, medir los tiempos de muchas
 * peticiones permite adivinar el secreto letra por letra.
 */
function secretosIguales(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

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

    // Un secreto vacío o demasiado corto deja el endpoint abierto: una petición
    // sin el header manda '' y coincidiría con él. Pasó de verdad, al guardar el
    // secreto dando Enter sin escribir nada. Se rechaza todo antes de mirar la
    // petición, porque el fallo es de configuración, no de quien llama.
    const expectedSecret = deviceSharedSecret.value().trim();
    if (expectedSecret.length < MIN_SECRET_LENGTH) {
      console.error(
        'DEVICE_SHARED_SECRET está vacío o es demasiado corto; se rechazan todas las peticiones. ' +
          'Guarda uno nuevo con: firebase functions:secrets:set DEVICE_SHARED_SECRET',
      );
      res.status(503).json({ error: 'El servidor no tiene configurado el secreto de dispositivo.' });
      return;
    }

    const providedSecret = req.header('x-device-secret')?.trim() ?? '';
    if (!secretosIguales(providedSecret, expectedSecret)) {
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
