import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/contexts/AuthContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import RootNavigator from '@/navigation/RootNavigator';
import { theme } from '@/theme';

export default function App() {
  return (
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
  );
}
