/**
 * The platform-neutral result of importing a recipe from any source (web
 * page, pasted text, file). The app maps it into its own Recipe model, so
 * importers never depend on storage.
 */

export interface DraftSection {
  /** Heading for a group ("For the sauce"); undefined for the default group. */
  title?: string;
  lines: string[];
}

export interface RecipeDraft {
  name: string;
  description?: string;
  sourceUrl?: string;
  /** Website or book name ("Serious Eats"). */
  sourceName?: string;
  author?: string;
  imageUrls: string[];
  servings?: number;
  /** Original yield text ("Makes 24 cookies"). */
  yieldText?: string;
  prepSeconds?: number;
  cookSeconds?: number;
  totalSeconds?: number;
  ingredients: DraftSection[];
  steps: DraftSection[];
  notes?: string;
  nutrition?: Partial<Record<NutritionKey, string>>;
  tags: string[];
  categories: string[];
  cuisines: string[];
}

export const NUTRITION_KEYS = [
  'servingSize',
  'calories',
  'fatContent',
  'saturatedFatContent',
  'transFatContent',
  'cholesterolContent',
  'sodiumContent',
  'carbohydrateContent',
  'fiberContent',
  'sugarContent',
  'proteinContent',
] as const;

export type NutritionKey = (typeof NUTRITION_KEYS)[number];

export function emptyDraft(name = ''): RecipeDraft {
  return { name, imageUrls: [], ingredients: [], steps: [], tags: [], categories: [], cuisines: [] };
}

export function draftLineCount(sections: DraftSection[]): number {
  return sections.reduce((n, s) => n + s.lines.length, 0);
}
