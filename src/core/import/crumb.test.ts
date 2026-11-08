import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { crumbFromDraft, crumbIngredientLine, draftFromCrumb, isCrumb, type CrumbRecipe } from './crumb';
import { readRecipeFile } from './files';

// A hand-written recipe in Crouton's export shape (not taken from any real export).
const CRUMB: CrumbRecipe = {
  uuid: 'B3C1F2AA-0000-4000-8000-000000000001',
  name: 'Lemon Ricotta Pancakes',
  serves: 4,
  duration: 10,
  cookingDuration: 15,
  rating: 4,
  rawDifficulty: 'Easy',
  webLink: 'https://example.com/lemon-ricotta-pancakes',
  sourceName: 'Example Kitchen',
  notes: 'Keep warm in a low oven.',
  neutritionalInfo: 'Calories: 420\nSugar: 9g\nProtein: 14g\nVitamin C: 10%',
  tags: ['Breakfast', ' Weekend '],
  folderIDs: ['F0LDER-1'],
  images: ['/9j/' + 'A'.repeat(60)],
  ingredients: [
    { order: 3, ingredient: { name: 'ricotta' }, quantity: { amount: 1, quantityType: 'CUP' } },
    { order: 0, ingredient: { name: 'Batter' }, quantity: { amount: 0, quantityType: 'SECTION' } },
    { order: 1, ingredient: { name: 'flour' }, quantity: { amount: 1.5, quantityType: 'CUP' } },
    { order: 2, ingredient: { name: 'eggs' }, quantity: { amount: 2, quantityType: 'ITEM' } },
    { order: 4, ingredient: { name: 'To serve' }, quantity: { quantityType: 'SECTION' } },
    { order: 5, ingredient: { name: 'maple syrup' }, quantity: { amount: 2, secondaryAmount: 3, quantityType: 'TABLESPOON' } },
    { order: 6, ingredient: { name: 'flaky salt' }, quantity: { amount: 1, quantityType: 'PINCH' } },
    { order: 7, ingredient: { name: 'butter, for the pan' }, quantity: { amount: 0, quantityType: 'ITEM' } },
  ],
  steps: [
    { order: 0, step: 'Make the batter', isSection: true },
    { order: 1, step: 'Whisk the flour, eggs and ricotta.', isSection: false },
    { order: 2, step: '  Rest for 5 minutes. ', isSection: false },
    { order: 3, step: 'Cook', isSection: true },
    { order: 4, step: 'Fry in butter for 2 minutes a side.', isSection: false },
  ],
};

describe('Crouton .crumb import', () => {
  it('recognizes Crouton recipes and not other JSON', () => {
    expect(isCrumb(CRUMB)).toBe(true);
    expect(isCrumb({ name: 'Paprika', ingredients: '1 cup flour', directions: 'Mix' })).toBe(false);
    expect(isCrumb({ format: 'gather-recipes', recipes: [] })).toBe(false);
    expect(isCrumb([CRUMB])).toBe(false);
  });

  it('writes ingredient lines with amounts, ranges and plural units', () => {
    expect(crumbIngredientLine({ ingredient: { name: 'flour' }, quantity: { amount: 1.5, quantityType: 'CUP' } })).toBe('1½ cups flour');
    expect(crumbIngredientLine({ ingredient: { name: 'maple syrup' }, quantity: { amount: 2, secondaryAmount: 3, quantityType: 'TABLESPOON' } })).toBe(
      '2-3 tbsp maple syrup',
    );
    expect(crumbIngredientLine({ ingredient: { name: 'eggs' }, quantity: { amount: 2, quantityType: 'ITEM' } })).toBe('2 eggs');
    expect(crumbIngredientLine({ ingredient: { name: 'salt' }, quantity: { amount: 0, quantityType: 'TEASPOON' } })).toBe('salt');
    expect(crumbIngredientLine({ ingredient: { name: 'tomatoes' }, quantity: { amount: 2, quantityType: 'CAN' } })).toBe('2 cans tomatoes');
  });

  it('maps every field into a draft', () => {
    const draft = draftFromCrumb(CRUMB);
    expect(draft.name).toBe('Lemon Ricotta Pancakes');
    expect(draft.ingredients).toEqual([
      { title: 'Batter', lines: ['1½ cups flour', '2 eggs', '1 cup ricotta'] },
      { title: 'To serve', lines: ['2-3 tbsp maple syrup', '1 pinch flaky salt', 'butter, for the pan'] },
    ]);
    expect(draft.steps).toEqual([
      { title: 'Make the batter', lines: ['Whisk the flour, eggs and ricotta.', 'Rest for 5 minutes.'] },
      { title: 'Cook', lines: ['Fry in butter for 2 minutes a side.'] },
    ]);
    expect(draft.servings).toBe(4);
    expect(draft.prepSeconds).toBe(600);
    expect(draft.cookSeconds).toBe(900);
    expect(draft.rating).toBe(4);
    expect(draft.difficulty).toBe('easy');
    expect(draft.sourceUrl).toBe('https://example.com/lemon-ricotta-pancakes');
    expect(draft.sourceName).toBe('Example Kitchen');
    expect(draft.tags).toEqual(['Breakfast', 'Weekend']);
    expect(draft.nutrition).toEqual({ calories: '420', sugarContent: '9g', proteinContent: '14g' });
    expect(draft.notes).toBe('Keep warm in a low oven.\n\nNutrition: Vitamin C: 10%');
    expect(draft.imageUrls[0]).toMatch(/^data:image\/jpeg;base64,\/9j\//);
  });

  it('survives a Gather -> Crouton -> Gather round trip', () => {
    let n = 0;
    const uuid = () => `UUID-${++n}`;
    const draft = draftFromCrumb(CRUMB);
    const crumb = crumbFromDraft(draft, uuid);
    expect(crumb.ingredients?.[0]).toMatchObject({ quantity: { quantityType: 'SECTION' }, ingredient: { name: 'Batter' } });
    expect(crumb.ingredients?.find((i) => i.ingredient?.name === 'maple syrup')?.quantity).toEqual({ quantityType: 'TABLESPOON', amount: 2, secondaryAmount: 3 });
    expect(crumb.neutritionalInfo).toBe('Calories: 420\nSugar: 9g\nProtein: 14g');
    expect(crumb.rawDifficulty).toBe('easy');
    expect(crumb.duration).toBe(10);
    expect(crumb.images?.[0]).toBe('/9j/' + 'A'.repeat(60));

    const again = draftFromCrumb(JSON.parse(JSON.stringify(crumb)) as CrumbRecipe);
    expect(again.ingredients).toEqual(draft.ingredients);
    expect(again.steps).toEqual(draft.steps);
    expect(again.servings).toBe(draft.servings);
    expect(again.rating).toBe(draft.rating);
  });

  it('keeps units Crouton has no type for in the ingredient name', () => {
    const crumb = crumbFromDraft({ ...draftFromCrumb(CRUMB), ingredients: [{ lines: ['3 cloves garlic, minced', 'salt to taste'] }] }, () => 'X');
    expect(crumb.ingredients?.map((i) => [i.quantity?.quantityType, i.quantity?.amount, i.ingredient?.name])).toEqual([
      ['ITEM', 3, 'cloves garlic, minced'],
      ['ITEM', 0, 'salt to taste'],
    ]);
  });

  it('reads .crumb files and zips of them through readRecipeFile', () => {
    const single = readRecipeFile('pancakes.crumb', strToU8(JSON.stringify(CRUMB)));
    expect(single.format).toBe('Crouton');
    expect(single.drafts[0]?.name).toBe('Lemon Ricotta Pancakes');

    const zip = zipSync({
      'Export/pancakes.crumb': strToU8(JSON.stringify(CRUMB)),
      'Export/toast.crumb': strToU8(JSON.stringify({ ...CRUMB, name: 'Toast' })),
      'Export/._toast.crumb': strToU8('junk'),
      'Export/broken.crumb': strToU8('{not json'),
    });
    const many = readRecipeFile('Crouton Export.zip', zip);
    expect(many.format).toBe('Crouton');
    expect(many.drafts.map((d) => d.name).sort()).toEqual(['Lemon Ricotta Pancakes', 'Toast']);
    expect(many.skipped).toEqual(['Export/broken.crumb']);
  });
});
