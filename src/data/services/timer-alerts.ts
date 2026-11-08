import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Device timer alerts: each running timer has a scheduled local notification,
 * so it alerts even when Gather is in the background or the phone is locked.
 * The notification's identifier is derived from the timer id, so a timer can
 * be paused, extended or removed after the app restarts.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const PREFIX = 'timer-';
const alertId = (timerId: string) => PREFIX + timerId;

let permission: Promise<boolean> | null = null;

function ensurePermission(): Promise<boolean> {
  permission ??= Notifications.requestPermissionsAsync()
    .then((result) => result.granted)
    .catch(() => false);
  return permission;
}

/** Schedules (or reschedules) the alert for a timer that ends at `endsAt` (epoch ms). */
export async function scheduleTimerAlert(timerId: string, label: string, endsAt: number): Promise<void> {
  await cancelTimerAlert(timerId);
  if (!(await ensurePermission())) return;
  await Notifications.scheduleNotificationAsync({
    identifier: alertId(timerId),
    content: { title: 'Timer done', body: label, sound: true, data: { timerId, label, endsAt } },
    // A wall-clock trigger with alarm-clock delivery fires on time while the phone sleeps (Android
    // needs the exact alarm permission for that; without it this is delivered as best effort).
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: Math.max(Date.now() + 1000, endsAt),
      delivery: 'alarmClock',
    },
  });
}

export async function cancelTimerAlert(timerId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(alertId(timerId)).catch(() => undefined);
}

/** The scheduled notification already alerts on device. */
export function timerFinished(_timerId: string, _fallbackLabel?: string): void {}

/**
 * Brings scheduled alerts in line with the stored timers after a launch:
 * cancels alerts for timers that no longer run, and schedules missing ones.
 */
export async function reconcileTimerAlerts(
  running: { id: string; label: string; endsAt: number }[],
): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const wanted = new Map(running.map((t) => [alertId(t.id), t]));
    for (const request of scheduled) {
      if (request.identifier.startsWith(PREFIX) && !wanted.has(request.identifier)) {
        await Notifications.cancelScheduledNotificationAsync(request.identifier);
      }
    }
    const present = new Set(scheduled.map((r) => r.identifier));
    for (const [id, timer] of wanted) {
      if (!present.has(id) && timer.endsAt > Date.now())
        await scheduleTimerAlert(timer.id, timer.label, timer.endsAt);
    }
  } catch (error) {
    console.warn('[gather] timer alerts', error);
  }
}

export type ExactAlertStatus = 'granted' | 'denied' | 'unavailable';

/** Whether timer alerts can fire exactly on time while the phone sleeps (an Android 12+ permission). */
export async function exactAlertStatus(): Promise<ExactAlertStatus> {
  if (Platform.OS !== 'android') return 'granted';
  try {
    const result = await Notifications.getExactAlarmPermissionsAsync();
    if (result.granted) return 'granted';
    return result.canAskAgain ? 'denied' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/**
 * Opens the system screen for allowing exact alarms; resolves with the new
 * status. Once allowed, alerts already scheduled are scheduled again so they
 * become exact too.
 */
export async function requestExactAlerts(): Promise<ExactAlertStatus> {
  try {
    const result = await Notifications.requestExactAlarmPermissionsAsync();
    if (!result.granted) return 'denied';
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const request of scheduled) {
      const data = request.content.data as
        { timerId?: unknown; label?: unknown; endsAt?: unknown } | undefined;
      if (
        request.identifier.startsWith(PREFIX) &&
        typeof data?.timerId === 'string' &&
        typeof data.endsAt === 'number'
      ) {
        await scheduleTimerAlert(
          data.timerId,
          typeof data.label === 'string' ? data.label : 'Timer',
          data.endsAt,
        );
      }
    }
    return 'granted';
  } catch {
    return 'unavailable';
  }
}
