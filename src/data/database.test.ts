import { describe, expect, it } from 'vitest';

import { parseRecipeText } from '@/core/import/text';
import { seededRandom, weekDays } from '@/core/planner/planner';

import { BackupError, Database } from './database';
import { MemoryStore } from './store/document-store';

const PANCAKES = `Pancakes
Serves 4

Ingredients
1 cup flour
1 cup milk
2 eggs
Salt, to taste

Method
1. Whisk everything.
2. Fry 2 minutes per side.`;

const CREPES = `Crepes
Ingredients
½ cup milk
1 egg
Method
1. Whisk.`;

async function openDb(store = new MemoryStore()) {
  return { db: await Database.open(store), store };
}

describe('Database', () => {
  it('persists recipes and reloads them', async () => {
    const { db, store } = await openDb();
    const recipe = db.recipes.createFromDraft(parseRecipeText(PANCAKES));
    await db.flush();
    const reopened = await Database.open(store);
    const loaded = reopened.recipes.get(recipe.id);
    expect(loaded?.name).toBe('Pancakes');
    expect(loaded?.servings).toBe(4);
    expect(loaded?.ingredients[0]?.items.map((i) => i.text)).toEqual([
      '1 cup flour',
      '1 cup milk',
      '2 eggs',
      'Salt, to taste',
    ]);
  });

  it('seeds once', async () => {
    const store = new MemoryStore();
    let seeded = 0;
    const seed = (db: Database) => {
      seeded++;
      db.recipes.create({ name: 'Seed' });
    };
    await Database.open(store, { seed });
    await Database.open(store, { seed });
    expect(seeded).toBe(1);
  });

  it('builds a merged grocery list from recipes', async () => {
    const { db } = await openDb();
    const pancakes = db.recipes.createFromDraft(parseRecipeText(PANCAKES));
    const crepes = db.recipes.createFromDraft(parseRecipeText(CREPES));
    db.groceries.addRecipe(pancakes.id);
    db.groceries.addRecipe(crepes.id, { scale: 2 });
    const texts = db.groceries.items().map((g) => g.text);
    expect(texts).toEqual(['1 cup flour', '2 cups milk', '4 eggs', 'Salt']);
    const milk = db.groceries.items().find((g) => g.name === 'milk');
    expect(milk?.recipeIds).toEqual([pancakes.id, crepes.id]);
    expect(milk?.aisle).toBe('dairy');
  });

  it('does not merge into checked items', async () => {
    const { db } = await openDb();
    db.groceries.addText('1 cup milk');
    db.groceries.toggle(db.groceries.items()[0]!.id);
    db.groceries.addText('1 cup milk');
    expect(db.groceries.items().map((g) => [g.text, g.checked])).toEqual([
      ['1 cup milk', true],
      ['1 cup milk', false],
    ]);
    expect(db.groceries.clearChecked()).toBe(1);
  });

  it('cascades recipe deletion', async () => {
    const { db } = await openDb();
    const recipe = db.recipes.createFromDraft(parseRecipeText(PANCAKES));
    db.planner.add('2026-11-09', 'dinner', { recipeId: recipe.id });
    db.groceries.addRecipe(recipe.id);
    db.recipes.delete(recipe.id);
    expect(db.planner.entriesFor(['2026-11-09'])).toEqual([]);
    expect(db.groceries.items().every((g) => g.recipeIds.length === 0)).toBe(true);
  });

  it('removes deleted folders from recipes', async () => {
    const { db } = await openDb();
    const folder = db.folders.create('Dinners');
    const recipe = db.recipes.create({ name: 'Soup', folderIds: [folder.id] });
    expect(db.folders.recipeCount(folder.id)).toBe(1);
    db.folders.delete(folder.id);
    expect(db.recipes.get(recipe.id)?.folderIds).toEqual([]);
  });

  it('autofills a week of dinners from labelled recipes', async () => {
    const { db } = await openDb();
    for (const name of ['A', 'B', 'C', 'D']) db.recipes.create({ name, tags: ['Dinner'] });
    db.recipes.create({ name: 'Oats', tags: ['Breakfast'] });
    const days = weekDays('2026-11-09', 0);
    db.planner.add(days[0]!, 'dinner', { title: 'Dinner out' });
    const added = db.planner.autofill(days, 'dinner', seededRandom(3));
    expect(added).toHaveLength(4);
    const names = added.map((e) => db.recipes.get(e.recipeId)?.name);
    expect(names).not.toContain('Oats');
  });

  it('keeps timers across a restart and forgets long-finished ones', async () => {
    const { db, store } = await openDb();
    const now = Date.now();
    const running = db.timers.start('Pancakes: step 2', 120, undefined, now);
    const old = db.timers.start('Yesterday', 60, undefined, now - 3 * 3_600_000);
    db.timers.pause(running.id, now + 30_000);
    await db.flush();
    const reopened = await Database.open(store);
    expect(reopened.timers.all().map((t) => t.id)).toEqual([running.id]);
    expect(reopened.timers.all()[0]).toMatchObject({ state: 'paused', pausedRemaining: 90 });
    expect(reopened.timers.all().some((t) => t.id === old.id)).toBe(false);
  });

  it('round-trips a backup', async () => {
    const { db } = await openDb();
    db.recipes.createFromDraft(parseRecipeText(PANCAKES));
    db.updateSettings({ accent: 'sage' });
    const backup = JSON.parse(JSON.stringify(db.exportBackup()));
    const { db: other, store } = await openDb();
    await other.restoreBackup(backup);
    expect(other.recipes.all().map((r) => r.name)).toEqual(['Pancakes']);
    expect(other.settings.accent).toBe('sage');
    await other.flush();
    const reopened = await Database.open(store);
    expect(reopened.recipes.all().map((r) => r.name)).toEqual(['Pancakes']);
  });

  it('duplicates a recipe without touching the original', async () => {
    const { db } = await openDb();
    const original = db.recipes.createFromDraft(parseRecipeText(PANCAKES));
    db.recipes.toggleFavorite(original.id);
    db.recipes.markCooked(original.id);
    const copy = db.recipes.duplicate(original.id)!;
    expect(copy.id).not.toBe(original.id);
    expect(db.recipes.all()).toHaveLength(2);
    const kept = db.recipes.get(original.id)!;
    expect(kept.name).toBe('Pancakes');
    expect(kept.favorite).toBe(true);
    expect(kept.cookCount).toBe(1);
    expect(copy.name).toBe('Pancakes (copy)');
    expect(copy.cookCount).toBe(0);
    expect(copy.lastCookedAt).toBeUndefined();
    const ids = (r: typeof copy) =>
      [...r.ingredients, ...r.steps].flatMap((s) => [s.id, ...s.items.map((i) => i.id)]);
    expect(ids(copy).some((id) => ids(kept).includes(id))).toBe(false);
    expect(copy.ingredients[0]?.items.map((i) => i.text)).toEqual(
      kept.ingredients[0]?.items.map((i) => i.text),
    );
  });

  it('rejects a damaged backup and changes nothing', async () => {
    const { db, store } = await openDb();
    db.recipes.createFromDraft(parseRecipeText(PANCAKES));
    db.groceries.addText('2 lemons');
    const backup = JSON.parse(JSON.stringify(db.exportBackup()));
    const { db: other } = await openDb();
    other.recipes.createFromDraft(parseRecipeText(CREPES));
    await other.flush();

    const missingFolders = { ...backup };
    delete missingFolders.folders;
    await expect(other.restoreBackup(missingFolders)).rejects.toThrow(BackupError);
    await expect(other.restoreBackup({ ...backup, plan: [{ slot: 'dinner' }] })).rejects.toThrow(/meal plan/);
    await expect(other.restoreBackup({ ...backup, version: 99 })).rejects.toThrow(/newer version/);
    await expect(other.restoreBackup({ hello: 'world' })).rejects.toThrow(/isn’t a Gather backup/);
    expect(other.recipes.all().map((r) => r.name)).toEqual(['Crepes']);
    expect(store).toBeDefined();
  });

  it('restores older backups and fills in missing fields', async () => {
    const { db } = await openDb();
    await db.restoreBackup({
      format: 'gather-backup',
      version: 1,
      exportedAt: '2026-01-01T00:00:00Z',
      recipes: [{ name: 'Old soup', ingredients: [{ items: [{ text: '1 onion' }] }] }],
      folders: [],
      plan: [],
      groceries: [{ text: '2 lemons' }],
      lists: [],
      settings: { accent: 'tomato', units: 42 },
    });
    const [soup] = db.recipes.all();
    expect(soup?.id).toMatch(/[0-9a-f-]{36}/);
    expect(soup?.ingredients[0]?.items[0]?.id).toBeTruthy();
    expect(soup?.tags).toEqual([]);
    const [lemons] = db.groceries.items();
    expect(lemons?.name).toBe('lemons');
    expect(lemons?.listId).toBe('default');
    expect(db.settings.accent).toBe('tomato');
    expect(db.settings.units).toBe('original');
  });

  it('can undo a restore', async () => {
    const { db } = await openDb();
    db.recipes.createFromDraft(parseRecipeText(CREPES));
    const { db: source } = await openDb();
    source.recipes.createFromDraft(parseRecipeText(PANCAKES));
    expect(await db.canUndoRestore()).toBe(false);
    await db.restoreBackup(JSON.parse(JSON.stringify(source.exportBackup())));
    expect(db.recipes.all().map((r) => r.name)).toEqual(['Pancakes']);
    expect(await db.canUndoRestore()).toBe(true);
    await db.undoRestore();
    expect(db.recipes.all().map((r) => r.name)).toEqual(['Crepes']);
    expect(await db.canUndoRestore()).toBe(false);
  });

  it('keeps the previous contents when an atomic replace fails', async () => {
    const store = new MemoryStore();
    const { db } = await openDb(store);
    db.recipes.createFromDraft(parseRecipeText(CREPES));
    await db.flush();
    await expect(
      store.replaceCollections({
        recipes: [{ id: 'ok', json: '{}' }],
        plan: [{ id: 7 as unknown as string, json: '{}' }],
      }),
    ).rejects.toThrow();
    const reopened = await Database.open(store);
    expect(reopened.recipes.all().map((r) => r.name)).toEqual(['Crepes']);
  });

  it('reports storage failures', async () => {
    const store = new MemoryStore();
    const db = await Database.open(store, { onError: () => undefined });
    expect(db.health.get()).toEqual({ persistent: false, failures: 0 });
    store.putMany = () => Promise.reject(new Error('disk full'));
    db.recipes.createFromDraft(parseRecipeText(CREPES));
    await db.flush();
    expect(db.health.get().failures).toBe(1);
    expect(db.health.get().lastError).toBe('disk full');
  });

  it('skips stored documents that cannot be read', async () => {
    const store = new MemoryStore();
    await store.putMany('plan', [
      { id: 'a', json: JSON.stringify({ id: 'a', day: '2026-01-01', slot: 'dinner', title: 'Leftovers' }) },
      { id: 'b', json: JSON.stringify({ id: 'b', slot: 'dinner' }) },
      { id: 'c', json: 'not json' },
    ]);
    const errors: unknown[] = [];
    const db = await Database.open(store, { onError: (e) => errors.push(e) });
    expect(db.collections.plan.all().map((e) => e.id)).toEqual(['a']);
    expect(errors).toHaveLength(2);
  });
});
