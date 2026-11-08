import { describe, expect, it } from 'vitest';

import {
  addDays,
  generatePlan,
  matchesSlot,
  relativeDayName,
  seededRandom,
  startOfWeek,
  weekDays,
  weekRangeLabel,
} from './planner';

describe('planner dates', () => {
  it('computes weeks', () => {
    // 2026-11-07 is a Saturday.
    expect(startOfWeek('2026-11-07', 0)).toBe('2026-11-01');
    expect(startOfWeek('2026-11-07', 1)).toBe('2026-11-02');
    expect(weekDays('2026-11-07', 0)).toHaveLength(7);
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(weekRangeLabel(weekDays('2026-11-30', 1))).toBe('Nov 30 – Dec 6');
  });

  it('names relative days', () => {
    expect(relativeDayName('2026-11-07', '2026-11-07')).toBe('Today');
    expect(relativeDayName('2026-11-08', '2026-11-07')).toBe('Tomorrow');
    expect(relativeDayName('2026-11-10', '2026-11-07')).toBe('Tuesday');
  });
});

describe('plan generation', () => {
  const candidates = [
    { id: 'a', tags: ['Dinner'] },
    { id: 'b', tags: ['dinner'] },
    { id: 'c', tags: [], folderNames: ['Dinners'] },
    { id: 'd', tags: ['Breakfast'] },
    { id: 'e', tags: ['dinner'], lastPlannedDay: '2026-11-05' },
  ];

  it('matches slots by tag or folder', () => {
    expect(matchesSlot(candidates[2]!, 'dinner')).toBe(true);
    expect(matchesSlot(candidates[3]!, 'dinner')).toBe(false);
  });

  it('fills free days without repeats, preferring labelled recipes', () => {
    const days = weekDays('2026-11-09', 1).slice(0, 3);
    const plan = generatePlan({
      days,
      slot: 'dinner',
      candidates,
      occupiedDays: new Set([days[1]!]),
      random: seededRandom(7),
    });
    expect(plan.map((p) => p.day)).toEqual([days[0], days[2]]);
    expect(new Set(plan.map((p) => p.recipeId)).size).toBe(2);
    for (const p of plan) expect(['a', 'b', 'c']).toContain(p.recipeId);
  });
});
