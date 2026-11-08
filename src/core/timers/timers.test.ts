import { describe, expect, it } from 'vitest';

import {
  addTimerTime,
  createTimer,
  isStale,
  pauseTimer,
  resumeTimer,
  timerProgress,
  timerRemaining,
  timerStatus,
} from './timers';

const T0 = 1_000_000;

describe('kitchen timers', () => {
  it('runs down and finishes on the clock', () => {
    const t = createTimer('a', 'Rice', 600, T0, 'recipe-1');
    expect(t).toMatchObject({
      totalSeconds: 600,
      state: 'running',
      endsAt: T0 + 600_000,
      recipeId: 'recipe-1',
    });
    expect(timerRemaining(t, T0 + 60_000)).toBe(540);
    expect(timerProgress(t, T0 + 300_000)).toBeCloseTo(0.5);
    expect(timerStatus(t, T0 + 599_000)).toBe('running');
    expect(timerStatus(t, T0 + 600_000)).toBe('done');
    expect(timerRemaining(t, T0 + 700_000)).toBe(0);
  });

  it('pauses and resumes without losing time', () => {
    const t = createTimer('a', 'Rice', 600, T0);
    const paused = pauseTimer(t, T0 + 100_000);
    expect(paused.state).toBe('paused');
    expect(paused.endsAt).toBeUndefined();
    expect(timerRemaining(paused, T0 + 900_000)).toBe(500);
    const resumed = resumeTimer(paused, T0 + 1_000_000);
    expect(timerRemaining(resumed, T0 + 1_000_000)).toBe(500);
    expect(timerStatus(resumed, T0 + 1_500_000)).toBe('done');
    expect(pauseTimer(resumed, T0 + 2_000_000)).toBe(resumed);
  });

  it('adds time, restarting a finished timer', () => {
    const t = createTimer('a', 'Rice', 60, T0);
    expect(timerRemaining(addTimerTime(t, 60, T0 + 30_000), T0 + 30_000)).toBe(90);
    const restarted = addTimerTime(t, 60, T0 + 120_000);
    expect(timerStatus(restarted, T0 + 120_000)).toBe('running');
    expect(timerRemaining(restarted, T0 + 120_000)).toBe(60);
    const paused = addTimerTime(pauseTimer(t, T0), 30, T0);
    expect(paused.pausedRemaining).toBe(90);
  });

  it('drops timers that finished long ago', () => {
    const t = createTimer('a', 'Rice', 60, T0);
    expect(isStale(t, T0 + 30_000)).toBe(false);
    expect(isStale(t, T0 + 60_000 + 30 * 60_000)).toBe(false);
    expect(isStale(t, T0 + 60_000 + 61 * 60_000)).toBe(true);
    expect(isStale(pauseTimer(t, T0), T0 + 10 * 3_600_000)).toBe(false);
  });
});
