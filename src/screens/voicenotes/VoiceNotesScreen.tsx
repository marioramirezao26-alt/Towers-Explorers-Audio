import React, { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, FAB, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
import { colors } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATUS_LABEL: Record<VoiceNote['status'], string> = {
  uploading: 'Subiendo…',
  transcribing: 'Transcribiendo…',
  done: 'Lista',
  error: 'Error',
};

const STATUS_COLOR: Record<VoiceNote['status'], string> = {
  uploading: colors.textMuted,
  transcribing: colors.accent,
  done: colors.success,
  error: colors.error,
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
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Notas de voz
        </Text>
      </View>

      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="waveform" size={40} color={colors.textMuted} />
            <Text style={styles.empty}>Aún no hay notas. Toca + para grabar una idea.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.card} mode="contained">
            <Card.Content>
              <View style={styles.rowBetween}>
                <Text variant="titleMedium" style={[styles.grow, styles.cardTitle]}>
                  {item.title}
                </Text>
                <Chip
                  compact
                  style={{ backgroundColor: STATUS_COLOR[item.status] + '26' }}
                  textStyle={{ color: STATUS_COLOR[item.status] }}
                  icon={item.status === 'done' ? 'check' : undefined}
                >
                  {STATUS_LABEL[item.status]}
                </Chip>
              </View>
              <Text variant="bodySmall" style={styles.date}>
                {format(new Date(item.createdAt), "d 'de' MMMM, HH:mm", { locale: es })}
              </Text>
              {item.status === 'transcribing' && (
                <ActivityIndicator style={styles.spinner} size="small" color={colors.accent} />
              )}
              {item.transcript && (
                <Text
                  style={[styles.transcript, item.status === 'error' && { color: colors.error }]}
                  variant="bodyMedium"
                >
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
              <Button icon="delete-outline" textColor={colors.error} onPress={() => handleDelete(item)}>
                Eliminar
              </Button>
            </Card.Actions>
          </Card>
        )}
      />

      <FAB
        icon="microphone-plus"
        color="#FFFFFF"
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={() => navigation.navigate('RecordVoiceNote')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: 16, paddingBottom: 8 },
  headerTitle: { color: colors.text },
  list: { padding: 16, paddingTop: 0, paddingBottom: 96 },
  card: { marginBottom: 12, backgroundColor: colors.surface },
  cardTitle: { color: colors.text },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grow: { flex: 1, marginRight: 8 },
  date: { marginTop: 4, color: colors.textMuted },
  spinner: { alignSelf: 'flex-start', marginTop: 8 },
  transcript: { marginTop: 10, color: colors.text, opacity: 0.9 },
  emptyContainer: { alignItems: 'center', marginTop: 48 },
  empty: { textAlign: 'center', marginTop: 12, color: colors.textMuted },
  fab: { position: 'absolute', right: 16, backgroundColor: colors.primary },
});
