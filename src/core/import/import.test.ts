import { describe, expect, it } from 'vitest';

import { decodeEntities, htmlToText } from './html';
import { parseRecipeText } from './text';
import { extractRecipesFromHtml, splitInstructionText } from './web';

const JSONLD_PAGE = `<!doctype html><html><head>
<title>Best Banana Bread | Example Kitchen</title>
<meta property="og:site_name" content="Example Kitchen">
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
  {"@type":"WebSite","name":"Example Kitchen"},
  {"@type":["Recipe","NewsArticle"],"name":"Best Banana Bread &amp; Butter",
   "description":"<p>Moist and easy.</p>",
   "image":[{"@type":"ImageObject","url":"/img/bread.jpg"},"https://cdn.example.com/bread-2.jpg"],
   "author":{"@type":"Person","name":"Sam Cook"},
   "recipeYield":["8","1 loaf"],
   "prepTime":"PT15M","cookTime":"PT1H",
   "recipeIngredient":["3 ripe bananas","1/3 cup melted butter","¾ cup sugar"],
   "recipeInstructions":[
     {"@type":"HowToSection","name":"Batter","itemListElement":[
        {"@type":"HowToStep","text":"Mash the bananas."},
        {"@type":"HowToStep","text":"Stir in butter &amp; sugar."}]},
     {"@type":"HowToSection","name":"Bake","itemListElement":[
        {"@type":"HowToStep","text":"Bake for 60 minutes."}]}],
   "nutrition":{"@type":"NutritionInformation","calories":"240 kcal"},
   "keywords":"banana, bread, easy",
   "recipeCategory":"Breakfast","recipeCuisine":["American"]}
]}
</script></head><body></body></html>`;

describe('web import', () => {
  it('extracts a JSON-LD recipe from @graph', () => {
    const [recipe] = extractRecipesFromHtml(JSONLD_PAGE, 'https://example.com/banana-bread');
    expect(recipe).toBeDefined();
    expect(recipe!.name).toBe('Best Banana Bread & Butter');
    expect(recipe!.description).toBe('Moist and easy.');
    expect(recipe!.imageUrls).toEqual(['https://example.com/img/bread.jpg', 'https://cdn.example.com/bread-2.jpg']);
    expect(recipe!.author).toBe('Sam Cook');
    expect(recipe!.sourceName).toBe('Example Kitchen');
    expect(recipe!.servings).toBe(8);
    expect(recipe!.yieldText).toBe('1 loaf');
    expect(recipe!.prepSeconds).toBe(900);
    expect(recipe!.cookSeconds).toBe(3600);
    expect(recipe!.totalSeconds).toBe(4500);
    expect(recipe!.ingredients).toEqual([{ lines: ['3 ripe bananas', '1/3 cup melted butter', '¾ cup sugar'] }]);
    expect(recipe!.steps).toEqual([
      { title: 'Batter', lines: ['Mash the bananas.', 'Stir in butter & sugar.'] },
      { title: 'Bake', lines: ['Bake for 60 minutes.'] },
    ]);
    expect(recipe!.nutrition).toEqual({ calories: '240 kcal' });
    expect(recipe!.tags).toEqual(['banana', 'bread', 'easy']);
    expect(recipe!.categories).toEqual(['Breakfast']);
    expect(recipe!.cuisines).toEqual(['American']);
  });

  it('tolerates invalid JSON with raw newlines', () => {
    const page = `<script type="application/ld+json">{"@type":"Recipe","name":"Soup","recipeIngredient":["1 onion"],
      "recipeInstructions":"Chop the onion.
Simmer 20 minutes."}</script>`;
    const [recipe] = extractRecipesFromHtml(page);
    expect(recipe!.name).toBe('Soup');
    expect(recipe!.ingredients[0]!.lines).toEqual(['1 onion']);
  });

  it('falls back to microdata', () => {
    const page = `<div itemscope itemtype="https://schema.org/Recipe">
      <h1 itemprop="name">Pancakes</h1>
      <meta itemprop="prepTime" content="PT10M">
      <li itemprop="recipeIngredient">1 cup flour</li>
      <li itemprop="recipeIngredient">1 egg</li>
      <div itemprop="recipeInstructions"><p>Mix.</p><p>Fry 2 minutes per side.</p></div>
    </div>`;
    const [recipe] = extractRecipesFromHtml(page, 'https://pancakes.example.org/p');
    expect(recipe!.name).toBe('Pancakes');
    expect(recipe!.ingredients[0]!.lines).toEqual(['1 cup flour', '1 egg']);
    expect(recipe!.steps[0]!.lines).toEqual(['Mix.', 'Fry 2 minutes per side.']);
    expect(recipe!.prepSeconds).toBe(600);
    expect(recipe!.sourceName).toBe('pancakes.example.org');
  });

  it('splits inline numbered instructions', () => {
    expect(splitInstructionText('1. Preheat oven. 2. Mix everything. 3. Bake.')).toEqual([
      'Preheat oven.',
      'Mix everything.',
      'Bake.',
    ]);
  });

  it('decodes HTML', () => {
    expect(decodeEntities('Fish &amp; Chips &#8211; &frac12; &#x2F;')).toBe('Fish & Chips – ½ /');
    expect(htmlToText('<ul><li>One</li><li>Two</li></ul>')).toBe('One\nTwo');
  });
});

describe('text import', () => {
  it('uses section markers', () => {
    const draft = parseRecipeText(`Grandma's Scones
Serves 8
Prep time: 15 minutes

Ingredients
2 cups flour
For the glaze:
1 cup icing sugar

Method
1. Rub the butter into the flour.
2. Bake for 12 minutes.

Notes
Best eaten warm.`);
    expect(draft.name).toBe("Grandma's Scones");
    expect(draft.servings).toBe(8);
    expect(draft.prepSeconds).toBe(900);
    expect(draft.ingredients).toEqual([
      { lines: ['2 cups flour'] },
      { title: 'For the glaze', lines: ['1 cup icing sugar'] },
    ]);
    expect(draft.steps).toEqual([{ lines: ['Rub the butter into the flour.', 'Bake for 12 minutes.'] }]);
    expect(draft.notes).toBe('Best eaten warm.');
  });

  it('classifies lines without markers', () => {
    const draft = parseRecipeText(`Quick Salsa
2 tomatoes, diced
1/2 red onion
Combine everything in a bowl and season generously with salt and lime juice to taste.`);
    expect(draft.name).toBe('Quick Salsa');
    expect(draft.ingredients[0]!.lines).toEqual(['2 tomatoes, diced', '1/2 red onion']);
    expect(draft.steps[0]!.lines).toHaveLength(1);
  });
});
