import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { useAuth } from '@/contexts/AuthContext';
import { createWorkspace, joinWorkspaceByInviteCode } from '@/services/workspaces';

export default function WorkspaceSetupScreen() {
  const { profile, signOut } = useAuth();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [workspaceName, setWorkspaceName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!profile) return;
    setError(null);
    setLoading(true);
    try {
      if (mode === 'create') {
        if (!workspaceName.trim()) {
          setError('Ponle un nombre a tu espacio de trabajo.');
          return;
        }
        await createWorkspace(workspaceName.trim(), profile.uid);
      } else {
        if (!inviteCode.trim()) {
          setError('Ingresa el código de invitación de tu socio.');
          return;
        }
        await joinWorkspaceByInviteCode(inviteCode, profile.uid);
      }
    } catch (e: any) {
      setError(e.message ?? 'Ocurrió un error, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        Configura tu espacio compartido
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Crea un espacio nuevo o únete al de tu socio para compartir citas y notas de voz.
      </Text>

      <SegmentedButtons
        value={mode}
        onValueChange={(v) => setMode(v as 'create' | 'join')}
        style={styles.segmented}
        buttons={[
          { value: 'create', label: 'Crear espacio' },
          { value: 'join', label: 'Unirme con código' },
        ]}
      />

      {mode === 'create' ? (
        <TextInput
          label="Nombre del espacio (ej. Mi Empresa)"
          value={workspaceName}
          onChangeText={setWorkspaceName}
          style={styles.input}
        />
      ) : (
        <TextInput
          label="Código de invitación"
          value={inviteCode}
          onChangeText={setInviteCode}
          autoCapitalize="characters"
          style={styles.input}
        />
      )}

      {error && (
        <Text style={styles.error} variant="bodySmall">
          {error}
        </Text>
      )}

      <Button mode="contained" onPress={handleSubmit} loading={loading} style={styles.button}>
        {mode === 'create' ? 'Crear espacio' : 'Unirme'}
      </Button>
      <Button onPress={signOut}>Cerrar sesión</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { textAlign: 'center', marginBottom: 8 },
  subtitle: { textAlign: 'center', marginBottom: 24, opacity: 0.7 },
  segmented: { marginBottom: 24 },
  input: { marginBottom: 12 },
  button: { marginTop: 8, marginBottom: 4 },
  error: { color: '#DC2626', marginBottom: 8, textAlign: 'center' },
});
