import { useEffect, useRef } from 'react';
import { Animated, Platform } from 'react-native';

interface DeviceOrientationEventIOS {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

/**
 * Lee el sensor de orientación del celular (cómo lo inclinas) y expone dos
 * Animated.Value (-1..1) para que el rostro de Gaby reaccione en tiempo real,
 * como un holograma que te sigue con la mirada. Solo web; en iOS hace falta
 * llamar requestPermission() desde un toque del usuario (por eso se expone aparte).
 */
export function useDeviceTilt() {
  const tiltX = useRef(new Animated.Value(0)).current;
  const tiltY = useRef(new Animated.Value(0)).current;
  const supported = Platform.OS === 'web' && typeof window !== 'undefined' && !!window.DeviceOrientationEvent;

  useEffect(() => {
    if (!supported) return;
    const handler = (e: DeviceOrientationEvent) => {
      const beta = e.beta ?? 0; // inclinación adelante/atrás
      const gamma = e.gamma ?? 0; // inclinación izquierda/derecha
      tiltX.setValue(Math.max(-1, Math.min(1, gamma / 28)));
      tiltY.setValue(Math.max(-1, Math.min(1, (beta - 45) / 28)));
    };
    window.addEventListener('deviceorientation', handler);
    return () => window.removeEventListener('deviceorientation', handler);
  }, [supported, tiltX, tiltY]);

  /** Llamar desde el onPress de un botón (iOS exige un toque real del usuario). */
  const requestPermission = async () => {
    if (!supported) return;
    const Ctor = window.DeviceOrientationEvent as unknown as DeviceOrientationEventIOS;
    if (typeof Ctor.requestPermission === 'function') {
      try {
        await Ctor.requestPermission();
      } catch {
        // el usuario lo negó; Gaby simplemente sigue con su movimiento ambiental
      }
    }
  };

  return { supported, tiltX, tiltY, requestPermission };
}
