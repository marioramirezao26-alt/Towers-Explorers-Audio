import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AppointmentsScreen from '@/screens/appointments/AppointmentsScreen';
import VoiceNotesScreen from '@/screens/voicenotes/VoiceNotesScreen';
import HomeScreen from '@/screens/home/HomeScreen';

export type AppTabsParamList = {
  Home: undefined;
  Appointments: undefined;
  VoiceNotes: undefined;
};

const Tab = createBottomTabNavigator<AppTabsParamList>();

export default function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#4F46E5',
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="hand-heart" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Appointments"
        component={AppointmentsScreen}
        options={{
          title: 'Citas',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="calendar-clock" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="VoiceNotes"
        component={VoiceNotesScreen}
        options={{
          title: 'Notas de voz',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="microphone" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
