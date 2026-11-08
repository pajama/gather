import { describe, expect, it } from 'vitest';

import { SerialQueue } from './serial';

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

describe('SerialQueue', () => {
  it('never runs two tasks at once and keeps their order', async () => {
    const queue = new SerialQueue();
    let running = 0;
    let maxRunning = 0;
    const order: number[] = [];
    const task = (n: number) => async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await tick();
      order.push(n);
      running--;
      return n;
    };
    const results = await Promise.all([1, 2, 3, 4, 5].map((n) => queue.run(task(n))));
    expect(results).toEqual([1, 2, 3, 4, 5]);
    expect(order).toEqual([1, 2, 3, 4, 5]);
    expect(maxRunning).toBe(1);
  });

  it('keeps going after a task fails', async () => {
    const queue = new SerialQueue();
    const failed = queue.run(async () => {
      await tick();
      throw new Error('boom');
    });
    const next = queue.run(async () => 'still runs');
    await expect(failed).rejects.toThrow('boom');
    await expect(next).resolves.toBe('still runs');
  });
});
