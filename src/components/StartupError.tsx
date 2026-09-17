import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

interface Props {
  error: Error;
}

/** Pantalla para un fallo de arranque, antes de que exista el resto de la app. */
export default function StartupError({ error }: Props) {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Gaby no pudo arrancar</Text>
        <Text style={styles.subtitle}>
          Manda una captura de esta pantalla para poder arreglarlo.
        </Text>

        <Text style={styles.label}>Motivo</Text>
        <Text selectable style={styles.mono}>
          {error.message}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#03060f' },
  content: { padding: 24, paddingTop: 72 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: colors.textMuted, fontSize: 15, marginBottom: 28, lineHeight: 21 },
  label: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  mono: { color: '#E6EAF5', fontSize: 13, fontFamily: 'monospace', lineHeight: 20 },
});
