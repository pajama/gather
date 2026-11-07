import * as Notifications from 'expo-notifications';

/**
 * Device timer alerts: each running timer has a scheduled local notification,
 * so it alerts even when Gather is in the background or the phone is locked.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

const scheduled = new Map<string, string>();
let permission: Promise<boolean> | null = null;

function ensurePermission(): Promise<boolean> {
  permission ??= Notifications.requestPermissionsAsync()
    .then((result) => result.granted)
    .catch(() => false);
  return permission;
}

export async function scheduleTimerAlert(timerId: string, label: string, seconds: number): Promise<void> {
  await cancelTimerAlert(timerId);
  if (!(await ensurePermission())) return;
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: 'Timer done', body: label, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.round(seconds)) },
  });
  scheduled.set(timerId, id);
}

export async function cancelTimerAlert(timerId: string): Promise<void> {
  const id = scheduled.get(timerId);
  if (!id) return;
  scheduled.delete(timerId);
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
}

/** The scheduled notification already alerts on device. */
export function timerFinished(timerId: string): void {
  scheduled.delete(timerId);
}
