import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { GoogleTokens } from '@/types';

const KEY_PREFIX = 'google_tokens_';

// expo-secure-store no tiene implementación nativa en web; ahí usamos localStorage como respaldo.
const webStorage = {
  async setItem(key: string, value: string) {
    window.localStorage.setItem(key, value);
  },
  async getItem(key: string) {
    return window.localStorage.getItem(key);
  },
  async removeItem(key: string) {
    window.localStorage.removeItem(key);
  },
};

const storage =
  Platform.OS === 'web'
    ? webStorage
    : {
        setItem: SecureStore.setItemAsync,
        getItem: SecureStore.getItemAsync,
        removeItem: SecureStore.deleteItemAsync,
      };

export async function saveGoogleTokens(uid: string, tokens: GoogleTokens): Promise<void> {
  await storage.setItem(KEY_PREFIX + uid, JSON.stringify(tokens));
}

export async function getGoogleTokens(uid: string): Promise<GoogleTokens | null> {
  const raw = await storage.getItem(KEY_PREFIX + uid);
  if (!raw) return null;
  return JSON.parse(raw) as GoogleTokens;
}

export async function clearGoogleTokens(uid: string): Promise<void> {
  await storage.removeItem(KEY_PREFIX + uid);
}

/** Devuelve un access token válido, o null si no hay uno o ya expiró (hay que reconectar). */
export async function getValidAccessToken(uid: string): Promise<string | null> {
  const tokens = await getGoogleTokens(uid);
  if (!tokens) return null;
  if (Date.now() >= tokens.expiresAt - 60_000) return null; // expirado o por expirar
  return tokens.accessToken;
}
