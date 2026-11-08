import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { IndexedDBStore } from './indexeddb-store';

let n = 0;
const open = () => IndexedDBStore.open(`gather-test-${++n}`);
const doc = (id: string, value: unknown = id) => ({ id, json: JSON.stringify(value) });
const ids = async (store: IndexedDBStore, collection: string) =>
  (await store.loadAll(collection)).map((d) => d.id).sort();

describe('IndexedDBStore', () => {
  it('stores, deletes and reloads documents per collection', async () => {
    const store = await open();
    await store.putMany('recipes', [doc('a'), doc('b')]);
    await store.putMany('plan', [doc('a')]);
    await store.deleteMany('recipes', ['a']);
    expect(await ids(store, 'recipes')).toEqual(['b']);
    expect(await ids(store, 'plan')).toEqual(['a']);
    await store.setMeta('seeded', 'yes');
    expect(await store.getMeta('seeded')).toBe('yes');
    expect(await store.getMeta('missing')).toBeNull();
  });

  it('replaces several collections at once', async () => {
    const store = await open();
    await store.putMany('recipes', [doc('a'), doc('b')]);
    await store.putMany('plan', [doc('p')]);
    await store.putMany('feeds', [doc('f')]);
    await store.replaceCollections({ recipes: [doc('c')], plan: [] });
    expect(await ids(store, 'recipes')).toEqual(['c']);
    expect(await ids(store, 'plan')).toEqual([]);
    expect(await ids(store, 'feeds')).toEqual(['f']);
  });

  it('changes nothing when part of a replace fails', async () => {
    const store = await open();
    await store.putMany('recipes', [doc('a')]);
    await store.putMany('plan', [doc('p')]);
    const broken = { id: undefined as unknown as string, json: '{}' };
    await expect(store.replaceCollections({ recipes: [doc('c')], plan: [broken] })).rejects.toBeTruthy();
    expect(await ids(store, 'recipes')).toEqual(['a']);
    expect(await ids(store, 'plan')).toEqual(['p']);
  });

  it('clears one collection', async () => {
    const store = await open();
    await store.putMany('recipes', [doc('a'), doc('b')]);
    await store.putMany('plan', [doc('p')]);
    await store.clear('recipes');
    expect(await ids(store, 'recipes')).toEqual([]);
    expect(await ids(store, 'plan')).toEqual(['p']);
  });
});

describe('two tabs', () => {
  it('reloads what another tab changed', async () => {
    const { Database } = await import('../database');
    const name = `gather-tabs-${Date.now()}`;
    const tabA = await Database.open(await IndexedDBStore.open(name));
    const tabB = await Database.open(await IndexedDBStore.open(name));
    const recipe = tabA.recipes.create({ name: 'From tab A' });
    await tabA.flush();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(tabB.recipes.get(recipe.id)?.name).toBe('From tab A');

    tabB.recipes.setRating(recipe.id, 4);
    await tabB.flush();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(tabA.recipes.get(recipe.id)?.rating).toBe(4);

    tabA.updateSettings({ accent: 'plum' });
    await tabA.flush();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(tabB.settings.accent).toBe('plum');
  });
});
