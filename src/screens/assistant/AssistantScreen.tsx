import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { IconButton, Text, TextInput } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { sendAssistantMessage, subscribeToAssistantMessages } from '@/services/assistant';
import { useWakeWord } from '@/hooks/useWakeWord';
import { useSpeak } from '@/hooks/useSpeak';
import { AssistantMessage } from '@/types';
import { colors, glow } from '@/theme';
import GabyOrb, { OrbState } from '@/components/GabyOrb';
import StarField from '@/components/StarField';

const TITLE_LABEL: Record<string, string> = {
  thinking: 'Pensando…',
  speaking: 'Hablando…',
  'awaiting-command': 'Te escucho…',
  listening: 'Escuchando…',
  idle: 'Presencia 4D',
};

const STATUS_LABEL: Record<string, string> = {
  idle: 'Toca el micrófono para decir "Gaby"',
  listening: 'Di "Gaby" seguido de tu pedido',
  'awaiting-command': 'Dime qué necesitas…',
  unsupported: 'Comandos de voz no disponibles en este navegador',
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
  const [voiceReplies, setVoiceReplies] = useState(true);
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
      if (voiceReplies && speechSupported) {
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
    } else {
      wakeWord.start();
    }
  };

  const toggleVoiceReplies = () => {
    if (voiceReplies) {
      cancelSpeech();
      setIsSpeaking(false);
    }
    setVoiceReplies((v) => !v);
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
    <View style={styles.root}>
      <LinearGradient colors={['#050712', '#0B0E17', '#0B0E17']} style={StyleSheet.absoluteFill} />
      <StarField />

      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top + 12 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerLabel}>GABY</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {TITLE_LABEL[orbState] ?? TITLE_LABEL.idle}
            </Text>
          </View>
          <IconButton
            icon={voiceReplies ? 'volume-high' : 'volume-off'}
            mode="contained"
            containerColor="rgba(255,255,255,0.06)"
            iconColor={voiceReplies ? colors.accent : colors.textMuted}
            onPress={toggleVoiceReplies}
          />
          <IconButton
            icon={wakeWord.enabled ? 'microphone' : 'microphone-off'}
            mode="contained"
            containerColor="rgba(255,255,255,0.06)"
            iconColor={wakeWord.enabled ? colors.accent : colors.textMuted}
            onPress={toggleVoiceMode}
          />
        </View>

        <Text style={styles.statusText} numberOfLines={1}>
          {STATUS_LABEL[wakeWord.status] ?? STATUS_LABEL.idle}
        </Text>

        <View style={styles.avatarArea}>
          <GabyOrb state={orbState} size={190} />
        </View>

        <View style={styles.transcriptWrap}>
          <LinearGradient
            colors={['rgba(11,14,23,0)', 'rgba(11,14,23,0.85)', colors.background]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>
                Hola, soy Gaby. Escríbeme o dime "Gaby" — por ejemplo: "agéndame una reunión con
                Juan el viernes a las 3pm".
              </Text>
            }
            renderItem={({ item }) => {
              const isUser = item.role === 'user';
              return (
                <View style={styles.messageRow}>
                  <Text style={[styles.messageLabel, isUser && styles.messageLabelUser]}>
                    {isUser ? (profile?.displayName?.split(' ')[0]?.toUpperCase() ?? 'TÚ') : 'GABY'}
                  </Text>
                  <Text
                    style={[styles.messageText, isUser && styles.messageTextUser, glow(isUser ? colors.primary : colors.accent, 6, 0.15) as any]}
                  >
                    {item.content}
                  </Text>
                </View>
              );
            }}
          />
        </View>

        {error && (
          <Text style={styles.error} variant="bodySmall">
            {error}
          </Text>
        )}

        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 12 }]}>
          <TextInput
            mode="flat"
            style={styles.input}
            contentStyle={styles.inputContent}
            underlineColor="transparent"
            activeUnderlineColor="transparent"
            placeholder="Háblale a Gaby…"
            placeholderTextColor={colors.textMuted}
            textColor={colors.text}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSendPress}
            disabled={!profile || !workspace}
          />
          <IconButton
            icon="send"
            mode="contained"
            containerColor={colors.primary}
            iconColor="#FFFFFF"
            disabled={!input.trim() || sending}
            onPress={handleSendPress}
            style={glow(colors.primary, 10, 0.5)}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  headerTextBlock: { flex: 1 },
  headerLabel: { color: colors.textMuted, letterSpacing: 3, fontSize: 12, fontWeight: '600' },
  headerTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }),
    marginTop: 2,
  },
  statusText: { color: colors.textMuted, textAlign: 'center', marginTop: 4, fontSize: 13 },
  avatarArea: { alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 220 },
  transcriptWrap: { minHeight: 130, maxHeight: 220 },
  list: { paddingHorizontal: 20, paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-end' },
  empty: { textAlign: 'center', color: colors.textMuted, paddingHorizontal: 12 },
  messageRow: { marginBottom: 14 },
  messageLabel: { color: colors.accent, fontSize: 11, letterSpacing: 2, fontWeight: '700', marginBottom: 3 },
  messageLabelUser: { color: colors.primary, textAlign: 'right' },
  messageText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  messageTextUser: { color: colors.text, textAlign: 'right' },
  error: { color: colors.error, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  input: {
    flex: 1,
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 28,
    height: 52,
  },
  inputContent: { paddingLeft: 18 },
});
