import { describe, expect, it } from 'vitest';

import { ingredientsToText, minutesFieldToSeconds, stepsToText, textToIngredients, textToSteps } from './editing';

describe('editor text round-trip', () => {
  it('parses sections and lines', () => {
    const sections = textToIngredients('2 cups flour\n1 tsp salt\n\nFor the glaze:\n1 cup icing sugar\n');
    expect(sections.map((s) => [s.title, s.items.map((i) => i.text)])).toEqual([
      [undefined, ['2 cups flour', '1 tsp salt']],
      ['For the glaze', ['1 cup icing sugar']],
    ]);
    expect(ingredientsToText(sections)).toBe('2 cups flour\n1 tsp salt\n\nFor the glaze:\n1 cup icing sugar');
  });

  it('reuses ids for unchanged lines', () => {
    const first = textToIngredients('2 cups flour\n1 tsp salt');
    const second = textToIngredients('2 cups flour\n1 tsp salt\n1 egg', first);
    expect(second[0]!.items[0]!.id).toBe(first[0]!.items[0]!.id);
    expect(second[0]!.items[1]!.id).toBe(first[0]!.items[1]!.id);
    expect(second[0]!.items[2]!.id).not.toBe(first[0]!.items[1]!.id);
  });

  it('strips step numbers', () => {
    const steps = textToSteps('1. Mix.\n2) Bake 20 minutes.\nStep 3: Cool.');
    expect(stepsToText(steps)).toBe('Mix.\nBake 20 minutes.\nCool.');
  });

  it('parses minute fields', () => {
    expect(minutesFieldToSeconds('15')).toBe(900);
    expect(minutesFieldToSeconds('1:30')).toBe(5400);
    expect(minutesFieldToSeconds('')).toBeUndefined();
    expect(minutesFieldToSeconds('abc')).toBeUndefined();
  });
});
