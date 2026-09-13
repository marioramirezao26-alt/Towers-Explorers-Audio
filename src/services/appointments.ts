import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Appointment } from '@/types';

function appointmentsCollection(workspaceId: string) {
  return collection(db, 'workspaces', workspaceId, 'appointments');
}

export function subscribeToAppointments(
  workspaceId: string,
  onChange: (appointments: Appointment[]) => void,
) {
  const q = query(appointmentsCollection(workspaceId), orderBy('startTime', 'asc'));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ ...(d.data() as Appointment), id: d.id })));
  });
}

export async function getAppointment(
  workspaceId: string,
  appointmentId: string,
): Promise<Appointment | null> {
  const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'appointments', appointmentId));
  return snap.exists() ? ({ ...(snap.data() as Appointment), id: snap.id }) : null;
}

export async function createAppointment(
  workspaceId: string,
  data: Omit<Appointment, 'id' | 'createdAt' | 'googleEventIds'>,
): Promise<string> {
  const ref = await addDoc(appointmentsCollection(workspaceId), {
    ...data,
    createdAt: Date.now(),
    googleEventIds: {},
  });
  return ref.id;
}

export async function updateAppointment(
  workspaceId: string,
  appointmentId: string,
  data: Partial<Appointment>,
): Promise<void> {
  await updateDoc(doc(db, 'workspaces', workspaceId, 'appointments', appointmentId), data);
}

export async function deleteAppointment(workspaceId: string, appointmentId: string): Promise<void> {
  await deleteDoc(doc(db, 'workspaces', workspaceId, 'appointments', appointmentId));
}

export async function setGoogleEventIdForUser(
  workspaceId: string,
  appointmentId: string,
  uid: string,
  eventId: string,
): Promise<void> {
  await updateDoc(doc(db, 'workspaces', workspaceId, 'appointments', appointmentId), {
    [`googleEventIds.${uid}`]: eventId,
  });
}
