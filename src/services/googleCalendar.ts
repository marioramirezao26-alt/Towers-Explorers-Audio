import { Appointment } from '@/types';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

function toGoogleEvent(appointment: Pick<Appointment, 'title' | 'description' | 'location' | 'startTime' | 'endTime'>) {
  return {
    summary: appointment.title,
    description: appointment.description,
    location: appointment.location,
    start: { dateTime: new Date(appointment.startTime).toISOString() },
    end: { dateTime: new Date(appointment.endTime).toISOString() },
  };
}

/** Crea el evento en el Google Calendar del usuario autenticado. Devuelve el eventId. */
export async function createGoogleCalendarEvent(
  accessToken: string,
  appointment: Pick<Appointment, 'title' | 'description' | 'location' | 'startTime' | 'endTime'>,
): Promise<string> {
  const res = await fetch(CALENDAR_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(toGoogleEvent(appointment)),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`No se pudo crear el evento en Google Calendar: ${body}`);
  }
  const json = await res.json();
  return json.id as string;
}

export async function updateGoogleCalendarEvent(
  accessToken: string,
  eventId: string,
  appointment: Pick<Appointment, 'title' | 'description' | 'location' | 'startTime' | 'endTime'>,
): Promise<void> {
  const res = await fetch(`${CALENDAR_API}/${eventId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(toGoogleEvent(appointment)),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`No se pudo actualizar el evento en Google Calendar: ${body}`);
  }
}

export async function deleteGoogleCalendarEvent(accessToken: string, eventId: string): Promise<void> {
  const res = await fetch(`${CALENDAR_API}/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 410 && res.status !== 404) {
    const body = await res.text();
    throw new Error(`No se pudo eliminar el evento en Google Calendar: ${body}`);
  }
}
