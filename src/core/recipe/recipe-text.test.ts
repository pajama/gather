import { describe, expect, it } from 'vitest';

import { formatIngredient, isIngredientHeading, parseIngredient } from './ingredients';
import { formatNumber, formatQuantity, parseLeadingQuantity, parseQuantity } from './quantity';
import { convert, convertToSystem, findUnit, getUnit, humanize } from './units';

describe('quantity parsing', () => {
  it.each([
    ['2', 2],
    ['1.5', 1.5],
    ['.5', 0.5],
    ['2,5', 2.5],
    ['1/2', 0.5],
    ['1 1/2', 1.5],
    ['1-1/2', 1.5],
    ['1½', 1.5],
    ['1 ½', 1.5],
    ['½', 0.5],
    ['⅔', 2 / 3],
    ['1⁄4', 0.25],
    ['1,000', 1000],
    ['one', 1],
    ['a', 1],
    ['dozen', 12],
  ])('%s -> %d', (input, value) => {
    expect(parseQuantity(input)?.value).toBeCloseTo(value);
  });

  it('reads ranges', () => {
    expect(parseQuantity('2-3')).toEqual({ value: 2, max: 3 });
    expect(parseQuantity('2 – 3')).toEqual({ value: 2, max: 3 });
    expect(parseQuantity('1 to 2')).toEqual({ value: 1, max: 2 });
    expect(parseQuantity('½-1')).toEqual({ value: 0.5, max: 1 });
    expect(parseQuantity('2 1/2-3')).toEqual({ value: 2.5, max: 3 });
  });

  it('does not treat vague articles as quantities', () => {
    expect(parseLeadingQuantity('a few sprigs thyme')).toBeNull();
    expect(parseLeadingQuantity('a pinch of salt')).toBeNull();
    expect(parseLeadingQuantity('salt')).toBeNull();
  });

  it('formats fractions as glyphs and metric as decimals', () => {
    expect(formatNumber(1.5)).toBe('1½');
    expect(formatNumber(0.333)).toBe('⅓');
    expect(formatNumber(2)).toBe('2');
    expect(formatNumber(2.99)).toBe('3');
    expect(formatNumber(0.2)).toBe('0.2');
    expect(formatNumber(337.5, 'decimal')).toBe('338');
    expect(formatNumber(12.25, 'decimal')).toBe('12.3');
    expect(formatNumber(1.25, 'decimal')).toBe('1.25');
    expect(formatQuantity({ value: 1, max: 1.5 })).toBe('1–1½');
  });
});

describe('units', () => {
  it('recognizes spellings', () => {
    expect(findUnit('Tbsp')?.id).toBe('tbsp');
    expect(findUnit('T')?.id).toBe('tbsp');
    expect(findUnit('t')?.id).toBe('tsp');
    expect(findUnit('grams')?.id).toBe('g');
    expect(findUnit('fl. oz.')?.id).toBe('floz');
    expect(findUnit('large')).toBeUndefined();
  });

  it('converts within a dimension', () => {
    expect(convert(1, getUnit('cup')!, getUnit('tbsp')!)).toBeCloseTo(16, 1);
    expect(convert(1, getUnit('lb')!, getUnit('g')!)).toBeCloseTo(453.6, 1);
  });

  it('humanizes', () => {
    const r = humanize(48, getUnit('tsp')!);
    expect(r.unit.id).toBe('cup');
    expect(r.value).toBeCloseTo(1, 2);
    expect(humanize(1500, getUnit('g')!).unit.id).toBe('kg');
    expect(humanize(2, getUnit('tsp')!).unit.id).toBe('tsp');
  });

  it('converts between systems', () => {
    const r = convertToSystem(1, getUnit('cup')!, 'metric');
    expect(r.unit.id).toBe('ml');
    expect(r.value).toBeCloseTo(236.6, 1);
    expect(convertToSystem(500, getUnit('g')!, 'us').unit.id).toBe('lb');
  });
});

describe('ingredient parsing', () => {
  it('parses a full line', () => {
    expect(parseIngredient('1 ½ cups (190g) all-purpose flour, spooned and leveled')).toMatchObject({
      quantity: { value: 1.5 },
      unit: 'cup',
      alt: '190g',
      name: 'all-purpose flour',
      note: 'spooned and leveled',
    });
  });

  it('parses package sizes', () => {
    expect(parseIngredient('2 (14.5 oz) cans diced tomatoes')).toMatchObject({
      quantity: { value: 2 },
      size: '14.5 oz',
      unit: 'can',
      name: 'diced tomatoes',
    });
    expect(parseIngredient('2 x 400g tins chopped tomatoes')).toMatchObject({
      quantity: { value: 2 },
      size: '400g',
      unit: 'can',
      name: 'chopped tomatoes',
    });
  });

  it('handles units glued to numbers and missing units', () => {
    expect(parseIngredient('200g plain flour')).toMatchObject({ quantity: { value: 200 }, unit: 'g', name: 'plain flour' });
    expect(parseIngredient('2 large eggs')).toMatchObject({ quantity: { value: 2 }, name: 'large eggs' });
    expect(parseIngredient('2 large eggs').unit).toBeUndefined();
    expect(parseIngredient('3 cloves garlic, minced')).toMatchObject({ unit: 'clove', name: 'garlic', note: 'minced' });
    expect(parseIngredient('1 bay leaf')).toMatchObject({ quantity: { value: 1 }, name: 'bay leaf' });
  });

  it('extracts notes', () => {
    expect(parseIngredient('Salt and pepper, to taste')).toMatchObject({ name: 'Salt and pepper', note: 'to taste' });
    expect(parseIngredient('salt to taste')).toMatchObject({ name: 'salt', note: 'to taste' });
    expect(parseIngredient('4 tbsp butter (softened)')).toMatchObject({ name: 'butter', note: 'softened' });
    expect(parseIngredient('1 onion - diced')).toMatchObject({ name: 'onion', note: 'diced' });
    expect(parseIngredient('Pinch of salt')).toMatchObject({ unit: 'pinch', name: 'salt' });
    expect(parseIngredient('▢ 1 tsp vanilla extract')).toMatchObject({ unit: 'tsp', name: 'vanilla extract' });
  });

  it('formats with scaling and conversion', () => {
    const flour = parseIngredient('1 ½ cups (190g) all-purpose flour, sifted');
    expect(formatIngredient(flour).full).toBe('1½ cups (190g) all-purpose flour, sifted');
    expect(formatIngredient(flour, { scale: 2 }).full).toBe('3 cups (380g) all-purpose flour, sifted');
    expect(formatIngredient(parseIngredient('2 tsp salt'), { scale: 6 }).amount).toBe('¼ cup');
    expect(formatIngredient(parseIngredient('1 cup milk'), { system: 'metric' }).amount).toBe('237 ml');
    expect(formatIngredient(parseIngredient('2 (14 oz) cans beans'), { scale: 2 }).amount).toBe('4 (14 oz) cans');
    expect(formatIngredient(parseIngredient('salt')).amount).toBe('');
  });

  it('detects headings', () => {
    expect(isIngredientHeading('For the sauce:')).toBe(true);
    expect(isIngredientHeading('FROSTING')).toBe(true);
    expect(isIngredientHeading('## Dough')).toBe(true);
    expect(isIngredientHeading('2 cups flour')).toBe(false);
    expect(isIngredientHeading('salt')).toBe(false);
  });
});
