import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

interface Star {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
}

function makeStars(count: number, width: number, height: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: 1.5 + Math.random() * 3.5,
    delay: Math.random() * 2200,
    duration: 2200 + Math.random() * 2600,
  }));
}

function Star({ star }: { star: Star }) {
  const opacity = useRef(new Animated.Value(0.12)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: star.duration,
          delay: star.delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.12,
          duration: star.duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        styles.star,
        {
          left: star.x,
          top: star.y,
          width: star.size,
          height: star.size,
          borderRadius: star.size / 2,
          opacity,
        },
      ]}
    />
  );
}

/** Fondo de partículas ("polvo estelar") para la ambientación holográfica. */
export default function StarField({ count = 46 }: { count?: number }) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const stars = useMemo(
    () => (size.width && size.height ? makeStars(count, size.width, size.height) : []),
    [size.width, size.height, count],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.round(width) !== Math.round(size.width) || Math.round(height) !== Math.round(size.height)) {
      setSize({ width, height });
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {stars.map((star, i) => (
        <Star key={i} star={star} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  star: { position: 'absolute', backgroundColor: colors.accent },
});
