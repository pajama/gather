import { describe, expect, it } from 'vitest';

import { queryLibrary } from './library';
import { createRecipe } from './recipe';

const recipes = [
  createRecipe({ name: 'Banana Bread', createdAt: '2026-01-03T00:00:00Z', tags: ['Baking'], prepSeconds: 900, cookSeconds: 3600 }),
  createRecipe({
    name: 'Tomato Soup',
    createdAt: '2026-01-02T00:00:00Z',
    favorite: true,
    folderIds: ['f1'],
    ingredients: [{ id: 's', items: [{ id: 'i', text: '2 lb ripe tomatoes' }] }],
    cookSeconds: 1800,
  }),
  createRecipe({ name: 'apple pie', createdAt: '2026-01-01T00:00:00Z', lastCookedAt: '2026-02-01T00:00:00Z' }),
];

describe('queryLibrary', () => {
  it('sorts by recency by default', () => {
    expect(queryLibrary(recipes, {}).map((r) => r.name)).toEqual(['Banana Bread', 'Tomato Soup', 'apple pie']);
  });

  it('searches ingredients and names with every word', () => {
    expect(queryLibrary(recipes, { text: 'tomatoes' }).map((r) => r.name)).toEqual(['Tomato Soup']);
    expect(queryLibrary(recipes, { text: 'bread banana' }).map((r) => r.name)).toEqual(['Banana Bread']);
    expect(queryLibrary(recipes, { text: 'bread soup' })).toEqual([]);
  });

  it('filters by scope and tag', () => {
    expect(queryLibrary(recipes, { scope: 'favorites' }).map((r) => r.name)).toEqual(['Tomato Soup']);
    expect(queryLibrary(recipes, { scope: 'f1' }).map((r) => r.name)).toEqual(['Tomato Soup']);
    expect(queryLibrary(recipes, { tag: 'baking' }).map((r) => r.name)).toEqual(['Banana Bread']);
  });

  it('sorts by name, cooked and quickest', () => {
    expect(queryLibrary(recipes, { sort: 'name' }).map((r) => r.name)).toEqual(['apple pie', 'Banana Bread', 'Tomato Soup']);
    expect(queryLibrary(recipes, { sort: 'cooked' })[0]!.name).toBe('apple pie');
    expect(queryLibrary(recipes, { sort: 'quickest' }).map((r) => r.name)).toEqual(['Tomato Soup', 'Banana Bread', 'apple pie']);
  });
});
