/**
 * Kitchen timers. Timers live above navigation so they keep running while
 * the cook moves between recipes, and a floating card shows them on every
 * screen (Crouton's timer card).
 */

import { usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatClock } from '@/core/recipe/durations';
import { timerRemaining, timerStatus, type KitchenTimer as StoredTimer, type TimerStatus } from '@/core/timers/timers';
import { useDb, useKitchenTimers } from '@/data/react';
import { cancelTimerAlert, reconcileTimerAlerts, scheduleTimerAlert, timerFinished } from '@/data/services/timer-alerts';
import { haptic, IconButton, Tap, Text, useTheme } from '@/ui';

/** A stored timer with its status worked out from the clock. */
export interface KitchenTimer extends Omit<StoredTimer, 'state'> {
  state: TimerStatus;
}

/** What changes every tick: the timers and the clock. */
interface TimersState {
  timers: KitchenTimer[];
  now: number;
  remaining: (timer: KitchenTimer) => number;
}

/** What never changes: starting and controlling timers. Screens that only start timers use this alone. */
export interface TimerActions {
  start: (label: string, seconds: number, recipeId?: string) => string;
  pause: (id: string) => void;
  resume: (id: string) => void;
  cancel: (id: string) => void;
  addTime: (id: string, seconds: number) => void;
}

type TimersApi = TimersState & TimerActions;

const TimersStateContext = createContext<TimersState | null>(null);
const TimerActionsContext = createContext<TimerActions | null>(null);

function asStored(timer: KitchenTimer): StoredTimer {
  return { ...timer, state: timer.state === 'paused' ? 'paused' : 'running' };
}

export function TimersProvider({ children }: { children: ReactNode }) {
  const db = useDb();
  const stored = useKitchenTimers();
  const [now, setNow] = useState(() => Date.now());
  const [mountedAt] = useState(() => Date.now());
  const timers = useMemo(() => stored.map((t) => ({ ...t, state: timerStatus(t, now) })).sort((a, b) => a.createdAt - b.createdAt), [stored, now]);
  const anyRunning = timers.some((t) => t.state === 'running');
  const latest = useRef(stored);
  const notified = useRef(new Set<string>());
  useEffect(() => {
    latest.current = stored;
  }, [stored]);

  // After a launch, line scheduled alerts up with the stored timers (alerts for removed timers go,
  // missing ones are scheduled again).
  useEffect(() => {
    const running = db.timers
      .all()
      .filter((t) => t.state === 'running' && t.endsAt !== undefined)
      .map((t) => ({ id: t.id, label: t.label, endsAt: t.endsAt! }));
    void reconcileTimerAlerts(running);
  }, [db]);

  useEffect(() => {
    if (!anyRunning) return;
    const handle = setInterval(() => {
      const tick = Date.now();
      const finishing = latest.current.filter((t) => t.state === 'running' && t.endsAt !== undefined && t.endsAt <= tick && !notified.current.has(t.id));
      let alerted = false;
      for (const t of finishing) {
        notified.current.add(t.id);
        // Timers that ended while the app was closed were already announced by the system notification.
        if ((t.endsAt ?? 0) > mountedAt) {
          timerFinished(t.id, t.label);
          alerted = true;
        }
      }
      if (alerted) haptic('success');
      setNow(tick);
    }, 250);
    return () => clearInterval(handle);
  }, [anyRunning, mountedAt]);

  const remaining = useCallback((t: KitchenTimer) => timerRemaining(asStored(t), now), [now]);
  const state = useMemo<TimersState>(() => ({ timers, now, remaining }), [timers, now, remaining]);

  const actions = useMemo<TimerActions>(
    () => ({
      start: (label, seconds, recipeId) => {
        haptic('medium');
        const timer = db.timers.start(label, seconds, recipeId);
        if (timer.endsAt) void scheduleTimerAlert(timer.id, label, timer.endsAt);
        setNow(Date.now());
        return timer.id;
      },
      pause: (id) => {
        void cancelTimerAlert(id);
        db.timers.pause(id);
      },
      resume: (id) => {
        const timer = db.timers.resume(id);
        if (timer?.endsAt) void scheduleTimerAlert(id, timer.label, timer.endsAt);
        setNow(Date.now());
      },
      cancel: (id) => {
        void cancelTimerAlert(id);
        db.timers.cancel(id);
      },
      addTime: (id, seconds) => {
        notified.current.delete(id);
        const timer = db.timers.addTime(id, seconds);
        if (timer?.state === 'running' && timer.endsAt) void scheduleTimerAlert(id, timer.label, timer.endsAt);
        setNow(Date.now());
      },
    }),
    [db],
  );

  return (
    <TimerActionsContext.Provider value={actions}>
      <TimersStateContext.Provider value={state}>
        <View style={styles.fill}>
          {children}
          <TimerHud />
        </View>
      </TimersStateContext.Provider>
    </TimerActionsContext.Provider>
  );
}

/** Starting and controlling timers. Stable: using it does not re-render on every tick. */
export function useTimerActions(): TimerActions {
  const actions = useContext(TimerActionsContext);
  if (!actions) throw new Error('useTimerActions must be used inside <TimersProvider>');
  return actions;
}

/** Timers with their live state; re-renders four times a second while one runs. */
export function useTimers(): TimersApi {
  const state = useContext(TimersStateContext);
  const actions = useContext(TimerActionsContext);
  if (!state || !actions) throw new Error('useTimers must be used inside <TimersProvider>');
  return useMemo(() => ({ ...state, ...actions }), [state, actions]);
}

/** "Butter Chicken: step 3" -> { title: "Step 3", subtitle: "Butter Chicken" }. */
export function splitTimerLabel(label: string): { title: string; subtitle?: string } {
  const at = label.lastIndexOf(': ');
  if (at <= 0) return { title: label };
  const rest = label.slice(at + 2);
  return { title: rest.charAt(0).toUpperCase() + rest.slice(1), subtitle: label.slice(0, at) };
}

function Ring({ progress, size, color, track }: { progress: number; size: number; color: string; track: string }) {
  const stroke = Math.max(4, size * 0.16);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={circumference * clamped}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Crouton's timer card: floats at the top right over every screen with the
 * most urgent timer in big amber digits and a ring that empties as it runs.
 * Tap it to see and control every timer.
 */
function TimerHud() {
  const { timers, remaining, pause, resume, cancel, addTime } = useTimers();
  const { colors, radius, space } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  if (timers.length === 0) return null;
  // The full card shows while cooking (recipe and step-by-step screens); elsewhere a small pill keeps titles clear.
  const compactPill = !expanded && !pathname.startsWith('/recipe/');
  const sorted = [...timers].sort((a, b) => remaining(a) - remaining(b));
  const first = sorted[0]!;
  const shadow = `0 10px 30px ${colors.shadow}, 0 2px 8px ${colors.shadow}`;

  const card = (t: KitchenTimer, compact: boolean) => {
    const left = remaining(t);
    const done = t.state === 'done';
    const { title, subtitle } = splitTimerLabel(t.label);
    const tone = done ? colors.danger : colors.timer;
    return (
      <View style={[styles.timerCard, { gap: space.md }]}>
        <View style={styles.timerText}>
          <Text variant="headline" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="subhead" tone="secondary" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          <Text rounded weight="800" color={tone} style={[styles.digits, compact ? null : styles.digitsLarge]}>
            {done ? 'Done!' : formatClock(left)}
          </Text>
        </View>
        <Ring progress={t.totalSeconds ? 1 - left / t.totalSeconds : 1} size={compact ? 42 : 46} color={tone} track={colors.fill} />
      </View>
    );
  };

  return (
    <View pointerEvents="box-none" style={[styles.hudWrap, { top: insets.top + 56, right: space.lg }]}>
      {compactPill ? (
        <Tap
          onPress={() => setExpanded(true)}
          accessibilityLabel="Show timers"
          style={[styles.pill, { backgroundColor: colors.surfaceRaised, borderRadius: radius.pill, boxShadow: shadow }]}
        >
          <Ring progress={first.totalSeconds ? 1 - remaining(first) / first.totalSeconds : 1} size={22} color={first.state === 'done' ? colors.danger : colors.timer} track={colors.fill} />
          <Text variant="headline" rounded weight="800" color={first.state === 'done' ? colors.danger : colors.timer} style={styles.pillDigits}>
            {first.state === 'done' ? 'Done' : formatClock(remaining(first))}
          </Text>
          {timers.length > 1 ? (
            <Text variant="caption" tone="secondary" weight="700">
              +{timers.length - 1}
            </Text>
          ) : null}
        </Tap>
      ) : !expanded ? (
        <Tap
          onPress={() => setExpanded(true)}
          accessibilityLabel="Show timers"
          style={[styles.hud, { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, padding: space.md, boxShadow: shadow }]}
        >
          {card(first, true)}
          {timers.length > 1 ? (
            <View style={[styles.more, { backgroundColor: colors.timer }]}>
              <Text variant="caption" rounded weight="800" color="#FFFFFF">
                +{timers.length - 1}
              </Text>
            </View>
          ) : null}
        </Tap>
      ) : (
        <View style={[styles.hud, styles.hudOpen, { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, padding: space.md, gap: space.md, boxShadow: shadow }]}>
          <View style={styles.hudHeader}>
            <Text variant="title3">Timers</Text>
            <IconButton icon="chevronUp" variant="tinted" size={30} onPress={() => setExpanded(false)} accessibilityLabel="Collapse timers" />
          </View>
          {sorted.map((t) => (
            <View key={t.id} style={{ gap: space.sm }}>
              {card(t, false)}
              <View style={[styles.controls, { gap: space.sm }]}>
                <IconButton icon="add" variant="tinted" tint="yellow" size={34} onPress={() => addTime(t.id, 60)} accessibilityLabel="Add one minute" />
                {t.state !== 'done' ? (
                  <IconButton
                    icon={t.state === 'paused' ? 'play' : 'pause'}
                    variant="tinted"
                    tint="yellow"
                    size={34}
                    onPress={() => (t.state === 'paused' ? resume(t.id) : pause(t.id))}
                    accessibilityLabel={t.state === 'paused' ? 'Resume' : 'Pause'}
                  />
                ) : null}
                <IconButton icon="close" variant="tinted" tint="red" size={34} onPress={() => cancel(t.id)} accessibilityLabel="Remove timer" />
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hudWrap: { position: 'absolute', alignItems: 'flex-end', zIndex: 1000 },
  hud: { minWidth: 210, maxWidth: 300 },
  hudOpen: { width: 300 },
  hudHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timerCard: { flexDirection: 'row', alignItems: 'center' },
  timerText: { flex: 1 },
  digits: { fontSize: 34, lineHeight: 40, fontVariant: ['tabular-nums'] },
  digitsLarge: { fontSize: 38, lineHeight: 44 },
  controls: { flexDirection: 'row', justifyContent: 'flex-end' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 40 },
  pillDigits: { fontVariant: ['tabular-nums'] },
  more: { position: 'absolute', top: -6, right: -6, minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
