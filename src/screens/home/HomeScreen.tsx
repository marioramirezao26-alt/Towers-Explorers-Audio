import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { colors } from '@/theme';

export default function HomeScreen() {
  const { profile, signOut } = useAuth();
  const { workspace } = useWorkspace();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, padding: 16 }}
    >
      <Text variant="headlineMedium" style={styles.title}>
        Hola, {profile?.displayName ?? 'de nuevo'} 👋
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Este es tu espacio compartido con tu socio.
      </Text>

      <Card style={styles.card} mode="contained">
        <Card.Content>
          <Text variant="titleMedium" style={styles.cardTitle}>
            {workspace?.name}
          </Text>
          <Text variant="bodySmall" style={styles.hint}>
            Comparte este código con tu socio para que se una a este espacio:
          </Text>
          <View style={styles.codeBox}>
            <Text variant="headlineSmall" style={styles.code}>
              {workspace?.inviteCode}
            </Text>
          </View>
          <View style={styles.row}>
            <MaterialCommunityIcons name="account-group" size={16} color={colors.textMuted} />
            <Text variant="bodySmall" style={[styles.hint, styles.rowText]}>
              {workspace?.memberIds.length ?? 0} persona(s) en este espacio
            </Text>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card} mode="contained">
        <Card.Content>
          <Text variant="titleMedium" style={styles.cardTitle}>
            ¿Qué puede hacer tu asistente?
          </Text>
          <View style={styles.featureRow}>
            <MaterialCommunityIcons name="calendar-clock" size={20} color={colors.accent} />
            <Text style={styles.bullet}>Agendar citas y sincronizarlas con Google Calendar</Text>
          </View>
          <View style={styles.featureRow}>
            <MaterialCommunityIcons name="waveform" size={20} color={colors.accent} />
            <Text style={styles.bullet}>Grabar notas de voz y transcribirlas a texto</Text>
          </View>
          <View style={styles.featureRow}>
            <MaterialCommunityIcons name="account-multiple-check" size={20} color={colors.accent} />
            <Text style={styles.bullet}>Mantener todo sincronizado entre tú y tu socio</Text>
          </View>
        </Card.Content>
      </Card>

      <Button onPress={signOut} style={styles.signOut} textColor={colors.textMuted}>
        Cerrar sesión
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { color: colors.text },
  subtitle: { color: colors.textMuted, marginTop: 4, marginBottom: 20 },
  card: { marginBottom: 16, backgroundColor: colors.surface },
  cardTitle: { color: colors.text, marginBottom: 4 },
  hint: { color: colors.textMuted, marginTop: 8 },
  codeBox: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  code: { letterSpacing: 6, color: colors.accent, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  rowText: { marginLeft: 6, marginTop: 0 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  bullet: { marginLeft: 10, color: colors.text, flex: 1 },
  signOut: { marginTop: 8, marginBottom: 32 },
});
