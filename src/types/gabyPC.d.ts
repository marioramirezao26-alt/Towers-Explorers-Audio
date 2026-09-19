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
}

interface Window {
  gabyPC?: PuenteGabyPC;
}
