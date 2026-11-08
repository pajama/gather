import { describe, expect, it } from 'vitest';

import { inFolder, queryLibrary } from './library';
import { createRecipe, mapRecipeImages } from './recipe';

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
    const f1 = { id: 'f1', name: 'Soups', sortIndex: 0, createdAt: '', updatedAt: '' };
    expect(queryLibrary(recipes, { folder: f1 }).map((r) => r.name)).toEqual(['Tomato Soup']);
    expect(queryLibrary(recipes, { tag: 'baking' }).map((r) => r.name)).toEqual(['Banana Bread']);
  });

  it('sorts by name, cooked and quickest', () => {
    expect(queryLibrary(recipes, { sort: 'name' }).map((r) => r.name)).toEqual(['apple pie', 'Banana Bread', 'Tomato Soup']);
    expect(queryLibrary(recipes, { sort: 'cooked' })[0]!.name).toBe('apple pie');
    expect(queryLibrary(recipes, { sort: 'quickest' }).map((r) => r.name)).toEqual(['Tomato Soup', 'Banana Bread', 'apple pie']);
    const rated = recipes.map((r) => (r.name === 'Tomato Soup' ? { ...r, rating: 5 } : r.name === 'apple pie' ? { ...r, rating: 3 } : r));
    expect(queryLibrary(rated, { sort: 'rating' }).map((r) => r.name)).toEqual(['Tomato Soup', 'apple pie', 'Banana Bread']);
  });
});

describe('recipe drafts', () => {
  it('round-trips through the portable draft form', async () => {
    const { recipeFromDraft, recipeToDraft } = await import('./recipe');
    const { parseRecipeText } = await import('../import/text');
    const original = recipeFromDraft(parseRecipeText('Scones\nServes 8\nIngredients\n2 cups flour\nFor the glaze:\n1 cup sugar\nMethod\n1. Bake 12 minutes.'), {
      nutrition: { calories: '200 kcal' },
      rating: 5,
    });
    const copy = recipeFromDraft(recipeToDraft(original));
    expect(copy.name).toBe('Scones');
    expect(copy.servings).toBe(8);
    expect(copy.rating).toBe(5);
    expect(copy.nutrition).toEqual({ calories: '200 kcal' });
    expect(copy.ingredients.map((s) => [s.title, s.items.map((i) => i.text)])).toEqual([
      [undefined, ['2 cups flour']],
      ['For the glaze', ['1 cup sugar']],
    ]);
    expect(copy.id).not.toBe(original.id);
  });

  it('collects recipes into smart folders by tag', () => {
    const tagged = recipes.map((r, i) => ({ ...r, tags: i === 0 ? ['Dinner', 'Quick'] : i === 1 ? ['dinner'] : ['Baking'] }));
    const base = { id: 'smart', name: 'Weeknights', sortIndex: 0, createdAt: '', updatedAt: '' };
    const any = { ...base, tags: ['dinner'] };
    const all = { ...base, tags: ['Dinner', 'quick'], tagMatch: 'all' as const };
    expect(tagged.filter((r) => inFolder(r, any)).map((r) => r.name)).toEqual([tagged[0]!.name, tagged[1]!.name]);
    expect(tagged.filter((r) => inFolder(r, all)).map((r) => r.name)).toEqual([tagged[0]!.name]);
    const manual = { ...tagged[2]!, folderIds: ['smart'] };
    expect(inFolder(manual, all)).toBe(true);
    expect(queryLibrary([...tagged.slice(0, 2), manual], { folder: all, sort: 'name' }).length).toBe(2);
  });
});

describe('mapRecipeImages', () => {
  it('maps every image URI and leaves the rest of the recipe alone', async () => {
    const recipe = createRecipe({ name: 'Soup', images: [{ id: 'a', uri: 'photo://a.jpg' }, { id: 'b', uri: 'https://x/b.jpg' }] });
    const mapped = await mapRecipeImages(recipe, async (uri) => (uri.startsWith('photo://') ? 'data:image/jpeg;base64,AAAA' : uri));
    expect(mapped.images.map((i) => i.uri)).toEqual(['data:image/jpeg;base64,AAAA', 'https://x/b.jpg']);
    expect(mapped.images.map((i) => i.id)).toEqual(['a', 'b']);
    expect(mapped.name).toBe('Soup');
    expect(recipe.images[0]?.uri).toBe('photo://a.jpg');
  });
});

describe('createRecipe', () => {
  it('always mints a new id, even when given one', () => {
    const fields = { id: 'existing', name: 'Copy' } as unknown as Parameters<typeof createRecipe>[0];
    expect(createRecipe(fields).id).not.toBe('existing');
  });
});
