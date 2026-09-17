import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

interface Props {
  error: Error;
  /** De dónde salió el error, para saber qué se estaba haciendo al fallar. */
  origen?: string;
}

/**
 * Pantalla para un fallo de arranque, antes de que exista el resto de la app.
 *
 * No importa nada del proyecto a propósito (ni el tema, ni react-native-paper):
 * la usa App.tsx justamente cuando cargar esos módulos es lo que falló, así que
 * cualquier dependencia suya la volvería inútil en el único caso que importa.
 * Por eso los colores van escritos aquí en vez de venir de @/theme.
 */
export default function StartupError({ error, origen }: Props) {
  const pila = error.stack ? error.stack.split('\n').slice(0, 10).join('\n') : '';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Gaby no pudo arrancar</Text>
        <Text style={styles.subtitle}>
          Manda una captura de esta pantalla para poder arreglarlo.
        </Text>

        {!!origen && (
          <>
            <Text style={styles.label}>Al hacer</Text>
            <Text selectable style={styles.mono}>
              {origen}
            </Text>
          </>
        )}

        <Text style={styles.label}>Motivo</Text>
        <Text selectable style={styles.mono}>
          {error.name}: {error.message}
        </Text>

        {!!pila && (
          <>
            <Text style={styles.label}>Dónde ocurrió</Text>
            <Text selectable style={styles.mono}>
              {pila}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#03060f' },
  content: { padding: 24, paddingTop: 72 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#94A3B8', fontSize: 15, marginBottom: 12, lineHeight: 21 },
  label: {
    color: '#7DD3FC',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  mono: { color: '#E6EAF5', fontSize: 12, fontFamily: 'monospace', lineHeight: 18 },
});
