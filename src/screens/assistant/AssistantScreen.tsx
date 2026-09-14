import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { ActivityIndicator, IconButton, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { sendAssistantMessage, subscribeToAssistantMessages } from '@/services/assistant';
import { AssistantMessage } from '@/types';
import { colors } from '@/theme';

export default function AssistantScreen() {
  const { profile } = useAuth();
  const { workspace } = useWorkspace();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!workspace) return;
    return subscribeToAssistantMessages(workspace.id, setMessages);
  }, [workspace?.id]);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const handleSend = async () => {
    if (!workspace || !input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setError(null);
    setSending(true);
    try {
      await sendAssistantMessage(workspace.id, text);
    } catch (e: any) {
      setError(`No se pudo enviar el mensaje (${e?.code ?? 'error'}): ${e?.message ?? e}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Asistente
        </Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Pídele a Gaby que agende algo por ti, por ejemplo: "agéndame una reunión con Juan el
            viernes a las 3pm".
          </Text>
        }
        renderItem={({ item }) => {
          const isUser = item.role === 'user';
          return (
            <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
              <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
                <Text style={isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant}>
                  {item.content}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {sending && (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.typingText}>Gaby está pensando…</Text>
        </View>
      )}

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
          onSubmitEditing={handleSend}
          disabled={!profile || !workspace}
        />
        <IconButton
          icon="send"
          mode="contained"
          disabled={!input.trim() || sending}
          onPress={handleSend}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: 16, paddingBottom: 8 },
  headerTitle: { color: colors.text },
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
  typingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 4 },
  typingText: { marginLeft: 8, color: colors.textMuted },
  error: { color: colors.error, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
  input: { flex: 1, marginRight: 4 },
});
