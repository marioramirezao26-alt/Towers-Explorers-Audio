import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Card, FAB, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { subscribeToAppointments, deleteAppointment } from '@/services/appointments';
import { Appointment } from '@/types';
import { RootStackParamList } from '@/navigation/RootNavigator';
import { colors } from '@/theme';

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
        <Text variant="headlineSmall" style={styles.headerTitle}>
          Citas
        </Text>
      </View>

      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={40} color={colors.textMuted} />
            <Text style={styles.empty}>Aún no tienes citas. Toca + para agendar una.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card
            style={styles.card}
            mode="contained"
            onPress={() => navigation.navigate('AppointmentForm', { appointmentId: item.id })}
          >
            <Card.Content>
              <Text variant="titleMedium" style={styles.cardTitle}>
                {item.title}
              </Text>
              <Text variant="bodySmall" style={styles.date}>
                {format(new Date(item.startTime), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
              </Text>
              {!!item.location && (
                <View style={styles.row}>
                  <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.textMuted} />
                  <Text variant="bodySmall" style={styles.rowText}>
                    {item.location}
                  </Text>
                </View>
              )}
              {Object.keys(item.googleEventIds ?? {}).length > 0 && (
                <View style={styles.row}>
                  <MaterialCommunityIcons name="check-circle" size={14} color={colors.success} />
                  <Text variant="bodySmall" style={[styles.rowText, styles.synced]}>
                    Sincronizada con Google Calendar
                  </Text>
                </View>
              )}
            </Card.Content>
            <Card.Actions>
              <Button icon="delete-outline" textColor={colors.error} onPress={() => handleDelete(item.id)}>
                Eliminar
              </Button>
            </Card.Actions>
          </Card>
        )}
      />

      <FAB
        icon="plus"
        color="#FFFFFF"
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={() => navigation.navigate('AppointmentForm')}
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
  date: { marginTop: 4, color: colors.textMuted, textTransform: 'capitalize' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  rowText: { marginLeft: 4, color: colors.textMuted },
  synced: { color: colors.success },
  emptyContainer: { alignItems: 'center', marginTop: 48 },
  empty: { textAlign: 'center', marginTop: 12, color: colors.textMuted },
  fab: { position: 'absolute', right: 16, backgroundColor: colors.primary },
});
