import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, Stop, Circle } from 'react-native-svg';
import { colors } from '@/theme';

export type OrbState = 'idle' | 'listening' | 'awaiting-command' | 'thinking' | 'speaking';

const STATE_COLOR: Record<OrbState, [string, string]> = {
  idle: [colors.accent, colors.primary],
  listening: [colors.accent, '#5EF2FF'],
  'awaiting-command': [colors.primary, colors.accent],
  thinking: [colors.primary, '#B79CFF'],
  speaking: [colors.success, colors.accent],
};

const STATE_SPEED: Record<OrbState, number> = {
  idle: 2600,
  listening: 1400,
  'awaiting-command': 900,
  thinking: 650,
  speaking: 500,
};

interface Props {
  state: OrbState;
  size?: number;
}

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

/**
 * Silueta humanoide holográfica: rejilla de líneas + núcleo de luz.
 * Íntegramente vectorial (SVG) para que se vea nítida en cualquier tamaño.
 */
export default function GabyOrb({ state, size = 220 }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: STATE_SPEED[state],
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: STATE_SPEED[state],
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const [colorA, colorB] = STATE_COLOR[state];
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const coreScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.04] });
  const floatY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  return (
    <View style={[styles.container, { width: size, height: size * 1.35 }]}>
      <Animated.View
        style={[
          styles.haze,
          {
            width: size * 2.1,
            height: size * 2.1,
            borderRadius: size,
            backgroundColor: colorA,
            opacity: Animated.multiply(glowOpacity, 0.12),
          },
        ]}
      />
      <Animated.View
        style={[
          styles.haze,
          {
            width: size * 1.5,
            height: size * 1.5,
            borderRadius: size,
            backgroundColor: colorA,
            opacity: Animated.multiply(glowOpacity, 0.22),
          },
        ]}
      />
      <Animated.View
        style={[
          styles.haze,
          {
            width: size * 1.05,
            height: size * 1.05,
            borderRadius: size,
            backgroundColor: colorB,
            opacity: Animated.multiply(glowOpacity, 0.3),
          },
        ]}
      />
      <Animated.View style={{ transform: [{ translateY: floatY }, { scale: coreScale }] }}>
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
