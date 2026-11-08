/**
 * The platform-neutral result of importing a recipe from any source (web
 * page, pasted text, file). The app maps it into its own Recipe model, so
 * importers never depend on storage.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

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
  /** 1-5 stars when the source app kept ratings. */
  rating?: number;
  difficulty?: Difficulty;
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

/** An address that is safe to open: http(s) only (never javascript:, data: or file:). */
export function safeLink(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : undefined;
}

/** An image address Gather can show: http(s), an embedded image, or a bundled sample. */
export function safeImageUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) ||
    /^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed) ||
    /^asset:\/\/seed\/[\w-]+$/.test(trimmed)
    ? trimmed
    : undefined;
}

type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const amount = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;
const texts = (v: unknown): string[] => (Array.isArray(v) ? v.map(text).filter((s): s is string => !!s) : []);

function sections(value: unknown): DraftSection[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isObject)
    .map((s) => ({ ...(text(s.title) ? { title: text(s.title)! } : {}), lines: texts(s.lines) }))
    .filter((s) => s.lines.length > 0);
}

/**
 * Turns anything an importer produced, or a file claimed, into a well-formed
 * draft: every field has the right type, links are http(s) only, images are
 * ones Gather can show. Every reader's output goes through it before saving.
 */
export function normalizeDraft(raw: unknown): RecipeDraft {
  const r: Loose = isObject(raw) ? raw : {};
  const draft = emptyDraft(text(r.name) ?? 'Untitled recipe');
  const optionalText = ['description', 'sourceName', 'author', 'yieldText', 'notes'] as const;
  for (const key of optionalText) {
    const value = text(r[key]);
    if (value) draft[key] = value;
  }
  const sourceUrl = safeLink(r.sourceUrl);
  if (sourceUrl) draft.sourceUrl = sourceUrl;
  for (const key of ['servings', 'prepSeconds', 'cookSeconds', 'totalSeconds'] as const) {
    const value = amount(r[key]);
    if (value !== undefined) draft[key] = value;
  }
  draft.imageUrls = (Array.isArray(r.imageUrls) ? r.imageUrls : [])
    .map(safeImageUrl)
    .filter((u): u is string => !!u);
  draft.ingredients = sections(r.ingredients);
  draft.steps = sections(r.steps);
  draft.tags = texts(r.tags);
  draft.categories = texts(r.categories);
  draft.cuisines = texts(r.cuisines);
  const rating = amount(r.rating);
  if (rating !== undefined && rating >= 1) draft.rating = Math.min(5, Math.round(rating));
  if (DIFFICULTIES.includes(r.difficulty as Difficulty)) draft.difficulty = r.difficulty as Difficulty;
  if (isObject(r.nutrition)) {
    const nutrition: Partial<Record<NutritionKey, string>> = {};
    for (const key of NUTRITION_KEYS) {
      const value = text(r.nutrition[key]);
      if (value) nutrition[key] = value;
    }
    if (Object.keys(nutrition).length) draft.nutrition = nutrition;
  }
  return draft;
}
