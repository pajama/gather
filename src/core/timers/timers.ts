/**
 * Kitchen timers as plain data, so they can be stored and survive a reload
 * or an app restart (Crouton keeps its timers in its database too). A timer
 * is running or paused; "done" is derived from the clock.
 */

export interface KitchenTimer {
  id: string;
  label: string;
  recipeId?: string;
  totalSeconds: number;
  /** Epoch ms when a running timer ends. */
  endsAt?: number;
  /** Seconds left while paused. */
  pausedRemaining?: number;
  state: 'running' | 'paused';
  /** Epoch ms. */
  createdAt: number;
}

export type TimerStatus = 'running' | 'paused' | 'done';

export function timerStatus(timer: KitchenTimer, now: number): TimerStatus {
  if (timer.state === 'paused') return 'paused';
  return (timer.endsAt ?? now) <= now ? 'done' : 'running';
}

/** Seconds left, never negative. */
export function timerRemaining(timer: KitchenTimer, now: number): number {
  if (timer.state === 'paused') return Math.max(0, timer.pausedRemaining ?? 0);
  return Math.max(0, ((timer.endsAt ?? now) - now) / 1000);
}

/** 0 when just started, 1 when finished. */
export function timerProgress(timer: KitchenTimer, now: number): number {
  if (!timer.totalSeconds) return 1;
  return Math.min(1, Math.max(0, 1 - timerRemaining(timer, now) / timer.totalSeconds));
}

export function createTimer(
  id: string,
  label: string,
  seconds: number,
  now: number,
  recipeId?: string,
): KitchenTimer {
  const total = Math.max(1, Math.round(seconds));
  return {
    id,
    label,
    totalSeconds: total,
    endsAt: now + total * 1000,
    state: 'running',
    createdAt: now,
    ...(recipeId ? { recipeId } : {}),
  };
}

export function pauseTimer(timer: KitchenTimer, now: number): KitchenTimer {
  if (timerStatus(timer, now) !== 'running') return timer;
  const { endsAt: _endsAt, ...rest } = timer;
  return { ...rest, state: 'paused', pausedRemaining: timerRemaining(timer, now) };
}

export function resumeTimer(timer: KitchenTimer, now: number): KitchenTimer {
  if (timer.state !== 'paused') return timer;
  const { pausedRemaining, ...rest } = timer;
  return { ...rest, state: 'running', endsAt: now + (pausedRemaining ?? 0) * 1000 };
}

/** Adds time; a finished timer starts running again from now. */
export function addTimerTime(timer: KitchenTimer, seconds: number, now: number): KitchenTimer {
  if (timer.state === 'paused')
    return {
      ...timer,
      pausedRemaining: (timer.pausedRemaining ?? 0) + seconds,
      totalSeconds: timer.totalSeconds + seconds,
    };
  const base = Math.max(now, timer.endsAt ?? now);
  return {
    ...timer,
    state: 'running',
    endsAt: base + seconds * 1000,
    totalSeconds: timer.totalSeconds + seconds,
  };
}

/** Timers worth keeping after a restart: anything not finished more than `maxAgeMs` ago. */
export function isStale(timer: KitchenTimer, now: number, maxAgeMs = 60 * 60 * 1000): boolean {
  return timerStatus(timer, now) === 'done' && now - (timer.endsAt ?? now) > maxAgeMs;
}
