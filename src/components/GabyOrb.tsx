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

/** Rostro (cejas, ojos y boca) de Gaby para cada emoción, sobre la cabeza (cx=100, cy=70). */
function Face({ emotion }: { emotion: Emotion }) {
  switch (emotion) {
    case 'feliz':
      return (
        <>
          <Path d="M79 48 Q86 44 93 47" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.6} />
          <Path d="M107 47 Q114 44 121 48" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.6} />
          <Path d="M80 61 Q86 55 92 61" stroke={INK} strokeWidth={2.6} strokeLinecap="round" fill="none" opacity={0.85} />
          <Path d="M108 61 Q114 55 120 61" stroke={INK} strokeWidth={2.6} strokeLinecap="round" fill="none" opacity={0.85} />
          <Path d="M82 82 Q100 102 118 82" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.85} />
          <Circle cx={72} cy={74} r={3} fill={colors.success} opacity={0.45} />
          <Circle cx={128} cy={74} r={3} fill={colors.success} opacity={0.45} />
        </>
      );
    case 'enojo':
      return (
        <>
          <Path d="M78 46 L94 55" stroke={colors.error} strokeWidth={4} strokeLinecap="round" />
          <Path d="M122 46 L106 55" stroke={colors.error} strokeWidth={4} strokeLinecap="round" />
          <Ellipse cx={86} cy={64} rx={3} ry={2} fill={INK} opacity={0.85} />
          <Ellipse cx={114} cy={64} rx={3} ry={2} fill={INK} opacity={0.85} />
          <Path d="M84 93 Q100 83 116 93" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.85} />
        </>
      );
    case 'tristeza':
      return (
        <>
          <Path d="M79 53 Q86 47 93 46" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.6} />
          <Path d="M107 46 Q114 47 121 53" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.6} />
          <Path d="M80 63 Q86 68 92 63" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.8} />
          <Path d="M108 63 Q114 68 120 63" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.8} />
          <Path d="M114 69 q-2.4 5 0 8 q2.4 -3 0 -8" fill={colors.accent} opacity={0.75} />
          <Path d="M88 90 Q100 84 112 90" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.8} />
        </>
      );
    case 'mareado':
      return (
        <>
          <Path d="M80 50 Q86 48 92 50" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.3} />
          <Path d="M108 50 Q114 48 120 50" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.3} />
          <Path
            d="M86 55 C92 55 93 61 88 63 C85 64.3 81.5 62 82.5 59 C83.3 56.6 86.5 56 87.5 58"
            stroke={colors.primary}
            strokeWidth={2.1}
            strokeLinecap="round"
            fill="none"
            opacity={0.95}
          />
          <Path
            d="M114 55 C108 55 107 61 112 63 C115 64.3 118.5 62 117.5 59 C116.7 56.6 113.5 56 112.5 58"
            stroke={colors.primary}
            strokeWidth={2.1}
            strokeLinecap="round"
            fill="none"
            opacity={0.95}
          />
          <Path d="M85 87 Q91 82 97 87 Q103 92 109 87 Q113 84 116 85.5" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.8} />
        </>
      );
    case 'confundido':
      return (
        <>
          <Path d="M78 53 L94 55" stroke={INK} strokeWidth={2.4} strokeLinecap="round" opacity={0.65} />
          <Path d="M106 47 Q114 40 122 47" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.65} />
          <Ellipse cx={86} cy={63} rx={2.6} ry={3.2} fill={INK} opacity={0.8} />
          <Ellipse cx={114} cy={60} rx={4} ry={4.8} fill={INK} opacity={0.8} />
          <Path d="M88 88 Q94 85 98 88 Q102 91 108 87" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.8} />
        </>
      );
    case 'neutral':
    default:
      return (
        <>
          <Path d="M80 50 Q86 48 92 50" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.55} />
          <Path d="M108 50 Q114 48 120 50" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.55} />
          <Ellipse cx={86} cy={62} rx={3.2} ry={4} fill={INK} opacity={0.8} />
          <Ellipse cx={114} cy={62} rx={3.2} ry={4} fill={INK} opacity={0.8} />
          <Path d="M89 85 Q100 90 111 85" stroke={INK} strokeWidth={2.6} strokeLinecap="round" fill="none" opacity={0.75} />
        </>
      );
  }
}

/**
 * Silueta humanoide holográfica con rostro propio: rejilla de líneas + núcleo de luz.
 * Íntegramente vectorial (SVG) para que se vea nítida en cualquier tamaño.
 */
export default function GabyOrb({ state, emotionOverride, size = 220 }: Props) {
  const emotion = emotionOverride ?? STATE_EMOTION[state];
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;

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

  const [colorA, colorB] = EMOTION_META[emotion].colors;
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const coreScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.04] });
  const floatY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const rotate = tilt.interpolate({ inputRange: [-45, 45], outputRange: ['-45deg', '45deg'] });

  return (
    <View style={[styles.container, { width: size, height: size * 1.35 }]}>
      <Animated.View
        style={[
          styles.haze,
          { width: size * 2.1, height: size * 2.1, borderRadius: size, backgroundColor: colorA, opacity: Animated.multiply(glowOpacity, 0.12) },
        ]}
      />
      <Animated.View
        style={[
          styles.haze,
          { width: size * 1.5, height: size * 1.5, borderRadius: size, backgroundColor: colorA, opacity: Animated.multiply(glowOpacity, 0.22) },
        ]}
      />
      <Animated.View
        style={[
          styles.haze,
          { width: size * 1.05, height: size * 1.05, borderRadius: size, backgroundColor: colorB, opacity: Animated.multiply(glowOpacity, 0.3) },
        ]}
      />
      <Animated.View style={{ transform: [{ translateY: floatY }, { scale: coreScale }, { rotate }] }}>
        <Svg width={size} height={size * 1.35} viewBox="0 0 200 270">
          <Defs>
            <LinearGradient id="body" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colorB} stopOpacity={0.95} />
              <Stop offset="1" stopColor={colorA} stopOpacity={0.35} />
            </LinearGradient>
            <LinearGradient id="head" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
              <Stop offset="1" stopColor={colorA} stopOpacity={0.5} />
            </LinearGradient>
          </Defs>

          {/* halo */}
          <Circle cx={100} cy={70} r={54} fill={colorA} opacity={0.12} />

          {/* cuerpo (silueta con forma de vestido/túnica) */}
          <Path
            d="M62 160 C58 140 66 112 100 108 C134 112 142 140 138 160
               L152 254 C154 262 148 268 140 268 L60 268
               C52 268 46 262 48 254 Z"
            fill="url(#body)"
            opacity={0.85}
          />

          {/* cabeza */}
          <Ellipse cx={100} cy={70} rx={30} ry={34} fill="url(#head)" opacity={0.9} />

          {/* rostro */}
          <Face emotion={emotion} />

          {/* líneas de "malla" holográfica sobre el cuerpo */}
          {[130, 160, 190, 220, 250].map((y, i) => (
            <Path
              key={y}
              d={`M${52 + i * 2} ${y} L${148 - i * 2} ${y}`}
              stroke={colorA}
              strokeWidth={1}
              opacity={0.35}
            />
          ))}
          <Path d="M100 40 L100 268" stroke={colorA} strokeWidth={1} opacity={0.25} />

          {/* brazos */}
          <Path
            d="M60 150 C40 165 30 190 34 220"
            stroke="url(#body)"
            strokeWidth={10}
            strokeLinecap="round"
            fill="none"
            opacity={0.8}
          />
          <Path
            d="M140 150 C160 165 170 190 166 220"
            stroke="url(#body)"
            strokeWidth={10}
            strokeLinecap="round"
            fill="none"
            opacity={0.8}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  haze: { position: 'absolute' },
});
