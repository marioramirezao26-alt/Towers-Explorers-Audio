import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Chip, IconButton, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { sendAssistantMessage, subscribeToAssistantMessages } from '@/services/assistant';
import { useWakeWord } from '@/hooks/useWakeWord';
import { useSpeak } from '@/hooks/useSpeak';
import { AssistantMessage } from '@/types';
import { colors, glow } from '@/theme';
import GabyOrb, { OrbState } from '@/components/GabyOrb';

const STATUS_LABEL: Record<string, string> = {
  idle: 'Toca el micrófono para activar "Hey Gaby"',
  listening: 'Escuchando… di "Gaby" para hablarle',
  'awaiting-command': 'Te escucho, dime qué necesitas…',
  unsupported: 'Tu navegador no soporta comandos de voz',
  error: 'No se pudo activar el micrófono',
};

export default function AssistantScreen() {
  const { profile } = useAuth();
  const { workspace } = useWorkspace();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const sendingRef = useRef(false);
  const { speak, cancel: cancelSpeech, supported: speechSupported } = useSpeak();

  const handleSendText = async (text: string) => {
    if (!workspace || !text.trim() || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    try {
      const reply = await sendAssistantMessage(workspace.id, text.trim());
      if (wakeWord.enabled && speechSupported) {
        wakeWord.pause();
        speak(reply, {
          onStart: () => setIsSpeaking(true),
          onEnd: () => {
            setIsSpeaking(false);
            wakeWord.resume();
          },
        });
      }
    } catch (e: any) {
      setError(`No se pudo enviar el mensaje (${e?.code ?? 'error'}): ${e?.message ?? e}`);
    } finally {
      setSending(false);
      sendingRef.current = false;
    }
  };

  const wakeWord = useWakeWord({ onCommand: (command) => handleSendText(command) });

  useEffect(() => {
    if (!workspace) return;
    return subscribeToAssistantMessages(workspace.id, setMessages);
  }, [workspace?.id]);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      wakeWord.stop();
      cancelSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendPress = () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    handleSendText(text);
  };

  const toggleVoiceMode = () => {
    if (wakeWord.enabled) {
      wakeWord.stop();
      cancelSpeech();
      setIsSpeaking(false);
    } else {
      wakeWord.start();
    }
  };

  const orbState: OrbState = sending
    ? 'thinking'
    : isSpeaking
    ? 'speaking'
    : wakeWord.status === 'awaiting-command'
    ? 'awaiting-command'
    : wakeWord.enabled
    ? 'listening'
    : 'idle';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <GabyOrb state={orbState} size={56} />
        <View style={styles.headerTextBlock}>
          <Text variant="headlineSmall" style={styles.headerTitle}>
            Gaby
          </Text>
          <Text style={styles.headerStatus} numberOfLines={1}>
            {sending
              ? 'Pensando…'
              : isSpeaking
              ? 'Hablando…'
              : STATUS_LABEL[wakeWord.status] ?? STATUS_LABEL.idle}
          </Text>
        </View>
        <IconButton
          icon={wakeWord.enabled ? 'microphone' : 'microphone-off'}
          mode="contained"
          containerColor={wakeWord.enabled ? colors.primaryContainer : colors.surfaceVariant}
          iconColor={wakeWord.enabled ? colors.accent : colors.textMuted}
          onPress={toggleVoiceMode}
        />
      </View>

      {wakeWord.status === 'unsupported' && (
        <Chip style={styles.unsupportedChip} textStyle={{ color: colors.textMuted }}>
          Los comandos de voz solo funcionan en Safari/Chrome, con la app abierta
        </Chip>
      )}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Escríbele o dile "Gaby" para empezar — por ejemplo: "agéndame una reunión con Juan
            el viernes a las 3pm".
          </Text>
        }
        renderItem={({ item }) => {
          const isUser = item.role === 'user';
          return (
            <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
              <View
                style={[
                  styles.bubble,
                  isUser
                    ? [styles.bubbleUser, glow(colors.primary, 12, 0.35)]
                    : [styles.bubbleAssistant, glow(colors.accent, 10, 0.15)],
                ]}
              >
                <Text style={isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant}>
                  {item.content}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {error && (
        <Text style={styles.error} variant="bodySmall">
          {error}
        </Text>
      )}

      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          mode="outlined"
          style={styles.input}
          placeholder="Escríbele a Gaby…"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSendPress}
          disabled={!profile || !workspace}
        />
        <IconButton icon="send" mode="contained" disabled={!input.trim() || sending} onPress={handleSendPress} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8 },
  headerTextBlock: { flex: 1, marginLeft: 12 },
  headerTitle: { color: colors.text },
  headerStatus: { color: colors.textMuted, marginTop: 2 },
  unsupportedChip: { marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.surface },
  list: { padding: 16, paddingTop: 0, flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: 48, color: colors.textMuted },
  bubbleRow: { flexDirection: 'row', marginBottom: 10 },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAssistant: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: colors.primary },
  bubbleAssistant: { backgroundColor: colors.surface },
  bubbleTextUser: { color: '#FFFFFF' },
  bubbleTextAssistant: { color: colors.text },
  error: { color: colors.error, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
  input: { flex: 1, marginRight: 4 },
});
