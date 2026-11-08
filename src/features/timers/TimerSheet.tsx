import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatClock, formatDuration } from '@/core/recipe/durations';
import { Button, Chip, Field, IconButton, Sheet, Text, useTheme } from '@/ui';

import { useTimers } from './timers';

const PRESETS = [1, 3, 5, 10, 15, 20, 30, 45, 60];

/** Crouton's timer+ button: start a custom timer and manage the running ones. */
export function TimerSheet({
  visible,
  onClose,
  label,
  recipeId,
}: {
  visible: boolean;
  onClose: () => void;
  label: string;
  recipeId?: string;
}) {
  const { timers, start, remaining, pause, resume, cancel } = useTimers();
  const { colors, radius, space } = useTheme();
  const [minutes, setMinutes] = useState('');

  const startMinutes = (m: number) => {
    if (!(m > 0)) return;
    start(`${label}: ${formatDuration(m * 60)}`, Math.round(m * 60), recipeId);
    setMinutes('');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Timers">
      {timers.length ? (
        <View style={{ gap: space.sm, marginBottom: space.xl }}>
          {timers.map((t) => (
            <View
              key={t.id}
              style={[
                styles.row,
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: space.md,
                  gap: space.sm,
                },
              ]}
            >
              <View style={styles.flex}>
                <Text variant="title2" tone="timer" style={styles.mono}>
                  {t.state === 'done' ? 'Done' : formatClock(remaining(t))}
                </Text>
                <Text variant="footnote" tone="secondary" numberOfLines={1}>
                  {t.label}
                </Text>
              </View>
              {t.state !== 'done' ? (
                <IconButton
                  icon={t.state === 'paused' ? 'play' : 'pause'}
                  variant="tinted"
                  tint="yellow"
                  onPress={() => (t.state === 'paused' ? resume(t.id) : pause(t.id))}
                  accessibilityLabel={t.state === 'paused' ? 'Resume timer' : 'Pause timer'}
                />
              ) : null}
              <IconButton
                icon="close"
                variant="tinted"
                tint="red"
                onPress={() => cancel(t.id)}
                accessibilityLabel="Remove timer"
              />
            </View>
          ))}
        </View>
      ) : null}
      <Text variant="headline" style={{ marginBottom: space.sm }}>
        New timer
      </Text>
      <View style={[styles.wrap, { gap: space.sm, marginBottom: space.lg }]}>
        {PRESETS.map((m) => (
          <Chip key={m} label={m < 60 ? `${m} min` : '1 hr'} onPress={() => startMinutes(m)} />
        ))}
      </View>
      <View style={[styles.row, { gap: space.sm }]}>
        <Field
          value={minutes}
          onChangeText={setMinutes}
          placeholder="Minutes"
          keyboardType="numeric"
          style={styles.flex}
          onSubmitEditing={() => startMinutes(Number(minutes))}
        />
        <Button
          title="Start"
          icon="play"
          variant="green"
          onPress={() => startMinutes(Number(minutes))}
          disabled={!(Number(minutes) > 0)}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  flex: { flex: 1 },
  mono: { fontVariant: ['tabular-nums'] },
});
