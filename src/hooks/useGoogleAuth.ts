import { useEffect } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@/contexts/AuthContext';
import { saveGoogleTokens } from '@/services/googleTokenStore';

WebBrowser.maybeCompleteAuthSession();

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
];

/**
 * Maneja el flujo de OAuth de Google para poder crear eventos en el Google Calendar
 * del usuario. El access token dura ~1 hora; cuando expira simplemente se vuelve a
 * pedir conexión (no manejamos refresh token para mantener el cliente sin backend propio).
 */
export function useGoogleAuth() {
  const { profile } = useAuth();

  const [request, response, promptAsync] = Google.useAuthRequest({
    // webClientId también se usa para pruebas dentro de Expo Go.
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    scopes: ['openid', 'profile', 'email', ...CALENDAR_SCOPES],
  });

  useEffect(() => {
    if (response?.type === 'success' && profile) {
      const { authentication } = response;
      if (authentication?.accessToken) {
        saveGoogleTokens(profile.uid, {
          accessToken: authentication.accessToken,
          expiresAt: Date.now() + (authentication.expiresIn ?? 3600) * 1000,
        });
      }
    }
  }, [response, profile]);

  return {
    connected: response?.type === 'success',
    requestReady: !!request,
    connectGoogleCalendar: () => promptAsync(),
  };
}
