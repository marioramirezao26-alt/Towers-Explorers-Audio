import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, Stop, Circle, Rect } from 'react-native-svg';
import { colors } from '@/theme';
import GabyVrmFace from './GabyVrmFace';
import { Emotion, EMOTION_META, OrbState, STATE_EMOTION } from './gabyOrbShared';

// Configurable por variable de entorno para no tocar código cuando consigas un
// modelo VRM propio — ver GabyVrmFace.tsx para de dónde sacar uno con licencia
// que sí te permita usarlo aquí (VRoid Studio, por ejemplo).
const VRM_MODEL_URL = process.env.EXPO_PUBLIC_VRM_MODEL_URL;

export type { Emotion, OrbState } from './gabyOrbShared';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

// Paleta "humana" del rostro (independiente del color del aro holográfico, que sigue
// usando los tonos de marca según la emoción). Solo la usa el respaldo vectorial (no
// web) — en web el rostro real es GabyVrmFace (avatar VRM 3D).
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
  /** Se incrementa en cada límite de palabra real del habla — ver GabyVrmFace. */
  talkPulse?: number;
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
 * Presencia flotante de Gaby. En web (la plataforma real de la app) el rostro es
 * GabyVrmFace: un avatar VRM 3D real (Three.js + three-vrm), o un marcador de
 * posición mientras no haya un modelo VRM configurado. El busto cyborg/androide
 * vectorial (SVG) de aquí abajo queda como respaldo para cuando se abre en Expo Go
 * / nativo, donde no hay <canvas>/WebGL del DOM disponible — ese es el siguiente
 * paso (un WebView, como hace Scowld). En ambos casos este componente pone el halo
 * ambiental y el movimiento (respirar, flotar, girar, inclinarse con el sensor del
 * teléfono) alrededor del rostro.
 */
export default function GabyOrb({ state, emotionOverride, size = 220, tiltX, tiltY, talkPulse }: Props) {
  const emotion = emotionOverride ?? STATE_EMOTION[state];
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const turn = useRef(new Animated.Value(0)).current;
  const scan = useRef(new Animated.Value(0)).current;
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

  // Barrido de escaneo holográfico: una franja de luz que recorre el busto de arriba a
  // abajo sin parar, como un holograma leyéndose a sí mismo.
  useEffect(() => {
    scan.setValue(0);
    const loop = Animated.loop(
      Animated.timing(scan, { toValue: 1, duration: 3400, easing: Easing.linear, useNativeDriver: false }),
    );
    loop.start();
    return () => loop.stop();
  }, [scan]);

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
  const scanY = scan.interpolate({ inputRange: [0, 1], outputRange: [12, 236] });
  const ringOpacityOuter = Animated.multiply(glowOpacity, 0.6);
  const ringOpacityMid = Animated.multiply(glowOpacity, 0.85);
  const ringOpacityInner = glowOpacity;

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
        {Platform.OS === 'web' ? (
          <GabyVrmFace state={state} emotion={emotion} size={size} modelUrl={VRM_MODEL_URL} talkPulse={talkPulse} />
        ) : (
        <Svg width={size} height={size} viewBox="0 0 200 250">
          <Defs>
            <LinearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#F6D9BE" />
              <Stop offset="1" stopColor="#DFAE81" />
            </LinearGradient>
            <LinearGradient id="hair" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#4A3222" />
              <Stop offset="1" stopColor="#2A1C14" />
            </LinearGradient>
            <LinearGradient id="plate" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#B8C4D2" />
              <Stop offset="1" stopColor="#576270" />
            </LinearGradient>
            <LinearGradient id="chrome" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#EAF1F8" />
              <Stop offset="0.55" stopColor="#B7C4D3" />
              <Stop offset="1" stopColor="#7C8A99" />
            </LinearGradient>
            <LinearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colorA} stopOpacity={0} />
              <Stop offset="0.5" stopColor={colorA} stopOpacity={0.55} />
              <Stop offset="1" stopColor={colorA} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {/* halo holográfico */}
          <Circle cx={100} cy={100} r={62} fill={colorA} opacity={0.14} />

          {/* hombros y pecho mecánico, con placas y remaches */}
          <Path d="M30 235 Q38 182 76 175 L100 184 L124 175 Q162 182 170 235 L170 250 L30 250 Z" fill="url(#plate)" />
          <Path d="M38 182 Q58 174 76 175" stroke={colorA} strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.6} />
          <Path d="M162 182 Q142 174 124 175" stroke={colorA} strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.6} />
          <Path d="M100 184 L94 235" stroke={colorA} strokeWidth={1.2} strokeLinecap="round" fill="none" opacity={0.4} />
          <Path d="M100 184 L106 235" stroke={colorA} strokeWidth={1.2} strokeLinecap="round" fill="none" opacity={0.4} />
          <Path d="M70 200 L90 195" stroke="#3A4250" strokeWidth={1.2} fill="none" opacity={0.5} />
          <Path d="M130 200 L110 195" stroke="#3A4250" strokeWidth={1.2} fill="none" opacity={0.5} />
          <Circle cx={78} cy={178} r={1.8} fill={colorA} opacity={0.6} />
          <Circle cx={122} cy={178} r={1.8} fill={colorA} opacity={0.6} />
          <Circle cx={100} cy={190} r={1.6} fill={colorA} opacity={0.5} />

          {/* cuello robótico segmentado */}
          <Path d="M88 140 L112 140 L114 172 L86 172 Z" fill="url(#chrome)" />
          <Path d="M89 150 L111 150" stroke="#3A4250" strokeWidth={1.4} opacity={0.6} />
          <Path d="M88 160 L112 160" stroke={colorA} strokeWidth={0.9} opacity={0.5} />

          {/* cuello alto de placas metálicas, a los lados del cuello */}
          <Path d="M62 172 Q72 146 96 143 L101 153 Q84 158 76 180 Z" fill="url(#plate)" />
          <Path d="M138 172 Q128 146 104 143 L99 153 Q116 158 124 180 Z" fill="url(#plate)" />
          <Path d="M96 143 Q80 150 76 180" stroke={colorA} strokeWidth={1.3} fill="none" opacity={0.55} />
          <Path d="M104 143 Q120 150 124 180" stroke={colorA} strokeWidth={1.3} fill="none" opacity={0.55} />

          {/* orejas: izquierda orgánica, derecha una pieza mecánica con remache */}
          <Ellipse cx={60} cy={108} rx={6.5} ry={10} fill="url(#skin)" />
          <Ellipse cx={140} cy={108} rx={6.5} ry={10} fill="url(#chrome)" />
          <Circle cx={140} cy={108} r={2} fill={colorA} opacity={0.6} />

          {/* cabello recogido (detrás de la cara: sobresale arriba y a los lados) */}
          <Ellipse cx={100} cy={88} rx={41} ry={45} fill="url(#hair)" />

          {/* cara: mitad orgánica, mitad placa robótica (rostro cyborg) */}
          <Ellipse cx={100} cy={106} rx={37} ry={41} fill="url(#skin)" />
          <Path d="M100 65 A37 41 0 0 1 100 147 Z" fill="url(#chrome)" />
          {/* costuras/paneles sobre la mitad robótica */}
          <Path d="M108 80 L108 95 L118 100" stroke="#4A5563" strokeWidth={1} fill="none" opacity={0.55} />
          <Path d="M112 110 L124 112" stroke="#4A5563" strokeWidth={1} fill="none" opacity={0.55} />
          <Path d="M105 125 L115 130 L112 138" stroke="#4A5563" strokeWidth={1} fill="none" opacity={0.55} />
          <Circle cx={122} cy={95} r={1.4} fill={colorA} opacity={0.65} />
          <Circle cx={118} cy={125} r={1.2} fill={colorA} opacity={0.55} />
          {/* costura central que divide el rostro humano del robótico */}
          <Path d="M100 66 L100 146" stroke="#2A2F3A" strokeWidth={1.6} opacity={0.5} />
          <Path d="M100 66 L100 146" stroke={colorA} strokeWidth={0.8} opacity={0.55} />
          {/* aro de luz sutil en el borde, para no perder del todo el look holográfico */}
          <Ellipse cx={100} cy={106} rx={37} ry={41} fill="none" stroke={colorA} strokeWidth={1.4} opacity={0.35} />
          {/* luz de borde azulada, como si la luz cayera desde arriba a la derecha */}
          <Path
            d="M100 65 C120 68 137 85 137 106 C137 127 120 144 100 147"
            stroke="#BFE8FF"
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
            opacity={0.5}
          />
          {/* aro luminoso alrededor del ojo robótico */}
          <Circle cx={114} cy={99} r={9} stroke={colorA} strokeWidth={1.2} fill="none" opacity={0.6} />

          {/* raya al medio y chongo, para un look recogido y prolijo */}
          <Path d="M100 46 L100 74" stroke="#2A1C14" strokeWidth={1.4} opacity={0.55} />
          <Circle cx={100} cy={46} r={14} fill="url(#hair)" />
          <Path d="M87 52 Q100 58 113 52" stroke="#2A1C14" strokeWidth={2.6} strokeLinecap="round" fill="none" opacity={0.6} />

          {/* mechón/flequillo sutil sobre la frente */}
          <Path d="M66 82 Q100 64 134 82 Q100 73 66 82 Z" fill="url(#hair)" opacity={0.95} />

          {/* líneas de circuito holográficas sobre sien y mejilla */}
          <Path d="M66 94 L74 94 L74 100" stroke={colorA} strokeWidth={1} fill="none" opacity={0.4} />
          <Path d="M134 120 L128 120 L128 126" stroke={colorA} strokeWidth={1} fill="none" opacity={0.4} />

          {/* rostro */}
          <Face emotion={emotion} />

          {/* anillos de proyección holográfica en la base */}
          <AnimatedEllipse cx={100} cy={246} rx={90} ry={9} stroke={colorB} strokeWidth={1.6} fill="none" opacity={ringOpacityOuter} />
          <AnimatedEllipse cx={100} cy={246} rx={68} ry={7} stroke={colorA} strokeWidth={1.3} fill="none" opacity={ringOpacityMid} />
          <AnimatedEllipse cx={100} cy={246} rx={46} ry={5} stroke={colorA} strokeWidth={1} fill="none" opacity={ringOpacityInner} />

          {/* barrido de escaneo holográfico */}
          <AnimatedRect x={10} y={scanY} width={180} height={20} fill="url(#scanGrad)" opacity={0.4} />
        </Svg>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  haze: { position: 'absolute' },
});
