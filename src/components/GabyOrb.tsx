import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

export type OrbState = 'idle' | 'listening' | 'awaiting-command' | 'thinking' | 'speaking';

const STATE_COLOR: Record<OrbState, string> = {
  idle: colors.textMuted,
  listening: colors.accent,
  'awaiting-command': colors.primary,
  thinking: colors.primary,
  speaking: colors.success,
};

const STATE_SPEED: Record<OrbState, number> = {
  idle: 1600,
  listening: 900,
  'awaiting-command': 500,
  thinking: 350,
  speaking: 400,
};

interface Props {
  state: OrbState;
  size?: number;
}

export default function GabyOrb({ state, size = 72 }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

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

  const color = STATE_COLOR[state];
  const maxScale = state === 'idle' ? 1.06 : 1.22;
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, maxScale] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.85] });

  return (
    <View style={[styles.container, { width: size * 1.9, height: size * 1.9 }]}>
      <Animated.View
        style={[
          styles.glow,
          {
            width: size * 1.7,
            height: size * 1.7,
            borderRadius: size,
            backgroundColor: color,
            opacity: glowOpacity,
            transform: [{ scale }],
          },
        ]}
      />
      <View
        style={[
          styles.core,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            shadowColor: color,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute' },
  core: {
    position: 'absolute',
    shadowRadius: 24,
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
});
