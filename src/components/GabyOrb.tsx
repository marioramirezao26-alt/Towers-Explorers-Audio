import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import GabyVrmFace from './GabyVrmFace';
import GabyParticleOrb from './GabyParticleOrb';
import { Emotion, EMOTION_META, OrbState, STATE_EMOTION } from './gabyOrbShared';

// Configurable por variable de entorno, por si algún día se quiere un avatar VRM
// con rostro — ver GabyVrmFace.tsx. Sin esa variable, Gaby es el orbe de
// partículas, que es su forma actual.
const VRM_MODEL_URL = process.env.EXPO_PUBLIC_VRM_MODEL_URL;

export type { Emotion, OrbState } from './gabyOrbShared';

interface Props {
  state: OrbState;
  /** Fuerza una emoción concreta (ej. error de micrófono) por encima de la que dictaría `state`. */
  emotionOverride?: Emotion;
  size?: number;
  /** -1..1: cómo inclinas el celular de verdad (sensor de orientación), de useDeviceTilt(). */
  tiltX?: Animated.Value;
  tiltY?: Animated.Value;
  /** Se incrementa en cada límite de palabra real del habla — ver useSpeak.onBoundary. */
  talkPulse?: number;
}

/**
 * Presencia flotante de Gaby: un orbe de puntos que emite un pulso por cada
 * palabra que habla y cambia de color según su ánimo — la misma forma que tiene
 * en la app de iOS y en el ícono.
 *
 * El orbe en sí lo dibuja GabyParticleOrb, que tiene dos versiones: con Three.js
 * en web y con SVG en el teléfono (GabyParticleOrb.native.tsx). Este componente
 * pone lo que va alrededor en ambos casos: el halo ambiental y el movimiento
 * (respirar, flotar, ladearse con el sensor).
 */
export default function GabyOrb({ state, emotionOverride, size = 220, tiltX, tiltY, talkPulse }: Props) {
  const emotion = emotionOverride ?? STATE_EMOTION[state];
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const turn = useRef(new Animated.Value(0)).current;
  const fallbackTilt = useRef(new Animated.Value(0)).current;
  const deviceTiltX = tiltX ?? fallbackTilt;
  const deviceTiltY = tiltY ?? fallbackTilt;

  // Las cuatro animaciones de este componente usan el driver nativo, y tienen que
  // seguir así: `pulse` alimenta el mismo `transform` que `drift`, `tilt` y
  // `turn`. Cuando una sola de ellas es nativa, React Native se lleva el nodo
  // entero a nativo, y animar otra desde JavaScript lanza "Attempting to run JS
  // driven animation on animated node that has been moved to native" y cierra la
  // app. Todo lo que anima aquí (opacity y transform) admite el driver nativo.
  useEffect(() => {
    pulse.setValue(0);
    const speed = EMOTION_META[emotion].speed;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: speed, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: speed, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [emotion, pulse]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  useEffect(() => {
    if (emotion === 'mareado') {
      tilt.setValue(-6);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(tilt, { toValue: 6, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(tilt, { toValue: -6, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    Animated.timing(tilt, {
      toValue: emotion === 'confundido' ? -8 : 0,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
    return undefined;
  }, [emotion, tilt]);

  // Balanceo constante, sin depender de la emoción, para que se sienta siempre
  // vivo y en movimiento.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(turn, { toValue: 1, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(turn, { toValue: -1, duration: 3600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(turn, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [turn]);

  const [colorA, colorB] = EMOTION_META[emotion].colors;
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const coreScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.04] });
  const floatY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const rotate = tilt.interpolate({ inputRange: [-45, 45], outputRange: ['-45deg', '45deg'] });
  const turnRotate = turn.interpolate({ inputRange: [-1, 1], outputRange: ['-5deg', '5deg'] });
  const turnTranslateX = turn.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] });
  // Se suma al movimiento ambiental: cómo inclinas el celular de verdad.
  const deviceRotate = deviceTiltX.interpolate({ inputRange: [-1, 1], outputRange: ['-9deg', '9deg'] });
  const deviceTranslateX = deviceTiltX.interpolate({ inputRange: [-1, 1], outputRange: [-12, 12] });
  const deviceTranslateY = deviceTiltY.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.haze,
          { width: size * 1.8, height: size * 1.8, borderRadius: size, backgroundColor: colorA, opacity: Animated.multiply(glowOpacity, 0.14) },
        ]}
      />
      <Animated.View
        style={[
          styles.haze,
          { width: size * 1.3, height: size * 1.3, borderRadius: size, backgroundColor: colorA, opacity: Animated.multiply(glowOpacity, 0.24) },
        ]}
      />
      <Animated.View
        style={[
          styles.haze,
          { width: size * 1.0, height: size * 1.0, borderRadius: size, backgroundColor: colorB, opacity: Animated.multiply(glowOpacity, 0.32) },
        ]}
      />
      <Animated.View
        style={{
          transform: [
            { translateY: Animated.add(floatY, deviceTranslateY) },
            { translateX: Animated.add(turnTranslateX, deviceTranslateX) },
            { scale: coreScale },
            { rotate },
            { rotate: turnRotate },
            { rotate: deviceRotate },
          ],
        }}
      >
        {VRM_MODEL_URL && Platform.OS === 'web' ? (
          <GabyVrmFace state={state} emotion={emotion} size={size} modelUrl={VRM_MODEL_URL} talkPulse={talkPulse} />
        ) : (
          <GabyParticleOrb state={state} emotion={emotion} size={size} talkPulse={talkPulse} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  haze: { position: 'absolute' },
});
