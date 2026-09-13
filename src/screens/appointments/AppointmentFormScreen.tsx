import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateTimeField from '@/components/DateTimeField';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import {
  createAppointment,
  deleteAppointment,
  getAppointment,
  setGoogleEventIdForUser,
  updateAppointment,
} from '@/services/appointments';
import { getValidAccessToken } from '@/services/googleTokenStore';
import { createGoogleCalendarEvent, updateGoogleCalendarEvent } from '@/services/googleCalendar';
import { RootStackParamList } from '@/navigation/RootNavigator';
import { colors } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AppointmentForm'>;

export default function AppointmentFormScreen({ route, navigation }: Props) {
  const appointmentId = route.params?.appointmentId;
  const { profile } = useAuth();
  const { workspace } = useWorkspace();
  const { connectGoogleCalendar } = useGoogleAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState(new Date(Date.now() + 60 * 60 * 1000));
  const [endTime, setEndTime] = useState(new Date(Date.now() + 2 * 60 * 60 * 1000));
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadySynced, setAlreadySynced] = useState(false);

  useEffect(() => {
    if (!workspace || !appointmentId) return;
    getAppointment(workspace.id, appointmentId).then((appt) => {
      if (!appt) return;
      setTitle(appt.title);
      setDescription(appt.description);
      setLocation(appt.location);
      setStartTime(new Date(appt.startTime));
      setEndTime(new Date(appt.endTime));
      setAlreadySynced(!!profile && !!appt.googleEventIds?.[profile.uid]);
    });
  }, [workspace?.id, appointmentId]);

  const handleSave = async () => {
    if (!workspace || !profile) return;
    if (!title.trim()) {
      setError('Ponle un título a la cita.');
      return;
    }
    if (endTime.getTime() <= startTime.getTime()) {
      setError('La hora de fin debe ser después de la hora de inicio.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const data = {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        startTime: startTime.getTime(),
        endTime: endTime.getTime(),
        createdBy: profile.uid,
      };
      if (appointmentId) {
        await updateAppointment(workspace.id, appointmentId, data);
      } else {
        await createAppointment(workspace.id, data);
      }
      navigation.goBack();
    } catch (e: any) {
      setError(`No se pudo guardar la cita (${e?.code ?? 'error'}): ${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSyncGoogle = async () => {
    if (!workspace || !profile) return;
    setError(null);
    setSyncing(true);
    try {
      let accessToken = await getValidAccessToken(profile.uid);
      if (!accessToken) {
        await connectGoogleCalendar();
        setError('Conecta tu cuenta de Google y vuelve a intentar sincronizar.');
        return;
      }
      const appointmentData = {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        startTime: startTime.getTime(),
        endTime: endTime.getTime(),
      };
      let id = appointmentId;
      if (!id) {
        id = await createAppointment(workspace.id, { ...appointmentData, createdBy: profile.uid });
      } else {
        await updateAppointment(workspace.id, id, appointmentData);
      }
      const eventId = await createGoogleCalendarEvent(accessToken, appointmentData);
      await setGoogleEventIdForUser(workspace.id, id, profile.uid, eventId);
      setAlreadySynced(true);
      navigation.goBack();
    } catch (e: any) {
      setError(e.message ?? 'No se pudo sincronizar con Google Calendar.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (!workspace || !appointmentId) return;
    await deleteAppointment(workspace.id, appointmentId);
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TextInput
        mode="outlined"
        label="Título"
        value={title}
        onChangeText={setTitle}
        style={styles.input}
      />
      <TextInput
        mode="outlined"
        label="Descripción"
        value={description}
        onChangeText={setDescription}
        multiline
        style={styles.input}
      />
      <TextInput
        mode="outlined"
        label="Lugar"
        value={location}
        onChangeText={setLocation}
        style={styles.input}
      />

      <DateTimeField label="Inicio" value={startTime} onChange={setStartTime} />
      <DateTimeField label="Fin" value={endTime} onChange={setEndTime} />

      {error && (
        <Text style={styles.error} variant="bodySmall">
          {error}
        </Text>
      )}

      <Button mode="contained" icon="content-save-outline" onPress={handleSave} loading={saving} style={styles.button}>
        Guardar cita
      </Button>
      <Button
        mode="outlined"
        onPress={handleSyncGoogle}
        loading={syncing}
        style={styles.button}
        icon="google"
      >
        {alreadySynced ? 'Actualizar en Google Calendar' : 'Sincronizar con Google Calendar'}
      </Button>

      {appointmentId && (
        <Button icon="delete-outline" textColor={colors.error} onPress={handleDelete} style={styles.button}>
          Eliminar cita
        </Button>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  input: { marginBottom: 12 },
  button: { marginTop: 8 },
  error: { color: colors.error, marginVertical: 8, textAlign: 'center' },
});
