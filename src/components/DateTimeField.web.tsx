import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

interface Props {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** Versión web: usa el selector de fecha/hora nativo del navegador (input type=datetime-local). */
export default function DateTimeField({ label, value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <Text variant="labelLarge" style={styles.label}>
        {label}
      </Text>
      <input
        type="datetime-local"
        value={toLocalInputValue(value)}
        onChange={(e) => {
          const date = new Date(e.target.value);
          if (!Number.isNaN(date.getTime())) onChange(date);
        }}
        style={webInputStyle}
      />
    </View>
  );
}

const webInputStyle: React.CSSProperties = {
  fontSize: 16,
  padding: '10px 12px',
  borderRadius: 4,
  border: '1px solid #79747E',
  marginBottom: 12,
  fontFamily: 'inherit',
};

const styles = StyleSheet.create({
  container: { marginBottom: 4 },
  label: { marginTop: 4, marginBottom: 4 },
});
