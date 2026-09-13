import React, { useState } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@/contexts/AuthContext';
import { RootStackParamList } from '@/navigation/RootNavigator';
import { colors } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

function describeLoginError(e: any): string {
  switch (e?.code) {
    case 'auth/invalid-email':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Correo o contraseña incorrectos.';
    case 'auth/network-request-failed':
      return 'No hay conexión a internet. Revisa tu red e intenta de nuevo.';
    default:
      return `No pudimos iniciar sesión (${e?.code ?? 'error desconocido'}): ${e?.message ?? e}`;
  }
}

export default function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (e: any) {
      setError(describeLoginError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <MaterialCommunityIcons
        name="hexagon-multiple-outline"
        size={48}
        color={colors.accent}
        style={styles.logo}
      />
      <Text variant="headlineMedium" style={styles.title}>
        Gaby
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Tu mano derecha: agenda citas y captura tus ideas de voz, junto a tu socio.
      </Text>

      <TextInput
        mode="outlined"
        label="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        mode="outlined"
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      {error && (
        <Text style={styles.error} variant="bodySmall">
          {error}
        </Text>
      )}

      <Button mode="contained" onPress={handleLogin} loading={loading} style={styles.button}>
        Entrar
      </Button>
      <Button onPress={() => navigation.navigate('Signup')} textColor={colors.accent}>
        Crear una cuenta
      </Button>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  logo: { alignSelf: 'center', marginBottom: 12 },
  title: { textAlign: 'center', marginBottom: 8, color: colors.text },
  subtitle: { textAlign: 'center', marginBottom: 32, color: colors.textMuted },
  input: { marginBottom: 12 },
  button: { marginTop: 8, marginBottom: 4 },
  error: { color: colors.error, marginBottom: 8, textAlign: 'center' },
});
