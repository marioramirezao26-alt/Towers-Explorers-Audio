/**
 * El puente que expone el programa de escritorio (ver desktop/preload-app.js).
 *
 * Solo existe dentro de ese programa. En un navegador normal `window.gabyPC` es
 * undefined, y las órdenes del computador sencillamente no se ofrecen — de ahí
 * que sea opcional.
 */
interface PuenteGabyPC {
  disponible: true;
  plataforma: string;
  ejecutar: (
    accion: string,
    args: Record<string, unknown>,
  ) => Promise<{ ok: boolean; error?: string; resultado?: unknown }>;

  /**
   * Avisa cuando el orbe reconoció el aplauso, y devuelve la función para
   * dejar de escuchar. Quien oye es el orbe, para que funcione sin ninguna
   * ventana abierta; quien graba y transcribe es esta página, que es la que
   * tiene la sesión iniciada.
   */
  alAplaudir: (callback: () => void) => () => void;

  /** En qué va la conversación, para que el orbe lo muestre. */
  avisarEstado: (
    fase: 'libre' | 'grabando' | 'transcribiendo' | 'pensando' | 'hablando',
    emocion?: string,
  ) => void;

  /** Un pulso por cada palabra dicha, para que el orbe lata al hablar. */
  pulsoAlHablar: () => void;
}

interface Window {
  gabyPC?: PuenteGabyPC;
}
