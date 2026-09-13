import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export default function HomeScreen() {
  const { profile, signOut } = useAuth();
  const { workspace } = useWorkspace();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, padding: 16 }}
    >
      <Text variant="headlineMedium">Hola, {profile?.displayName ?? 'de nuevo'} 👋</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Este es tu espacio compartido con tu socio.
      </Text>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">{workspace?.name}</Text>
          <Text variant="bodySmall" style={styles.hint}>
            Comparte este código con tu socio para que se una a este espacio:
          </Text>
          <Text variant="headlineSmall" style={styles.code}>
            {workspace?.inviteCode}
          </Text>
          <Text variant="bodySmall" style={styles.hint}>
            {workspace?.memberIds.length ?? 0} persona(s) en este espacio
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">¿Qué puede hacer tu asistente?</Text>
          <Text style={styles.bullet}>📅 Agendar citas y sincronizarlas con Google Calendar</Text>
          <Text style={styles.bullet}>🎙️ Grabar notas de voz y transcribirlas a texto</Text>
          <Text style={styles.bullet}>🤝 Mantener todo sincronizado entre tú y tu socio</Text>
        </Card.Content>
      </Card>

      <Button onPress={signOut} style={styles.signOut}>
        Cerrar sesión
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  subtitle: { opacity: 0.7, marginTop: 4, marginBottom: 20 },
  card: { marginBottom: 16 },
  hint: { opacity: 0.7, marginTop: 8 },
  code: { letterSpacing: 4, marginVertical: 4 },
  bullet: { marginTop: 10 },
  signOut: { marginTop: 8, marginBottom: 32 },
});
