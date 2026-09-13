import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Card, FAB, Text } from 'react-native-paper';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { subscribeToAppointments, deleteAppointment } from '@/services/appointments';
import { Appointment } from '@/types';
import { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AppointmentsScreen() {
  const { workspace } = useWorkspace();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    if (!workspace) return;
    return subscribeToAppointments(workspace.id, setAppointments);
  }, [workspace?.id]);

  const handleDelete = (appointmentId: string) => {
    if (!workspace) return;
    deleteAppointment(workspace.id, appointmentId);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text variant="headlineSmall">Citas</Text>
      </View>

      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>Aún no tienes citas. Toca + para agendar una.</Text>
        }
        renderItem={({ item }) => (
          <Card
            style={styles.card}
            onPress={() => navigation.navigate('AppointmentForm', { appointmentId: item.id })}
          >
            <Card.Content>
              <Text variant="titleMedium">{item.title}</Text>
              <Text variant="bodySmall" style={styles.date}>
                {format(new Date(item.startTime), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
              </Text>
              {!!item.location && <Text variant="bodySmall">📍 {item.location}</Text>}
              {Object.keys(item.googleEventIds ?? {}).length > 0 && (
                <Text variant="bodySmall" style={styles.synced}>
                  ✓ Sincronizada con Google Calendar
                </Text>
              )}
            </Card.Content>
            <Card.Actions>
              <Button onPress={() => handleDelete(item.id)}>Eliminar</Button>
            </Card.Actions>
          </Card>
        )}
      />

      <FAB
        icon="plus"
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={() => navigation.navigate('AppointmentForm')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { padding: 16, paddingBottom: 8 },
  list: { padding: 16, paddingTop: 0, paddingBottom: 96 },
  card: { marginBottom: 12 },
  date: { marginTop: 4, opacity: 0.7, textTransform: 'capitalize' },
  synced: { marginTop: 4, color: '#16A34A' },
  empty: { textAlign: 'center', marginTop: 48, opacity: 0.6 },
  fab: { position: 'absolute', right: 16 },
});
