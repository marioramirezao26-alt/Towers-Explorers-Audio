import React, { useState } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@/contexts/AuthContext';
import { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

function describeSignupError(e: any): string {
  switch (e?.code) {
    case 'auth/email-already-in-use':
      return 'Ese correo ya tiene una cuenta. Intenta iniciar sesión en su lugar.';
    case 'auth/invalid-email':
      return 'Ese correo no es válido.';
    case 'auth/weak-password':
      return 'La contraseña es muy débil, usa al menos 6 caracteres.';
    case 'auth/network-request-failed':
      return 'No hay conexión a internet. Revisa tu red e intenta de nuevo.';
    case 'permission-denied':
      return 'Firestore rechazó la escritura (permission-denied). Revisa que hayas desplegado firestore.rules a tu proyecto.';
    default:
      return `No pudimos crear tu cuenta (${e?.code ?? 'error desconocido'}): ${e?.message ?? e}`;
  }
}

export default function SignupScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setError(null);
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim());
    } catch (e: any) {
      setError(describeSignupError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text variant="headlineMedium" style={styles.title}>
        Crea tu cuenta
      </Text>

      <TextInput label="Tu nombre" value={name} onChangeText={setName} style={styles.input} />
      <TextInput
        label="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
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

      <Button mode="contained" onPress={handleSignup} loading={loading} style={styles.button}>
        Registrarme
      </Button>
      <Button onPress={() => navigation.goBack()}>Ya tengo cuenta</Button>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { textAlign: 'center', marginBottom: 32 },
  input: { marginBottom: 12 },
  button: { marginTop: 8, marginBottom: 4 },
  error: { color: '#DC2626', marginBottom: 8, textAlign: 'center' },
});
