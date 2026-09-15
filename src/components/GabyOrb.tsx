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

const INK = '#0B0E17';

interface Props {
  state: OrbState;
  /** Fuerza una emoción concreta (ej. error de micrófono) por encima de la que dictaría `state`. */
  emotionOverride?: Emotion;
  size?: number;
}

/** Rostro (cejas, ojos y boca) de Gaby para cada emoción, sobre la cabeza (cx=100, cy=100). */
function Face({ emotion }: { emotion: Emotion }) {
  switch (emotion) {
    case 'feliz':
      return (
        <>
          <Path d="M79 78 Q86 74 93 77" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.6} />
          <Path d="M107 77 Q114 74 121 78" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.6} />
          <Path d="M80 91 Q86 85 92 91" stroke={INK} strokeWidth={2.6} strokeLinecap="round" fill="none" opacity={0.85} />
          <Path d="M108 91 Q114 85 120 91" stroke={INK} strokeWidth={2.6} strokeLinecap="round" fill="none" opacity={0.85} />
          <Path d="M82 112 Q100 132 118 112" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.85} />
          <Circle cx={72} cy={104} r={3} fill={colors.success} opacity={0.45} />
          <Circle cx={128} cy={104} r={3} fill={colors.success} opacity={0.45} />
        </>
      );
    case 'enojo':
      return (
        <>
          <Path d="M78 76 L94 85" stroke={colors.error} strokeWidth={4} strokeLinecap="round" />
          <Path d="M122 76 L106 85" stroke={colors.error} strokeWidth={4} strokeLinecap="round" />
          <Ellipse cx={86} cy={94} rx={3} ry={2} fill={INK} opacity={0.85} />
          <Ellipse cx={114} cy={94} rx={3} ry={2} fill={INK} opacity={0.85} />
          <Path d="M84 123 Q100 113 116 123" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.85} />
        </>
      );
    case 'tristeza':
      return (
        <>
          <Path d="M79 83 Q86 77 93 76" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.6} />
          <Path d="M107 76 Q114 77 121 83" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.6} />
          <Path d="M80 93 Q86 98 92 93" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.8} />
          <Path d="M108 93 Q114 98 120 93" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.8} />
          <Path d="M114 99 q-2.4 5 0 8 q2.4 -3 0 -8" fill={colors.accent} opacity={0.75} />
          <Path d="M88 120 Q100 114 112 120" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.8} />
        </>
      );
    case 'mareado':
      return (
        <>
          <Path d="M80 80 Q86 78 92 80" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.3} />
          <Path d="M108 80 Q114 78 120 80" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.3} />
          <Path
            d="M86 85 C92 85 93 91 88 93 C85 94.3 81.5 92 82.5 89 C83.3 86.6 86.5 86 87.5 88"
            stroke={colors.primary}
            strokeWidth={2.1}
            strokeLinecap="round"
            fill="none"
            opacity={0.95}
          />
          <Path
            d="M114 85 C108 85 107 91 112 93 C115 94.3 118.5 92 117.5 89 C116.7 86.6 113.5 86 112.5 88"
            stroke={colors.primary}
            strokeWidth={2.1}
            strokeLinecap="round"
            fill="none"
            opacity={0.95}
          />
          <Path d="M85 117 Q91 112 97 117 Q103 122 109 117 Q113 114 116 115.5" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.8} />
        </>
      );
    case 'confundido':
      return (
        <>
          <Path d="M78 83 L94 85" stroke={INK} strokeWidth={2.4} strokeLinecap="round" opacity={0.65} />
          <Path d="M106 77 Q114 70 122 77" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.65} />
          <Ellipse cx={86} cy={93} rx={2.6} ry={3.2} fill={INK} opacity={0.8} />
          <Ellipse cx={114} cy={90} rx={4} ry={4.8} fill={INK} opacity={0.8} />
          <Path d="M88 118 Q94 115 98 118 Q102 121 108 117" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.8} />
        </>
      );
    case 'neutral':
    default:
      return (
        <>
          <Path d="M80 80 Q86 78 92 80" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.55} />
          <Path d="M108 80 Q114 78 120 80" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.55} />
          <Ellipse cx={86} cy={92} rx={3.2} ry={4} fill={INK} opacity={0.8} />
          <Ellipse cx={114} cy={92} rx={3.2} ry={4} fill={INK} opacity={0.8} />
          <Path d="M89 115 Q100 120 111 115" stroke={INK} strokeWidth={2.6} strokeLinecap="round" fill="none" opacity={0.75} />
        </>
      );
  }
}

/**
 * Rostro holográfico flotante de Gaby (sin cuerpo): una cabeza en 4D que respira, flota
 * y gira suavemente todo el tiempo, con anillos de luz y expresiones propias por emoción.
 * Íntegramente vectorial (SVG) para que se vea nítida en cualquier tamaño.
 */
export default function GabyOrb({ state, emotionOverride, size = 220 }: Props) {
  const emotion = emotionOverride ?? STATE_EMOTION[state];
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const turn = useRef(new Animated.Value(0)).current;

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
            { translateY: floatY },
            { translateX: turnTranslateX },
            { scale: coreScale },
            { scaleX: turnScaleX },
            { rotate },
            { rotate: turnRotate },
          ],
        }}
      >
        <Svg width={size} height={size} viewBox="36 46 128 128">
          <Defs>
            <LinearGradient id="head" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
              <Stop offset="1" stopColor={colorA} stopOpacity={0.5} />
            </LinearGradient>
          </Defs>

          {/* halo */}
          <Circle cx={100} cy={100} r={54} fill={colorA} opacity={0.12} />

          {/* cabeza */}
          <Ellipse cx={100} cy={100} rx={40} ry={46} fill="url(#head)" opacity={0.9} />

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
