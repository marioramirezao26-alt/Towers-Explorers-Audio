import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Button } from 'react-native-paper';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import LoginScreen from '@/screens/auth/LoginScreen';
import SignupScreen from '@/screens/auth/SignupScreen';
import WorkspaceSetupScreen from '@/screens/workspace/WorkspaceSetupScreen';
import AppointmentFormScreen from '@/screens/appointments/AppointmentFormScreen';
import RecordVoiceNoteScreen from '@/screens/voicenotes/RecordVoiceNoteScreen';
import AppTabs from './AppTabs';
import { colors } from '@/theme';

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};

export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  WorkspaceSetup: undefined;
  AppTabs: undefined;
  AppointmentForm: { appointmentId?: string } | undefined;
  RecordVoiceNote: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function LoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
      }}
    >
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export default function RootNavigator() {
  const { firebaseUser, profile, initializing } = useAuth();
  const { loading: workspaceLoading } = useWorkspace();

  if (initializing) {
    return <LoadingScreen />;
  }

  const isLoggedIn = !!firebaseUser && !!profile;
  const hasWorkspace = !!profile?.workspaceId;

  if (isLoggedIn && hasWorkspace && workspaceLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isLoggedIn ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        ) : !hasWorkspace ? (
          <Stack.Screen name="WorkspaceSetup" component={WorkspaceSetupScreen} />
        ) : (
          <>
            <Stack.Screen name="AppTabs" component={AppTabs} />
            <Stack.Screen
              name="AppointmentForm"
              component={AppointmentFormScreen}
              options={({ navigation }) => ({
                headerShown: true,
                title: 'Cita',
                presentation: 'modal',
                headerLeft: () => (
                  <Button icon="close" onPress={() => navigation.goBack()}>
                    Cerrar
                  </Button>
                ),
              })}
            />
            <Stack.Screen
              name="RecordVoiceNote"
              component={RecordVoiceNoteScreen}
              options={({ navigation }) => ({
                headerShown: true,
                title: 'Nueva nota de voz',
                presentation: 'modal',
                headerLeft: () => (
                  <Button icon="close" onPress={() => navigation.goBack()}>
                    Cerrar
                  </Button>
                ),
              })}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
