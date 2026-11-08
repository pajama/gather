import { describe, expect, it } from 'vitest';

import { aisleFor } from './aisles';
import { combineLines, groceryKey, groceryLineFrom, mergeGroceryLines } from './merge';

describe('aisles', () => {
  it.each([
    ['baby spinach', 'produce'],
    ['garlic powder', 'spices'],
    ['garlic', 'produce'],
    ['coconut milk', 'international'],
    ['whole milk', 'dairy'],
    ['large eggs', 'dairy'],
    ['chicken thighs', 'meat'],
    ['all-purpose flour', 'baking'],
    ['extra virgin olive oil', 'pantry'],
    ['frozen peas', 'frozen'],
    ['unobtainium', 'other'],
  ])('%s -> %s', (name, aisle) => {
    expect(aisleFor(name)).toBe(aisle);
  });
});

describe('grocery lines', () => {
  it('builds clean lines', () => {
    expect(groceryLineFrom('2 large eggs, beaten', { recipeId: 'r1' })).toEqual({
      text: '2 eggs',
      name: 'eggs',
      aisle: 'dairy',
      recipeIds: ['r1'],
    });
    expect(groceryLineFrom('1 cup milk', { scale: 2 }).text).toBe('2 cups milk');
  });

  it('merge keys ignore plurals and case', () => {
    expect(groceryKey('Tomatoes')).toBe(groceryKey('tomato'));
  });

  it('adds compatible amounts', () => {
    const a = groceryLineFrom('1 cup milk', { recipeId: 'a' });
    const b = groceryLineFrom('½ cup milk', { recipeId: 'b' });
    expect(combineLines(a, b)).toMatchObject({ text: '1½ cups milk', recipeIds: ['a', 'b'] });
    const tsp = groceryLineFrom('2 tbsp butter');
    const more = groceryLineFrom('1 tsp butter');
    expect(combineLines(tsp, more)?.text).toBe('2⅓ tbsp butter');
  });

  it('keeps incompatible amounts apart', () => {
    const a = groceryLineFrom('2 cloves garlic');
    const b = groceryLineFrom('1 tsp garlic');
    expect(combineLines(a, b)).toBeNull();
    expect(mergeGroceryLines([a], [b])).toHaveLength(2);
  });

  it('merges counts and amount-less lines', () => {
    const merged = mergeGroceryLines(
      [groceryLineFrom('2 eggs'), groceryLineFrom('salt')],
      [groceryLineFrom('1 large egg'), groceryLineFrom('Salt, to taste')],
    );
    expect(merged.map((l) => l.text)).toEqual(['3 eggs', 'salt']);
  });
});

describe('merging two-part and alternative amounts', () => {
  it('drops an alternative measure once amounts are added', () => {
    expect(combineLines(groceryLineFrom('1 cup (240ml) milk'), groceryLineFrom('½ cup milk'))?.text).toBe(
      '1½ cups milk',
    );
  });

  it('counts a two-part amount as one', () => {
    expect(
      combineLines(groceryLineFrom('1/2 cup + 2 tbsp sugar'), groceryLineFrom('1 cup sugar'))?.text,
    ).toBe('1⅝ cups sugar');
  });
});
