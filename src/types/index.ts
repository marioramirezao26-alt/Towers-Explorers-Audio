export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  workspaceId: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  inviteCode: string;
  memberIds: string[];
  createdAt: number;
}

export interface GoogleEventRefs {
  [uid: string]: string; // uid -> Google Calendar eventId, for members who synced this appointment
}

export interface Appointment {
  id: string;
  title: string;
  description: string;
  location: string;
  startTime: number; // epoch ms
  endTime: number; // epoch ms
  createdBy: string;
  createdAt: number;
  googleEventIds: GoogleEventRefs;
}

export type VoiceNoteStatus = 'uploading' | 'transcribing' | 'done' | 'error';

export interface VoiceNote {
  id: string;
  title: string;
  audioPath: string; // storage path
  audioUrl: string | null; // download URL, filled after upload
  transcript: string | null;
  status: VoiceNoteStatus;
  durationMillis: number;
  createdBy: string;
  createdAt: number;
}

export interface GoogleTokens {
  accessToken: string;
  expiresAt: number; // epoch ms
  refreshToken?: string;
}
