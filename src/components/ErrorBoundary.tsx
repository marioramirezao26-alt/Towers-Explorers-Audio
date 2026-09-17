import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  info: string;
}

/**
 * Muestra el error en pantalla en vez de dejar que la app se cierre sola.
 *
 * Cuando algo falla al arrancar, Android solo dice "Gaby se detuvo", que no
 * dice nada de la causa y obliga a conectar el teléfono a un computador para
 * leer el log. Con esto el error queda a la vista y basta una captura de
 * pantalla para diagnosticarlo.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ info: info.componentStack ?? '' });
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Gaby no pudo abrir</Text>
          <Text style={styles.subtitle}>
            Manda una captura de esta pantalla para poder arreglarlo.
          </Text>

          <Text style={styles.label}>Error</Text>
          <Text selectable style={styles.mono}>
            {error.name}: {error.message}
          </Text>

          {!!error.stack && (
            <>
              <Text style={styles.label}>Dónde ocurrió</Text>
              <Text selectable style={styles.mono}>
                {error.stack.split('\n').slice(0, 8).join('\n')}
              </Text>
            </>
          )}

          {!!info && (
            <>
              <Text style={styles.label}>Componente</Text>
              <Text selectable style={styles.mono}>
                {info.split('\n').slice(0, 8).join('\n')}
              </Text>
            </>
          )}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#03060f' },
  content: { padding: 24, paddingTop: 64 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: colors.textMuted, fontSize: 15, marginBottom: 28, lineHeight: 21 },
  label: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  mono: {
    color: '#E6EAF5',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
});
