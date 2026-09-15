/**
 * Por seguridad: nunca guardar ni mostrar una API key si por algún motivo terminara
 * dentro de un mensaje de error (ej. un cliente HTTP de bajo nivel que la incluya
 * cuando el secreto tiene un carácter inválido). Esto es justo lo que pasó una vez
 * con un OPENAI_API_KEY mal configurado — la key completa quedó en el mensaje de
 * error guardado en Firestore, visible en la app.
 */
export function redactSecrets(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, 'sk-***')
    .replace(/Bearer\s+[A-Za-z0-9._-]{10,}/gi, 'Bearer ***');
}
