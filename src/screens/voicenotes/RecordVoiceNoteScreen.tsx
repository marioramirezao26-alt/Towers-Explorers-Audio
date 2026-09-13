import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Audio } from 'expo-av';
import { Button, Text, TextInput } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { uploadVoiceNote } from '@/services/voiceNotes';
import { RootStackParamList } from '@/navigation/RootNavigator';
import { colors } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'RecordVoiceNote'>;

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function RecordVoiceNoteScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const { workspace } = useWorkspace();
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [durationMillis, setDurationMillis] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    return () => {
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  const startRecording = async () => {
    setError(null);
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Necesitamos permiso de micrófono para grabar.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => setDurationMillis(status.durationMillis ?? 0),
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordedUri(null);
    } catch (e: any) {
      setError(`No se pudo iniciar la grabación: ${e?.message ?? e}`);
    }
  };

  const stopRecording = async () => {
    try {
      const recording = recordingRef.current;
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordedUri(uri);
      setIsRecording(false);
      recordingRef.current = null;
    } catch (e) {
      setError('No se pudo detener la grabación.');
    }
  };

  const handleSave = async () => {
    if (!workspace || !profile || !recordedUri) return;
    setUploading(true);
    setError(null);
    try {
      await uploadVoiceNote(
        workspace.id,
        profile.uid,
        recordedUri,
        title.trim() || 'Nota de voz',
        durationMillis,
      );
      navigation.goBack();
    } catch (e: any) {
      setError(`No se pudo guardar la nota de voz (${e?.code ?? 'error'}): ${e?.message ?? e}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="displaySmall" style={styles.timer}>
        {formatDuration(durationMillis)}
      </Text>

      {!isRecording && !recordedUri && (
        <Button mode="contained" icon="microphone" onPress={startRecording} style={styles.mainButton}>
          Empezar a grabar
        </Button>
      )}

      {isRecording && (
        <Button mode="contained" icon="stop" onPress={stopRecording} buttonColor={colors.error} style={styles.mainButton}>
          Detener
        </Button>
      )}

      {!isRecording && recordedUri && (
        <>
          <TextInput
            mode="outlined"
            label="Título de la nota (opcional)"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
          />
          <Button mode="contained" icon="content-save-outline" onPress={handleSave} loading={uploading} style={styles.mainButton}>
            Guardar y transcribir
          </Button>
          <Button onPress={() => setRecordedUri(null)} textColor={colors.accent}>
            Grabar de nuevo
          </Button>
        </>
      )}

      {error && (
        <Text style={styles.error} variant="bodySmall">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  timer: { marginBottom: 32, fontVariant: ['tabular-nums'], color: colors.accent },
  mainButton: { width: '100%', marginTop: 8 },
  input: { width: '100%', marginBottom: 16 },
  error: { color: colors.error, marginTop: 16, textAlign: 'center' },
});
