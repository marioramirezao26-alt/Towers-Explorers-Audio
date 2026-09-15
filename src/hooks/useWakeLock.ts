import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

interface NavigatorWithWakeLock {
  wakeLock: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
}

/**
 * Mantiene la pantalla encendida mientras `active` sea true (ej. mientras Gaby está
 * escuchando "Hey Gaby"), usando la Screen Wake Lock API del navegador. Si el navegador
 * no la soporta, no hace nada — la app sigue funcionando igual, solo sin este extra.
 */
export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return undefined;
    }
    const nav = navigator as unknown as NavigatorWithWakeLock;
    if (!active) return undefined;

    let cancelled = false;

    const acquire = async () => {
      try {
        const lock = await nav.wakeLock.request('screen');
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        lockRef.current = lock;
      } catch {
        // Permiso denegado o restricción del navegador — Gaby sigue funcionando igual.
      }
    };
    acquire();

    const handleVisibility = () => {
      // El wake lock se libera solo cuando la pestaña pierde el foco; hay que pedirlo de nuevo.
      if (document.visibilityState === 'visible' && !lockRef.current) acquire();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}
