import React, { useState } from 'react';
import { Button, Text } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { colors } from '@/theme';

interface Props {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
}

/** Selector de fecha/hora nativo (iOS/Android). Ver DateTimeField.web.tsx para la versión web. */
export default function DateTimeField({ label, value, onChange }: Props) {
  const [show, setShow] = useState(false);

  return (
    <>
      <Text variant="labelLarge" style={styles.label}>
        {label}
      </Text>
      <Button mode="outlined" onPress={() => setShow(true)} style={styles.dateButton}>
        {format(value, "d 'de' MMMM, HH:mm", { locale: es })}
      </Button>
      {show && (
        <DateTimePicker
          value={value}
          mode="datetime"
          onChange={(_, date) => {
            setShow(Platform.OS === 'ios');
            if (date) onChange(date);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 4, marginBottom: 4, color: colors.textMuted },
  dateButton: { marginBottom: 12, alignItems: 'flex-start' },
});
