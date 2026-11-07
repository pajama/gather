import type { DraftSection, RecipeDraft } from '../import/draft';
import { parseIngredient } from '../recipe/ingredients';
import type { ID, Ingredient, IngredientSection, Nutrition, Recipe, Step, StepSection, Timestamp } from './types';

/** RFC 4122 v4 id. Uses the platform's crypto when present. */
export function newId(): ID {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function now(): Timestamp {
  return new Date().toISOString();
}

export function createRecipe(fields: Partial<Recipe> = {}): Recipe {
  const stamp = now();
  return {
    id: newId(),
    createdAt: stamp,
    updatedAt: stamp,
    name: '',
    images: [],
    ingredients: [],
    steps: [],
    tags: [],
    folderIds: [],
    favorite: false,
    cookCount: 0,
    ...fields,
  };
}

export function ingredientSections(sections: DraftSection[]): IngredientSection[] {
  return sections.map((s) => ({
    id: newId(),
    ...(s.title ? { title: s.title } : {}),
    items: s.lines.map((text): Ingredient => ({ id: newId(), text })),
  }));
}

export function stepSections(sections: DraftSection[]): StepSection[] {
  return sections.map((s) => ({
    id: newId(),
    ...(s.title ? { title: s.title } : {}),
    items: s.lines.map((text): Step => ({ id: newId(), text })),
  }));
}

const NUTRITION_MAP: Record<string, keyof Nutrition> = {
  servingSize: 'servingSize',
  calories: 'calories',
  fatContent: 'fat',
  saturatedFatContent: 'saturatedFat',
  carbohydrateContent: 'carbohydrates',
  fiberContent: 'fiber',
  sugarContent: 'sugar',
  proteinContent: 'protein',
  cholesterolContent: 'cholesterol',
  sodiumContent: 'sodium',
};

export function recipeFromDraft(draft: RecipeDraft, extra: Partial<Recipe> = {}): Recipe {
  let nutrition: Nutrition | undefined;
  if (draft.nutrition) {
    nutrition = {};
    for (const [key, value] of Object.entries(draft.nutrition)) {
      const target = NUTRITION_MAP[key];
      if (target && value) nutrition[target] = value;
    }
  }
  const tags = [...new Set([...draft.categories, ...draft.cuisines, ...draft.tags].map((t) => t.trim()).filter(Boolean))];
  return createRecipe({
    name: draft.name.trim() || 'Untitled recipe',
    ...(draft.description ? { description: draft.description } : {}),
    ...(draft.sourceUrl ? { sourceUrl: draft.sourceUrl } : {}),
    ...(draft.sourceName ? { sourceName: draft.sourceName } : {}),
    ...(draft.author ? { author: draft.author } : {}),
    images: draft.imageUrls.slice(0, 8).map((uri) => ({ id: newId(), uri })),
    ...(draft.servings ? { servings: draft.servings } : {}),
    ...(draft.yieldText ? { yieldText: draft.yieldText } : {}),
    ...(draft.prepSeconds ? { prepSeconds: draft.prepSeconds } : {}),
    ...(draft.cookSeconds ? { cookSeconds: draft.cookSeconds } : {}),
    ...(draft.totalSeconds ? { totalSeconds: draft.totalSeconds } : {}),
    ingredients: ingredientSections(draft.ingredients),
    steps: stepSections(draft.steps),
    ...(draft.notes ? { notes: draft.notes } : {}),
    ...(nutrition && Object.keys(nutrition).length ? { nutrition } : {}),
    tags: tags.slice(0, 12),
    ...extra,
  });
}

export function totalSeconds(recipe: Pick<Recipe, 'prepSeconds' | 'cookSeconds' | 'totalSeconds'>): number | undefined {
  if (recipe.totalSeconds) return recipe.totalSeconds;
  const sum = (recipe.prepSeconds ?? 0) + (recipe.cookSeconds ?? 0);
  return sum > 0 ? sum : undefined;
}

export function coverImage(recipe: Pick<Recipe, 'images'>): string | undefined {
  return recipe.images[0]?.uri;
}

export function allIngredients(recipe: Pick<Recipe, 'ingredients'>): Ingredient[] {
  return recipe.ingredients.flatMap((s) => s.items);
}

export function allSteps(recipe: Pick<Recipe, 'steps'>): Step[] {
  return recipe.steps.flatMap((s) => s.items);
}

/** Lower-case text used by search: name, tags, ingredients, source. */
export function searchText(recipe: Recipe): string {
  return [
    recipe.name,
    recipe.description,
    recipe.sourceName,
    recipe.author,
    ...recipe.tags,
    ...allIngredients(recipe).map((i) => parseIngredient(i.text).name),
  ]
    .filter(Boolean)
    .join(' \n ')
    .toLowerCase();
}

/** Plain-text rendering for sharing, copying and printing. */
export function recipeToText(recipe: Recipe): string {
  const lines: string[] = [recipe.name];
  if (recipe.description) lines.push('', recipe.description);
  const meta: string[] = [];
  if (recipe.servings) meta.push(`Serves ${recipe.servings}`);
  if (recipe.sourceUrl) meta.push(recipe.sourceUrl);
  if (meta.length) lines.push('', meta.join(' · '));
  if (recipe.ingredients.length) {
    lines.push('', 'Ingredients');
    for (const section of recipe.ingredients) {
      if (section.title) lines.push('', `${section.title}:`);
      for (const item of section.items) lines.push(`- ${item.text}`);
    }
  }
  if (recipe.steps.length) {
    lines.push('', 'Method');
    let n = 1;
    for (const section of recipe.steps) {
      if (section.title) lines.push('', `${section.title}:`);
      for (const item of section.items) lines.push(`${n++}. ${item.text}`);
    }
  }
  if (recipe.notes) lines.push('', 'Notes', recipe.notes);
  return lines.join('\n');
}
