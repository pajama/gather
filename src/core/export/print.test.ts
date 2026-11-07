import { describe, expect, it } from 'vitest';

import { parseRecipeText } from '../import/text';
import { recipeFromDraft } from '../model/recipe';
import { recipeToHtml } from './print';

describe('recipeToHtml', () => {
  const recipe = recipeFromDraft(
    parseRecipeText(`Toast <Deluxe>
Serves 2
Ingredients
2 slices bread
1 tbsp butter
Method
1. Toast the bread for 3 minutes.
2. Butter it.`),
    { sourceName: 'Home & Co', notes: 'Use good butter.' },
  );

  it('renders scaled, escaped content', () => {
    const html = recipeToHtml(recipe, { scale: 2 });
    expect(html).toContain('<h1>Toast &lt;Deluxe&gt;</h1>');
    expect(html).toContain('Serves 4');
    expect(html).toContain('<strong>4 slices</strong> bread');
    expect(html).toContain('<strong>2 tbsp</strong> butter');
    expect(html).toContain('<li>Toast the bread for 3 minutes.</li>');
    expect(html).toContain('Home &amp; Co');
    expect(html).toContain('Use good butter.');
  });

  it('omits notes and image when asked', () => {
    const html = recipeToHtml(recipe, { includeNotes: false });
    expect(html).not.toContain('Use good butter.');
    expect(html).not.toContain('<img');
  });
});
