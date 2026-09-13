import React, { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, FAB, Text } from 'react-native-paper';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { subscribeToVoiceNotes, deleteVoiceNote } from '@/services/voiceNotes';
import { VoiceNote } from '@/types';
import { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATUS_LABEL: Record<VoiceNote['status'], string> = {
  uploading: 'Subiendo…',
  transcribing: 'Transcribiendo…',
  done: 'Transcrita',
  error: 'Error al transcribir',
};

export default function VoiceNotesScreen() {
  const { workspace } = useWorkspace();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    if (!workspace) return;
    return subscribeToVoiceNotes(workspace.id, setNotes);
  }, [workspace?.id]);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const handlePlay = async (note: VoiceNote) => {
    if (!note.audioUrl) return;
    if (playingId === note.id) {
      await soundRef.current?.stopAsync();
      await soundRef.current?.unloadAsync();
      soundRef.current = null;
      setPlayingId(null);
      return;
    }
    await soundRef.current?.unloadAsync();
    const { sound } = await Audio.Sound.createAsync({ uri: note.audioUrl }, { shouldPlay: true });
    soundRef.current = sound;
    setPlayingId(note.id);
    sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
      if (status.isLoaded && status.didJustFinish) {
        setPlayingId(null);
      }
    });
  };

  const handleDelete = (note: VoiceNote) => {
    if (!workspace) return;
    deleteVoiceNote(workspace.id, note);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text variant="headlineSmall">Notas de voz</Text>
      </View>

      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>Aún no hay notas. Toca + para grabar una idea.</Text>
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.rowBetween}>
                <Text variant="titleMedium" style={styles.grow}>
                  {item.title}
                </Text>
                <Chip compact icon={item.status === 'done' ? 'check' : undefined}>
                  {STATUS_LABEL[item.status]}
                </Chip>
              </View>
              <Text variant="bodySmall" style={styles.date}>
                {format(new Date(item.createdAt), "d 'de' MMMM, HH:mm", { locale: es })}
              </Text>
              {item.status === 'transcribing' && (
                <ActivityIndicator style={styles.spinner} size="small" />
              )}
              {item.transcript && (
                <Text style={styles.transcript} variant="bodyMedium">
                  {item.transcript}
                </Text>
              )}
            </Card.Content>
            <Card.Actions>
              <Button
                icon={playingId === item.id ? 'pause' : 'play'}
                onPress={() => handlePlay(item)}
                disabled={!item.audioUrl}
              >
                {playingId === item.id ? 'Pausar' : 'Escuchar'}
              </Button>
              <Button onPress={() => handleDelete(item)}>Eliminar</Button>
            </Card.Actions>
          </Card>
        )}
      />

      <FAB
        icon="microphone-plus"
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={() => navigation.navigate('RecordVoiceNote')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 16, paddingBottom: 8 },
  list: { padding: 16, paddingTop: 0, paddingBottom: 96 },
  card: { marginBottom: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grow: { flex: 1, marginRight: 8 },
  date: { marginTop: 4, opacity: 0.7 },
  spinner: { alignSelf: 'flex-start', marginTop: 8 },
  transcript: { marginTop: 10, opacity: 0.85 },
  empty: { textAlign: 'center', marginTop: 48, opacity: 0.6 },
  fab: { position: 'absolute', right: 16 },
});
