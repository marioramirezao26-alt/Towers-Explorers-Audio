import { MD3DarkTheme } from 'react-native-paper';

/** Paleta "futurista": fondo casi negro, acentos violeta/cian eléctricos. */
export const colors = {
  background: '#0B0E17',
  surface: '#141A2A',
  surfaceVariant: '#1C2438',
  primary: '#7C5CFC',
  primaryContainer: '#2A1F5C',
  accent: '#22D3EE',
  success: '#34D399',
  error: '#F87171',
  text: '#E7E9F5',
  textMuted: '#8B93B0',
  border: '#2A3350',
};

/** Sombra de "brillo" holográfico alrededor de una tarjeta/botón. */
export function glow(color: string, radius = 16, opacity = 0.3) {
  return {
    shadowColor: color,
    shadowRadius: radius,
    shadowOpacity: opacity,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  };
}

export const theme = {
  ...MD3DarkTheme,
  roundness: 16,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.primary,
    onPrimary: '#FFFFFF',
    primaryContainer: colors.primaryContainer,
    onPrimaryContainer: '#E4DDFF',
    secondary: colors.accent,
    background: colors.background,
    onBackground: colors.text,
    surface: colors.surface,
    onSurface: colors.text,
    surfaceVariant: colors.surfaceVariant,
    onSurfaceVariant: colors.textMuted,
    outline: colors.border,
    error: colors.error,
  },
};
