import React, { useState } from 'react';
import { StyleSheet, View, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@/contexts/AuthContext';
import { RootStackParamList } from '@/navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

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
      setError('No pudimos iniciar sesión. Revisa tu correo y contraseña.');
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
        Gaby
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Tu mano derecha: agenda citas y captura tus ideas de voz, junto a tu socio.
      </Text>

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

      <Button mode="contained" onPress={handleLogin} loading={loading} style={styles.button}>
        Entrar
      </Button>
      <Button onPress={() => navigation.navigate('Signup')}>Crear una cuenta</Button>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { textAlign: 'center', marginBottom: 8 },
  subtitle: { textAlign: 'center', marginBottom: 32, opacity: 0.7 },
  input: { marginBottom: 12 },
  button: { marginTop: 8, marginBottom: 4 },
  error: { color: '#DC2626', marginBottom: 8, textAlign: 'center' },
});
