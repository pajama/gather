import { gzipSync, strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { linesToSections, readRecipeFile, toGatherFile } from './files';

const paprika = {
  name: 'Paprika Chili',
  description: 'Hearty.',
  ingredients: '1 lb beef\n1 onion, diced\n\nToppings:\nSour cream',
  directions: '1. Brown the beef.\n\n2. Simmer 30 minutes.',
  notes: 'Better tomorrow.',
  nutritional_info: '400 kcal',
  servings: '6 bowls',
  prep_time: '15 mins',
  cook_time: '1 hr',
  source: 'Grandma',
  source_url: 'https://example.com/chili',
  photo_data: 'AAAA',
  categories: ['Dinner', 'Comfort'],
  rating: 4,
};

describe('recipe files', () => {
  it('splits sections', () => {
    expect(linesToSections('a\nFor the glaze:\nb')).toEqual([{ lines: ['a'] }, { title: 'For the glaze', lines: ['b'] }]);
  });

  it('reads a Paprika archive', () => {
    const entry = gzipSync(strToU8(JSON.stringify(paprika)));
    const archive = zipSync({ 'Paprika Chili.paprikarecipe': entry, 'broken.paprikarecipe': strToU8('nope') });
    const result = readRecipeFile('export.paprikarecipes', archive);
    expect(result.format).toBe('Paprika');
    expect(result.skipped).toEqual(['broken.paprikarecipe']);
    const [draft] = result.drafts;
    expect(draft).toMatchObject({
      name: 'Paprika Chili',
      description: 'Hearty.',
      servings: 6,
      yieldText: '6 bowls',
      prepSeconds: 900,
      cookSeconds: 3600,
      sourceName: 'Grandma',
      sourceUrl: 'https://example.com/chili',
      imageUrls: ['data:image/jpeg;base64,AAAA'],
      tags: ['Dinner', 'Comfort'],
      rating: 4,
    });
    expect(draft!.ingredients).toEqual([{ lines: ['1 lb beef', '1 onion, diced'] }, { title: 'Toppings', lines: ['Sour cream'] }]);
    expect(draft!.steps).toEqual([{ lines: ['Brown the beef.', 'Simmer 30 minutes.'] }]);
    expect(draft!.notes).toBe('Better tomorrow.\n\nNutrition: 400 kcal');
  });

  it('reads a single gzipped Paprika recipe and Gather files', () => {
    expect(readRecipeFile('one.paprikarecipe', gzipSync(strToU8(JSON.stringify(paprika)))).drafts[0]!.name).toBe('Paprika Chili');
    const gather = readRecipeFile('mine.gather', strToU8(JSON.stringify(toGatherFile([{ name: 'X', imageUrls: [], ingredients: [], steps: [], tags: [], categories: [], cuisines: [] }]))));
    expect(gather).toMatchObject({ format: 'Gather', drafts: [{ name: 'X' }] });
  });

  it('falls back to text and HTML', () => {
    expect(readRecipeFile('note.txt', strToU8('Soup\nIngredients\n1 onion\nMethod\nCook.')).drafts[0]!.name).toBe('Soup');
    const html = '<html><script type="application/ld+json">{"@type":"Recipe","name":"Saved","recipeIngredient":["1 egg"]}</script></html>';
    expect(readRecipeFile('page.html', strToU8(html))).toMatchObject({ format: 'Web page', drafts: [{ name: 'Saved' }] });
  });
});
