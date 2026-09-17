import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/contexts/AuthContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import StartupError from '@/components/StartupError';
import RootNavigator from '@/navigation/RootNavigator';
import { firebaseInitError } from '@/config/firebase';
import { theme } from '@/theme';

export default function App() {
  // Si Firebase no pudo inicializarse, nada de lo de abajo puede funcionar: se
  // muestra el motivo en vez de montar pantallas que fallarían una por una.
  if (firebaseInitError) {
    return <StartupError error={firebaseInitError} />;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <AuthProvider>
            <WorkspaceProvider>
              <StatusBar style="light" />
              <RootNavigator />
            </WorkspaceProvider>
          </AuthProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
