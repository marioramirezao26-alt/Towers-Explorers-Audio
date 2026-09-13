import * as SecureStore from 'expo-secure-store';
import { GoogleTokens } from '@/types';

const KEY_PREFIX = 'google_tokens_';

export async function saveGoogleTokens(uid: string, tokens: GoogleTokens): Promise<void> {
  await SecureStore.setItemAsync(KEY_PREFIX + uid, JSON.stringify(tokens));
}

export async function getGoogleTokens(uid: string): Promise<GoogleTokens | null> {
  const raw = await SecureStore.getItemAsync(KEY_PREFIX + uid);
  if (!raw) return null;
  return JSON.parse(raw) as GoogleTokens;
}

export async function clearGoogleTokens(uid: string): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_PREFIX + uid);
}

/** Devuelve un access token válido, o null si no hay uno o ya expiró (hay que reconectar). */
export async function getValidAccessToken(uid: string): Promise<string | null> {
  const tokens = await getGoogleTokens(uid);
  if (!tokens) return null;
  if (Date.now() >= tokens.expiresAt - 60_000) return null; // expirado o por expirar
  return tokens.accessToken;
}
