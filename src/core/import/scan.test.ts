import { describe, expect, it } from 'vitest';

import { cleanScannedText } from './scan';
import { parseRecipeText } from './text';

// Roughly what OCR returns for a cookbook page: hard line breaks, a hyphenated word, misread 1s.
const OCR = `Tomato Galette

Serves 4

Ingredients
l cup flour
I tbsp sugar
% tsp salt
2 % cups cherry toma-
toes

Method
Mix the flour, sugar and salt in a large bowl, then rub in the
butter until the mixture looks like coarse crumbs and holds
together when pressed.
Roll the dough out, top with the tomatoes and bake for 40 minutes.`;

describe('cleanScannedText', () => {
  it('rejoins hyphenated words and fixes misread amounts', () => {
    const text = cleanScannedText(OCR);
    expect(text).toContain('1 cup flour');
    expect(text).toContain('1 tbsp sugar');
    expect(text).toContain('½ tsp salt');
    expect(text).toContain('2½ cups cherry tomatoes');
  });

  it('reflows sentences broken by the page width but keeps separate lines apart', () => {
    const text = cleanScannedText(OCR);
    expect(text).toContain(
      'Mix the flour, sugar and salt in a large bowl, then rub in the butter until the mixture looks like coarse crumbs and holds together when pressed.',
    );
    expect(text).toContain('\nRoll the dough out, top with the tomatoes and bake for 40 minutes.');
  });

  it('produces text the recipe parser reads', () => {
    const draft = parseRecipeText(cleanScannedText(OCR));
    expect(draft.name).toBe('Tomato Galette');
    expect(draft.servings).toBe(4);
    expect(draft.ingredients.flatMap((s) => s.lines)).toEqual(['1 cup flour', '1 tbsp sugar', '½ tsp salt', '2½ cups cherry tomatoes']);
    expect(draft.steps.flatMap((s) => s.lines)).toHaveLength(2);
  });

  it('drops the blank line OCR puts after every printed line', () => {
    const spaced = 'Toast\n\nServes 2\n\nIngredients\n\n2 slices bread\n\n1 tbsp butter\n\nMethod\n\nToast the bread.\n\nButter it.';
    expect(cleanScannedText(spaced)).toBe('Toast\nServes 2\n\nIngredients\n2 slices bread\n1 tbsp butter\n\nMethod\nToast the bread.\nButter it.');
  });
});
