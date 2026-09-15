import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, Stop, Circle } from 'react-native-svg';
import { colors } from '@/theme';

export type OrbState = 'idle' | 'listening' | 'awaiting-command' | 'thinking' | 'speaking';
export type Emotion = 'neutral' | 'feliz' | 'enojo' | 'tristeza' | 'mareado' | 'confundido';

/** Emoción por defecto para cada estado técnico de la conversación. */
const STATE_EMOTION: Record<OrbState, Emotion> = {
  idle: 'neutral',
  listening: 'feliz',
  'awaiting-command': 'feliz',
  thinking: 'mareado',
  speaking: 'feliz',
};

const EMOTION_META: Record<Emotion, { colors: [string, string]; speed: number }> = {
  neutral: { colors: [colors.accent, colors.primary], speed: 2600 },
  feliz: { colors: [colors.success, colors.accent], speed: 1800 },
  enojo: { colors: [colors.error, colors.primary], speed: 900 },
  tristeza: { colors: [colors.textMuted, colors.primary], speed: 3600 },
  mareado: { colors: [colors.primary, colors.accent], speed: 550 },
  confundido: { colors: [colors.accent, colors.textMuted], speed: 2000 },
};

// Paleta "humana" del rostro (independiente del color del aro holográfico, que sigue
// usando los tonos de marca según la emoción).
const LINE = '#3B2A1E'; // cejas, párpados
const PUPIL = '#1A1108';
const IRIS = '#5B3A29';
const LIP = '#B5615A';

interface Props {
  state: OrbState;
  /** Fuerza una emoción concreta (ej. error de micrófono) por encima de la que dictaría `state`. */
  emotionOverride?: Emotion;
  size?: number;
  /** -1..1: cómo inclinas el celular de verdad (sensor de orientación), de useDeviceTilt(). */
  tiltX?: Animated.Value;
  tiltY?: Animated.Value;
}

/** Ojo "realista": esclerótica blanca + iris + pupila + brillo, para las emociones con ojos abiertos. */
function Eye({ cx, cy, rx = 7.2, ry = 5.4, lookY = 0 }: { cx: number; cy: number; rx?: number; ry?: number; lookY?: number }) {
  return (
    <>
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#FBF6F0" />
      <Circle cx={cx} cy={cy + lookY} r={ry * 0.76} fill={IRIS} />
      <Circle cx={cx} cy={cy + lookY} r={ry * 0.34} fill={PUPIL} />
      <Circle cx={cx - rx * 0.24} cy={cy + lookY - ry * 0.3} r={ry * 0.16} fill="#FFFFFF" opacity={0.9} />
      <Path
        d={`M${cx - rx} ${cy - ry * 0.1} Q${cx} ${cy - ry * 1.6} ${cx + rx} ${cy - ry * 0.1}`}
        stroke={LINE}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
        opacity={0.75}
      />
    </>
  );
}

/** Rostro (cejas, ojos y boca) de Gaby para cada emoción, sobre la cabeza (cx=100, cy=106). */
function Face({ emotion }: { emotion: Emotion }) {
  switch (emotion) {
    case 'feliz':
      return (
        <>
          <Path d="M79 84 Q86 79 93 83" stroke={LINE} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.85} />
          <Path d="M107 83 Q114 79 121 84" stroke={LINE} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.85} />
          <Path d="M80 97 Q86 91 92 97" stroke={LINE} strokeWidth={2.8} strokeLinecap="round" fill="none" opacity={0.9} />
          <Path d="M108 97 Q114 91 120 97" stroke={LINE} strokeWidth={2.8} strokeLinecap="round" fill="none" opacity={0.9} />
          <Path d="M81 120 Q100 140 119 120 Q100 130 81 120 Z" fill="#FFFFFF" opacity={0.85} />
          <Path d="M81 120 Q100 140 119 120" stroke={LIP} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Circle cx={70} cy={112} r={4} fill="#E8836F" opacity={0.35} />
          <Circle cx={130} cy={112} r={4} fill="#E8836F" opacity={0.35} />
        </>
      );
    case 'enojo':
      return (
        <>
          <Path d="M77 82 L94 91" stroke={colors.error} strokeWidth={4} strokeLinecap="round" />
          <Path d="M123 82 L106 91" stroke={colors.error} strokeWidth={4} strokeLinecap="round" />
          <Ellipse cx={86} cy={100} rx={4.5} ry={2.4} fill={IRIS} opacity={0.9} />
          <Ellipse cx={114} cy={100} rx={4.5} ry={2.4} fill={IRIS} opacity={0.9} />
          <Path d="M83 129 Q100 118 117 129" stroke={LIP} strokeWidth={3.2} strokeLinecap="round" fill="none" />
        </>
      );
    case 'tristeza':
      return (
        <>
          <Path d="M78 89 Q86 82 94 81" stroke={LINE} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.8} />
          <Path d="M106 81 Q114 82 122 89" stroke={LINE} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.8} />
          <Eye cx={86} cy={101} rx={6.6} ry={4.6} lookY={1.4} />
          <Eye cx={114} cy={101} rx={6.6} ry={4.6} lookY={1.4} />
          <Path d="M78 97 Q86 93 94 97" stroke="#F3C9A2" strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.9} />
          <Path d="M106 97 Q114 93 122 97" stroke="#F3C9A2" strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.9} />
          <Path d="M119 106 q-2.6 5.5 0 8.8 q2.6 -3.3 0 -8.8" fill={colors.accent} opacity={0.8} />
          <Path d="M85 129 Q100 122 115 129" stroke={LIP} strokeWidth={2.8} strokeLinecap="round" fill="none" />
        </>
      );
    case 'mareado':
      return (
        <>
          <Path d="M80 86 Q86 84 92 86" stroke={LINE} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.35} />
          <Path d="M108 86 Q114 84 120 86" stroke={LINE} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.35} />
          <Path
            d="M86 91 C92 91 93 97 88 99 C85 100.3 81.5 98 82.5 95 C83.3 92.6 86.5 92 87.5 94"
            stroke={colors.primary}
            strokeWidth={2.1}
            strokeLinecap="round"
            fill="none"
            opacity={0.95}
          />
          <Path
            d="M114 91 C108 91 107 97 112 99 C115 100.3 118.5 98 117.5 95 C116.7 92.6 113.5 92 112.5 94"
            stroke={colors.primary}
            strokeWidth={2.1}
            strokeLinecap="round"
            fill="none"
            opacity={0.95}
          />
          <Path d="M85 123 Q91 118 97 123 Q103 128 109 123 Q113 120 116 121.5" stroke={LIP} strokeWidth={2.4} strokeLinecap="round" fill="none" />
        </>
      );
    case 'confundido':
      return (
        <>
          <Path d="M77 89 L94 91" stroke={LINE} strokeWidth={2.6} strokeLinecap="round" opacity={0.8} />
          <Path d="M105 83 Q114 75 123 83" stroke={LINE} strokeWidth={2.6} strokeLinecap="round" fill="none" opacity={0.8} />
          <Eye cx={86} cy={99} rx={6} ry={4.4} />
          <Eye cx={115} cy={96} rx={8} ry={6.2} />
          <Path d="M86 124 Q93 120 98 124 Q103 128 111 122" stroke={LIP} strokeWidth={2.6} strokeLinecap="round" fill="none" />
        </>
      );
    case 'neutral':
    default:
      return (
        <>
          <Path d="M79 86 Q86 83 93 86" stroke={LINE} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.8} />
          <Path d="M107 86 Q114 83 121 86" stroke={LINE} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.8} />
          <Eye cx={86} cy={99} rx={7} ry={5.2} />
          <Eye cx={114} cy={99} rx={7} ry={5.2} />
          <Path d="M89 122 Q100 128 111 122" stroke={LIP} strokeWidth={2.8} strokeLinecap="round" fill="none" />
        </>
      );
  }
}

/**
 * Rostro holográfico flotante de Gaby (sin cuerpo): una cabeza con piel, cabello, ojos
 * con iris y labios — que respira, flota y gira suavemente todo el tiempo, con anillos
 * de luz por emoción. Íntegramente vectorial (SVG) para que se vea nítida en cualquier tamaño.
 */
export default function GabyOrb({ state, emotionOverride, size = 220, tiltX, tiltY }: Props) {
  const emotion = emotionOverride ?? STATE_EMOTION[state];
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const turn = useRef(new Animated.Value(0)).current;
  const fallbackTilt = useRef(new Animated.Value(0)).current;
  const deviceTiltX = tiltX ?? fallbackTilt;
  const deviceTiltY = tiltY ?? fallbackTilt;

  useEffect(() => {
    pulse.setValue(0);
    const speed = EMOTION_META[emotion].speed;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: speed, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: speed, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
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

  // Giro constante (efecto "4D"): la cabeza se ladea de lado a lado como si mirara alrededor,
  // sin depender de la emoción — para que se sienta siempre viva y en movimiento.
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
  const turnScaleX = turn.interpolate({ inputRange: [-1, 1], outputRange: [0.92, 1.08] });
  const turnTranslateX = turn.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] });
  // Se suma al giro ambiental: cómo inclinas el celular de verdad (sensor de orientación).
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
            { scaleX: turnScaleX },
            { rotate },
            { rotate: turnRotate },
            { rotate: deviceRotate },
          ],
        }}
      >
        <Svg width={size} height={size} viewBox="20 20 160 160">
          <Defs>
            <LinearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#F6D9BE" />
              <Stop offset="1" stopColor="#DFAE81" />
            </LinearGradient>
            <LinearGradient id="hair" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#4A3222" />
              <Stop offset="1" stopColor="#2A1C14" />
            </LinearGradient>
          </Defs>

          {/* halo holográfico */}
          <Circle cx={100} cy={100} r={62} fill={colorA} opacity={0.14} />

          {/* orejas */}
          <Ellipse cx={60} cy={108} rx={6.5} ry={10} fill="url(#skin)" />
          <Ellipse cx={140} cy={108} rx={6.5} ry={10} fill="url(#skin)" />

          {/* cabello (detrás de la cara: sobresale arriba y a los lados) */}
          <Ellipse cx={100} cy={88} rx={45} ry={49} fill="url(#hair)" />

          {/* cara */}
          <Ellipse cx={100} cy={106} rx={37} ry={41} fill="url(#skin)" />
          {/* aro de luz sutil en el borde, para no perder del todo el look holográfico */}
          <Ellipse cx={100} cy={106} rx={37} ry={41} fill="none" stroke={colorA} strokeWidth={1.4} opacity={0.35} />

          {/* mechón/flequillo sutil sobre la frente */}
          <Path d="M64 84 Q100 62 136 84 Q100 74 64 84 Z" fill="url(#hair)" opacity={0.95} />

          {/* rostro */}
          <Face emotion={emotion} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  haze: { position: 'absolute' },
});
