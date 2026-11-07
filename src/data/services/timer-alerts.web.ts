/**
 * Browser timer alerts: a short chime through Web Audio, plus a system
 * notification when the tab is in the background and permission was given.
 */

let audio: AudioContext | null = null;

function chime(): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audio ??= new Ctor();
    const now = audio.currentTime;
    [880, 1175, 1568].forEach((freq, i) => {
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.5);
      osc.connect(gain).connect(audio!.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.55);
    });
  } catch {
    // Audio can be blocked until the user interacts with the page.
  }
}

const labels = new Map<string, string>();

export async function scheduleTimerAlert(timerId: string, label: string): Promise<void> {
  labels.set(timerId, label);
  // Starting a timer is a user gesture: a good moment to unlock audio and ask once for notifications.
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    // Ignore: chime() retries later.
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') void Notification.requestPermission();
}

export async function cancelTimerAlert(timerId: string): Promise<void> {
  labels.delete(timerId);
}

export function timerFinished(timerId: string): void {
  const label = labels.get(timerId) ?? 'Your timer is done';
  labels.delete(timerId);
  chime();
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState === 'hidden') {
    new Notification('Timer done', { body: label });
  }
}
