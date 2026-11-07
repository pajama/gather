/**
 * Planner date helpers and automatic meal-plan generation. Days are local
 * calendar dates ("YYYY-MM-DD") so plans do not drift across time zones.
 */

import type { DayKey, ID, MealSlot } from '../model/types';

export function dayKey(date: Date): DayKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function addDays(key: DayKey, days: number): DayKey {
  const date = parseDayKey(key);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

export function startOfWeek(key: DayKey, weekStartsOn: number): DayKey {
  const date = parseDayKey(key);
  const diff = (date.getDay() - weekStartsOn + 7) % 7;
  return addDays(key, -diff);
}

export function weekDays(key: DayKey, weekStartsOn: number): DayKey[] {
  const start = startOfWeek(key, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** `count` consecutive days starting at `key`. */
export function daysFrom(key: DayKey, count: number): DayKey[] {
  return Array.from({ length: count }, (_, i) => addDays(key, i));
}

export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((parseDayKey(b).getTime() - parseDayKey(a).getTime()) / 86400000);
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Today", "Tomorrow", "Yesterday", else "Wednesday". */
export function relativeDayName(key: DayKey, today: DayKey): string {
  const diff = daysBetween(today, key);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return WEEKDAY[parseDayKey(key).getDay()]!;
}

/** "Nov 9". */
export function shortDate(key: DayKey): string {
  const d = parseDayKey(key);
  return `${MONTH[d.getMonth()]} ${d.getDate()}`;
}

/** "Nov 9 – 15", "Nov 30 – Dec 6". */
export function weekRangeLabel(days: DayKey[]): string {
  const first = parseDayKey(days[0]!);
  const last = parseDayKey(days[days.length - 1]!);
  const left = `${MONTH[first.getMonth()]} ${first.getDate()}`;
  const right = first.getMonth() === last.getMonth() ? `${last.getDate()}` : `${MONTH[last.getMonth()]} ${last.getDate()}`;
  return `${left} – ${right}`;
}

export function weekdayShort(key: DayKey): string {
  return WEEKDAY[parseDayKey(key).getDay()]!.slice(0, 3);
}

/** Small seeded PRNG (mulberry32) so generated plans are reproducible in tests. */
export function seededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PlanCandidate {
  id: ID;
  tags: string[];
  folderNames?: string[];
  favorite?: boolean;
  lastPlannedDay?: DayKey;
}

export interface GenerateOptions {
  days: DayKey[];
  slot: MealSlot;
  candidates: PlanCandidate[];
  /** Days that already have something in this slot are skipped. */
  occupiedDays?: ReadonlySet<DayKey>;
  /** Avoid recipes planned within this many days. Default 14. */
  avoidRepeatsWithin?: number;
  random?: () => number;
}

/** True when a recipe is suitable for the slot: tagged or filed under it ("Dinner", "Dinners"). */
export function matchesSlot(candidate: PlanCandidate, slot: MealSlot): boolean {
  const labels = [...candidate.tags, ...(candidate.folderNames ?? [])].map((t) => t.toLowerCase());
  const words = slot === 'dinner' ? ['dinner', 'dinners', 'main', 'mains', 'main course', 'supper'] : [slot, `${slot}s`];
  return labels.some((l) => words.includes(l));
}

/**
 * Picks one recipe per free day. Prefers recipes labelled for the slot, then
 * favorites, and avoids repeats within the window and within the plan.
 */
export function generatePlan(options: GenerateOptions): { day: DayKey; recipeId: ID }[] {
  const random = options.random ?? Math.random;
  const window = options.avoidRepeatsWithin ?? 14;
  const labelled = options.candidates.filter((c) => matchesSlot(c, options.slot));
  const pool = labelled.length >= 3 ? labelled : options.candidates;
  const used = new Set<ID>();
  const result: { day: DayKey; recipeId: ID }[] = [];
  for (const day of options.days) {
    if (options.occupiedDays?.has(day)) continue;
    const fresh = pool.filter(
      (c) => !used.has(c.id) && (!c.lastPlannedDay || Math.abs(daysBetween(c.lastPlannedDay, day)) > window),
    );
    const choices = fresh.length ? fresh : pool.filter((c) => !used.has(c.id));
    if (choices.length === 0) break;
    const weighted = choices.flatMap((c) => (c.favorite ? [c, c] : [c]));
    const pick = weighted[Math.floor(random() * weighted.length)]!;
    used.add(pick.id);
    result.push({ day, recipeId: pick.id });
  }
  return result;
}
