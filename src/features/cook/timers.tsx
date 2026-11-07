/**
 * Kitchen timers. Timers live above navigation so they keep running while
 * the cook moves between recipes, and a heads-up pill shows them on every
 * screen (Crouton's "timers HUD").
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatClock } from '@/core/recipe/durations';
import { haptic, Icon, IconButton, Tap, Text, useTheme } from '@/ui';

export interface KitchenTimer {
  id: string;
  label: string;
  recipeId?: string;
  totalSeconds: number;
  /** Epoch ms when a running timer ends. */
  endsAt?: number;
  /** Seconds left while paused. */
  pausedRemaining?: number;
  state: 'running' | 'paused' | 'done';
}

interface TimersApi {
  timers: KitchenTimer[];
  now: number;
  start: (label: string, seconds: number, recipeId?: string) => string;
  pause: (id: string) => void;
  resume: (id: string) => void;
  cancel: (id: string) => void;
  addTime: (id: string, seconds: number) => void;
  remaining: (timer: KitchenTimer) => number;
}

const TimersContext = createContext<TimersApi | null>(null);

let counter = 0;

export function TimersProvider({ children }: { children: ReactNode }) {
  const [timers, setTimers] = useState<KitchenTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const anyRunning = timers.some((t) => t.state === 'running');

  useEffect(() => {
    if (!anyRunning) return;
    const handle = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(handle);
  }, [anyRunning]);

  // Mark finished timers as done (once) and buzz.
  useEffect(() => {
    const finished = timers.filter((t) => t.state === 'running' && t.endsAt !== undefined && t.endsAt <= now);
    if (finished.length === 0) return;
    haptic('success');
    setTimers((list) => list.map((t) => (finished.some((f) => f.id === t.id) ? { ...t, state: 'done' } : t)));
  }, [now, timers]);

  const remaining = useCallback(
    (t: KitchenTimer) => {
      if (t.state === 'done') return 0;
      if (t.state === 'paused') return t.pausedRemaining ?? 0;
      return Math.max(0, ((t.endsAt ?? now) - now) / 1000);
    },
    [now],
  );

  const api = useMemo<TimersApi>(
    () => ({
      timers,
      now,
      remaining,
      start: (label, seconds, recipeId) => {
        const id = `timer-${Date.now()}-${counter++}`;
        haptic('medium');
        setNow(Date.now());
        setTimers((list) => [
          ...list,
          { id, label, totalSeconds: seconds, endsAt: Date.now() + seconds * 1000, state: 'running', ...(recipeId ? { recipeId } : {}) },
        ]);
        return id;
      },
      pause: (id) =>
        setTimers((list) =>
          list.map((t) =>
            t.id === id && t.state === 'running'
              ? { ...t, state: 'paused', pausedRemaining: Math.max(0, ((t.endsAt ?? Date.now()) - Date.now()) / 1000) }
              : t,
          ),
        ),
      resume: (id) =>
        setTimers((list) =>
          list.map((t) =>
            t.id === id && t.state === 'paused' ? { ...t, state: 'running', endsAt: Date.now() + (t.pausedRemaining ?? 0) * 1000 } : t,
          ),
        ),
      cancel: (id) => setTimers((list) => list.filter((t) => t.id !== id)),
      addTime: (id, seconds) =>
        setTimers((list) =>
          list.map((t) => {
            if (t.id !== id) return t;
            if (t.state === 'paused') return { ...t, pausedRemaining: (t.pausedRemaining ?? 0) + seconds, totalSeconds: t.totalSeconds + seconds };
            const base = t.state === 'done' ? Date.now() : (t.endsAt ?? Date.now());
            return { ...t, state: 'running', endsAt: base + seconds * 1000, totalSeconds: t.totalSeconds + seconds };
          }),
        ),
    }),
    [timers, now, remaining],
  );

  return (
    <TimersContext.Provider value={api}>
      <View style={styles.fill}>
        {children}
        <TimerHud />
      </View>
    </TimersContext.Provider>
  );
}

export function useTimers(): TimersApi {
  const api = useContext(TimersContext);
  if (!api) throw new Error('useTimers must be used inside <TimersProvider>');
  return api;
}

/** Floating heads-up display listing active timers. */
function TimerHud() {
  const { timers, remaining, pause, resume, cancel, addTime } = useTimers();
  const { colors, radius, space } = useTheme();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  if (timers.length === 0) return null;
  const sorted = [...timers].sort((a, b) => remaining(a) - remaining(b));
  const first = sorted[0]!;
  const doneCount = timers.filter((t) => t.state === 'done').length;

  return (
    <View pointerEvents="box-none" style={[styles.hudWrap, { top: insets.top + (Platform.OS === 'web' ? 8 : 4) }]}>
      <View
        style={[
          styles.hud,
          {
            backgroundColor: doneCount ? colors.accent : colors.text,
            borderRadius: expanded ? radius.lg : radius.pill,
            padding: expanded ? space.md : 0,
            boxShadow: '0 6px 24px rgba(0,0,0,0.22)',
          },
        ]}
      >
        {!expanded ? (
          <Tap onPress={() => setExpanded(true)} style={styles.hudCollapsed} accessibilityLabel="Show timers">
            <Icon name="timer" size={18} color={doneCount ? colors.onAccent : colors.background} />
            <Text variant="headline" color={doneCount ? colors.onAccent : colors.background} style={styles.mono}>
              {first.state === 'done' ? 'Done!' : formatClock(remaining(first))}
            </Text>
            <Text variant="footnote" color={doneCount ? colors.onAccent : colors.background} numberOfLines={1} style={styles.hudLabel}>
              {first.label}
              {timers.length > 1 ? ` +${timers.length - 1}` : ''}
            </Text>
          </Tap>
        ) : (
          <View style={{ gap: space.sm, minWidth: 280 }}>
            <View style={styles.hudHeader}>
              <Text variant="headline" color={colors.background}>
                Timers
              </Text>
              <Tap onPress={() => setExpanded(false)} accessibilityLabel="Collapse timers" hitSlop={10}>
                <Icon name="chevronDown" size={20} color={colors.background} />
              </Tap>
            </View>
            {sorted.map((t) => {
              const left = remaining(t);
              const progress = t.totalSeconds ? 1 - left / t.totalSeconds : 1;
              return (
                <View key={t.id} style={[styles.timerRow, { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.md }]}>
                  <View style={styles.timerText}>
                    <Text variant="title3" color={t.state === 'done' ? colors.accent : colors.background} style={styles.mono}>
                      {t.state === 'done' ? 'Done' : formatClock(left)}
                    </Text>
                    <Text variant="footnote" color={colors.background} numberOfLines={1} style={{ opacity: 0.75 }}>
                      {t.label}
                    </Text>
                    <View style={[styles.track, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                      <View style={[styles.bar, { width: `${Math.min(100, progress * 100)}%`, backgroundColor: colors.accent }]} />
                    </View>
                  </View>
                  <IconButton icon="add" variant="glass" size={32} onPress={() => addTime(t.id, 60)} accessibilityLabel="Add one minute" />
                  {t.state !== 'done' ? (
                    <IconButton
                      icon={t.state === 'paused' ? 'play' : 'pause'}
                      variant="glass"
                      size={32}
                      onPress={() => (t.state === 'paused' ? resume(t.id) : pause(t.id))}
                      accessibilityLabel={t.state === 'paused' ? 'Resume' : 'Pause'}
                    />
                  ) : null}
                  <IconButton icon="close" variant="glass" size={32} onPress={() => cancel(t.id)} accessibilityLabel="Remove timer" />
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hudWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 1000 },
  hud: { maxWidth: 420 },
  hudCollapsed: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 38, maxWidth: 320 },
  hudLabel: { opacity: 0.8, flexShrink: 1 },
  hudHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  timerText: { flex: 1, gap: 2 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  bar: { height: 4, borderRadius: 2 },
  mono: { fontVariant: ['tabular-nums'] },
});
