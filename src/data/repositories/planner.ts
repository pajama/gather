import { generatePlan, type PlanCandidate } from '@/core/planner/planner';
import { newId, now } from '@/core/model/recipe';
import type { DayKey, ID, MealPlanEntry, MealSlot } from '@/core/model/types';

import type { Collections } from '../database';

export class PlannerRepository {
  constructor(private readonly c: Collections) {}

  /** Entries for the given days, ordered by slot and position. */
  entriesFor(days: readonly DayKey[]): MealPlanEntry[] {
    const set = new Set(days);
    const slotOrder: Record<MealSlot, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
    return this.c.plan
      .all()
      .filter((e) => set.has(e.day))
      .sort(
        (a, b) =>
          a.day.localeCompare(b.day) || slotOrder[a.slot] - slotOrder[b.slot] || a.sortIndex - b.sortIndex,
      );
  }

  add(
    day: DayKey,
    slot: MealSlot,
    entry: { recipeId?: ID; title?: string; servings?: number },
  ): MealPlanEntry {
    const stamp = now();
    const siblings = this.c.plan.all().filter((e) => e.day === day && e.slot === slot);
    const created: MealPlanEntry = {
      id: newId(),
      createdAt: stamp,
      updatedAt: stamp,
      day,
      slot,
      sortIndex: siblings.length,
      ...(entry.recipeId ? { recipeId: entry.recipeId } : {}),
      ...(entry.title ? { title: entry.title } : {}),
      ...(entry.servings ? { servings: entry.servings } : {}),
    };
    this.c.plan.upsert(created);
    return created;
  }

  move(id: ID, day: DayKey, slot?: MealSlot): void {
    this.c.plan.update(id, (e) => ({ ...e, day, slot: slot ?? e.slot, updatedAt: now() }));
  }

  update(id: ID, patch: Partial<MealPlanEntry>): void {
    this.c.plan.update(id, (e) => ({ ...e, ...patch, updatedAt: now() }));
  }

  remove(id: ID): void {
    this.c.plan.remove(id);
  }

  clearDays(days: readonly DayKey[]): void {
    const set = new Set(days);
    this.c.plan.remove(
      ...this.c.plan
        .all()
        .filter((e) => set.has(e.day))
        .map((e) => e.id),
    );
  }

  /** The next upcoming day each recipe is planned for (for "Planned" badges). */
  nextPlannedDay(recipeId: ID, from: DayKey): DayKey | undefined {
    return this.c.plan
      .all()
      .filter((e) => e.recipeId === recipeId && e.day >= from)
      .map((e) => e.day)
      .sort()[0];
  }

  /** Fills empty days in a slot with recipes from the library. */
  autofill(days: DayKey[], slot: MealSlot, random?: () => number): MealPlanEntry[] {
    const folders = new Map(this.c.folders.all().map((f) => [f.id, f.name]));
    const lastPlanned = new Map<ID, DayKey>();
    for (const e of this.c.plan.all()) {
      if (!e.recipeId) continue;
      const prev = lastPlanned.get(e.recipeId);
      if (!prev || e.day > prev) lastPlanned.set(e.recipeId, e.day);
    }
    const candidates: PlanCandidate[] = this.c.recipes.all().map((r) => ({
      id: r.id,
      tags: r.tags,
      folderNames: r.folderIds.map((f) => folders.get(f)).filter((n): n is string => !!n),
      favorite: r.favorite,
      ...(lastPlanned.has(r.id) ? { lastPlannedDay: lastPlanned.get(r.id)! } : {}),
    }));
    const occupied = new Set(
      this.c.plan
        .all()
        .filter((e) => e.slot === slot)
        .map((e) => e.day),
    );
    const picks = generatePlan({
      days,
      slot,
      candidates,
      occupiedDays: occupied,
      ...(random ? { random } : {}),
    });
    return picks.map((p) => this.add(p.day, slot, { recipeId: p.recipeId }));
  }
}
