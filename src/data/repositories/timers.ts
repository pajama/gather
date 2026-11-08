import { newId } from '@/core/model/recipe';
import { addTimerTime, createTimer, isStale, pauseTimer, resumeTimer, type KitchenTimer } from '@/core/timers/timers';

import type { Collections } from '../database';

/** Kitchen timers, stored so they survive reloads and restarts. */
export class TimersRepository {
  constructor(private readonly c: Collections) {}

  all(): readonly KitchenTimer[] {
    return this.c.timers.all();
  }

  start(label: string, seconds: number, recipeId?: string, now = Date.now()): KitchenTimer {
    const timer = createTimer(newId(), label, seconds, now, recipeId);
    this.c.timers.upsert(timer);
    return timer;
  }

  pause(id: string, now = Date.now()): void {
    this.c.timers.update(id, (t) => pauseTimer(t, now));
  }

  resume(id: string, now = Date.now()): KitchenTimer | undefined {
    return this.c.timers.update(id, (t) => resumeTimer(t, now));
  }

  addTime(id: string, seconds: number, now = Date.now()): KitchenTimer | undefined {
    return this.c.timers.update(id, (t) => addTimerTime(t, seconds, now));
  }

  cancel(id: string): void {
    this.c.timers.remove(id);
  }

  /** Forgets timers that finished long ago (called at startup). */
  prune(now = Date.now()): void {
    const stale = this.c.timers.all().filter((t) => isStale(t, now)).map((t) => t.id);
    if (stale.length) this.c.timers.remove(...stale);
  }
}
