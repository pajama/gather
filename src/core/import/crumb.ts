/**
 * Crouton's `.crumb` recipe files.
 *
 * A `.crumb` file is one recipe as JSON. Crouton's export format is
 * documented by several open-source importers; the fields Gather relies on:
 *
 *   name, notes, webLink, sourceName, serves, rating (1-5), rawDifficulty,
 *   duration (prep, minutes), cookingDuration (minutes), neutritionalInfo
 *   ("Key: value" lines, Crouton's spelling), tags, images (base64 JPEG),
 *   steps [{ order, step, isSection }],
 *   ingredients [{ order, ingredient: { name }, quantity: { amount,
 *   secondaryAmount, quantityType } }] where quantityType SECTION marks a
 *   heading whose title is the ingredient name.
 *
 * Gather reads these so a Crouton library can move over, and writes them so
 * recipes can go back.
 */

import { strToU8, zipSync } from 'fflate';

import { parseIngredient } from '../recipe/ingredients';
import { formatNumber, parseQuantity } from '../recipe/quantity';
import { getUnit, unitLabel } from '../recipe/units';
import { emptyDraft, type DraftSection, type NutritionKey, type RecipeDraft } from './draft';

export interface CrumbQuantity {
  amount?: number;
  secondaryAmount?: number;
  quantityType?: string;
}

export interface CrumbIngredient {
  order?: number;
  uuid?: string;
  ingredient?: { name?: string; uuid?: string };
  quantity?: CrumbQuantity;
}

export interface CrumbStep {
  order?: number;
  uuid?: string;
  step?: string;
  isSection?: boolean;
}

export interface CrumbRecipe {
  uuid?: string;
  name?: string;
  notes?: string;
  webLink?: string;
  sourceName?: string;
  serves?: number;
  rating?: number;
  rawDifficulty?: string;
  duration?: number;
  cookingDuration?: number;
  defaultScale?: number;
  neutritionalInfo?: string;
  tags?: string[];
  folderIDs?: string[];
  images?: string[];
  sourceImage?: string;
  isPublicRecipe?: boolean;
  steps?: CrumbStep[];
  ingredients?: CrumbIngredient[];
}

/** Crouton's quantity types with the unit text Gather writes for them (singular, plural). */
export const CRUMB_UNITS: Record<string, readonly [string, string]> = {
  ITEM: ['', ''],
  TEASPOON: ['tsp', 'tsp'],
  TABLESPOON: ['tbsp', 'tbsp'],
  CUP: ['cup', 'cups'],
  OUNCE: ['oz', 'oz'],
  POUND: ['lb', 'lb'],
  GRAMS: ['g', 'g'],
  KGS: ['kg', 'kg'],
  MILLS: ['ml', 'ml'],
  CENTILITER: ['cl', 'cl'],
  LITRES: ['l', 'l'],
  PINCH: ['pinch', 'pinches'],
  BUNCH: ['bunch', 'bunches'],
  CAN: ['can', 'cans'],
  BOTTLE: ['bottle', 'bottles'],
  PACKET: ['packet', 'packets'],
};

/** Gather unit ids (see units.ts) to Crouton quantity types, for export. */
const UNIT_TO_CRUMB: Record<string, string> = {
  tsp: 'TEASPOON',
  tbsp: 'TABLESPOON',
  cup: 'CUP',
  oz: 'OUNCE',
  lb: 'POUND',
  g: 'GRAMS',
  kg: 'KGS',
  ml: 'MILLS',
  cl: 'CENTILITER',
  l: 'LITRES',
  pinch: 'PINCH',
  bunch: 'BUNCH',
  can: 'CAN',
  bottle: 'BOTTLE',
  package: 'PACKET',
};

const NUTRITION_LABELS: [RegExp, NutritionKey][] = [
  [/^serving/i, 'servingSize'],
  [/^(calories|energy|kcal)/i, 'calories'],
  [/^sat(urated)?\s*fat/i, 'saturatedFatContent'],
  [/^trans\s*fat/i, 'transFatContent'],
  [/^(total\s*)?fat/i, 'fatContent'],
  [/^cholesterol/i, 'cholesterolContent'],
  [/^(sodium|salt)/i, 'sodiumContent'],
  [/^(total\s*)?carb/i, 'carbohydrateContent'],
  [/^(dietary\s*)?fib(er|re)/i, 'fiberContent'],
  [/^sugar/i, 'sugarContent'],
  [/^protein/i, 'proteinContent'],
];

/** True when parsed JSON looks like a Crouton recipe rather than another app's. */
export function isCrumb(value: unknown): value is CrumbRecipe {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.name !== 'string') return false;
  const ingredients = Array.isArray(v.ingredients) ? v.ingredients : [];
  const first = ingredients[0] as Record<string, unknown> | undefined;
  const crumbIngredient = !!first && typeof first === 'object' && ('quantity' in first || 'ingredient' in first);
  return crumbIngredient || 'cookingDuration' in v || 'neutritionalInfo' in v || 'webLink' in v || 'serves' in v;
}

function amountText(q: CrumbQuantity | undefined): string {
  if (!q?.amount || q.amount <= 0) return '';
  const low = formatNumber(q.amount);
  if (q.secondaryAmount && q.secondaryAmount > q.amount) return `${low}-${formatNumber(q.secondaryAmount)}`;
  return low;
}

/** "2 lb chicken cutlets" from a Crouton ingredient entry. */
export function crumbIngredientLine(entry: CrumbIngredient): string {
  const name = (entry.ingredient?.name ?? '').trim();
  const amount = amountText(entry.quantity);
  const type = (entry.quantity?.quantityType ?? 'ITEM').toUpperCase();
  const plural = (entry.quantity?.secondaryAmount ?? entry.quantity?.amount ?? 0) > 1;
  const unit = amount ? (CRUMB_UNITS[type]?.[plural ? 1 : 0] ?? '') : '';
  return [amount, unit, name].filter(Boolean).join(' ');
}

function byOrder<T extends { order?: number }>(items: T[] | undefined): T[] {
  return [...(items ?? [])].map((item, index) => ({ item, index })).sort((a, b) => (a.item.order ?? a.index) - (b.item.order ?? b.index) || a.index - b.index).map((x) => x.item);
}

function parseNutrition(text: string | undefined): { nutrition: Partial<Record<NutritionKey, string>>; extra: string[] } {
  const nutrition: Partial<Record<NutritionKey, string>> = {};
  const extra: string[] = [];
  for (const raw of (text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = /^([^:]+):\s*(.+)$/.exec(line);
    const key = match ? NUTRITION_LABELS.find(([re]) => re.test(match[1]!.trim()))?.[1] : undefined;
    if (match && key && !nutrition[key]) nutrition[key] = match[2]!.trim();
    else extra.push(line);
  }
  return { nutrition, extra };
}

export function draftFromCrumb(crumb: CrumbRecipe): RecipeDraft {
  const draft = emptyDraft((crumb.name ?? '').trim() || 'Untitled recipe');

  const ingredients: DraftSection[] = [];
  let current: DraftSection = { lines: [] };
  for (const entry of byOrder(crumb.ingredients)) {
    if ((entry.quantity?.quantityType ?? '').toUpperCase() === 'SECTION') {
      if (current.lines.length || current.title) ingredients.push(current);
      current = { lines: [], ...(entry.ingredient?.name?.trim() ? { title: entry.ingredient.name.trim() } : {}) };
      continue;
    }
    const line = crumbIngredientLine(entry);
    if (line) current.lines.push(line);
  }
  if (current.lines.length) ingredients.push(current);
  draft.ingredients = ingredients.filter((s) => s.lines.length);

  const steps: DraftSection[] = [];
  let section: DraftSection = { lines: [] };
  for (const step of byOrder(crumb.steps)) {
    const text = (step.step ?? '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (step.isSection) {
      if (section.lines.length || section.title) steps.push(section);
      section = { title: text, lines: [] };
    } else section.lines.push(text);
  }
  if (section.lines.length) steps.push(section);
  draft.steps = steps.filter((s) => s.lines.length);

  if (crumb.webLink?.trim()) draft.sourceUrl = crumb.webLink.trim();
  if (crumb.sourceName?.trim()) draft.sourceName = crumb.sourceName.trim();
  if (crumb.serves && crumb.serves > 0) draft.servings = crumb.serves;
  if (crumb.duration && crumb.duration > 0) draft.prepSeconds = Math.round(crumb.duration * 60);
  if (crumb.cookingDuration && crumb.cookingDuration > 0) draft.cookSeconds = Math.round(crumb.cookingDuration * 60);
  if (crumb.rating && crumb.rating > 0) draft.rating = Math.min(5, Math.round(crumb.rating));
  const difficulty = crumb.rawDifficulty?.trim().toLowerCase();
  if (difficulty === 'easy' || difficulty === 'medium') draft.difficulty = difficulty;
  else if (difficulty === 'hard' || difficulty === 'difficult') draft.difficulty = 'hard';
  draft.tags = (crumb.tags ?? []).map((t) => String(t).trim()).filter(Boolean);
  draft.imageUrls = (crumb.images ?? []).filter((img) => typeof img === 'string' && img.length > 32).map((img) => (img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`));

  const { nutrition, extra } = parseNutrition(crumb.neutritionalInfo);
  if (Object.keys(nutrition).length) draft.nutrition = nutrition;
  const notes = [crumb.notes?.trim(), extra.length ? `Nutrition: ${extra.join(', ')}` : undefined].filter(Boolean);
  if (notes.length) draft.notes = notes.join('\n\n');
  return draft;
}

const NUTRITION_EXPORT: [NutritionKey, string][] = [
  ['servingSize', 'Serving size'],
  ['calories', 'Calories'],
  ['fatContent', 'Fat'],
  ['saturatedFatContent', 'Saturated fat'],
  ['transFatContent', 'Trans fat'],
  ['cholesterolContent', 'Cholesterol'],
  ['sodiumContent', 'Sodium'],
  ['carbohydrateContent', 'Carbohydrates'],
  ['fiberContent', 'Fiber'],
  ['sugarContent', 'Sugar'],
  ['proteinContent', 'Protein'],
];

/** Writes a draft as a `.crumb` object. `uuid` supplies ids (Crouton uses upper-case UUIDs). */
export function crumbFromDraft(draft: RecipeDraft, uuid: () => string): CrumbRecipe {
  const ingredients: CrumbIngredient[] = [];
  for (const section of draft.ingredients) {
    if (section.title) ingredients.push({ order: ingredients.length, uuid: uuid(), ingredient: { name: section.title, uuid: uuid() }, quantity: { quantityType: 'SECTION', amount: 0 } });
    for (const line of section.lines) {
      const parsed = parseIngredient(line);
      const type = parsed.unit ? UNIT_TO_CRUMB[parsed.unit] : 'ITEM';
      const quantity: CrumbQuantity = { quantityType: type ?? 'ITEM', amount: parsed.quantity?.value ?? 0 };
      if (parsed.quantity?.max !== undefined) quantity.secondaryAmount = parsed.quantity.max;
      // Units Crouton has no type for stay in the name ("2 cloves garlic").
      const unitDef = parsed.unit && !type ? getUnit(parsed.unit) : undefined;
      const unitWord = unitDef ? `${unitLabel(unitDef, (parsed.quantity?.max ?? parsed.quantity?.value ?? 0) > 1, 'long')} ` : '';
      const size = parsed.size ? `${parsed.size} ` : '';
      const note = parsed.note ? `, ${parsed.note}` : '';
      const name = parsed.quantity ? `${unitWord}${size}${parsed.name}${note}`.trim() : line;
      ingredients.push({ order: ingredients.length, uuid: uuid(), ingredient: { name, uuid: uuid() }, quantity });
    }
  }
  const steps: CrumbStep[] = [];
  for (const section of draft.steps) {
    if (section.title) steps.push({ order: steps.length, uuid: uuid(), step: section.title, isSection: true });
    for (const line of section.lines) steps.push({ order: steps.length, uuid: uuid(), step: line, isSection: false });
  }
  const nutrition = NUTRITION_EXPORT.filter(([key]) => draft.nutrition?.[key]).map(([key, label]) => `${label}: ${draft.nutrition![key]}`);
  const images = draft.imageUrls.map((url) => /^data:image\/[a-z]+;base64,(.*)$/i.exec(url)?.[1]).filter((b): b is string => !!b);
  return {
    uuid: uuid(),
    name: draft.name,
    ingredients,
    steps,
    images,
    tags: draft.tags,
    folderIDs: [],
    serves: draft.servings ?? 0,
    duration: Math.round((draft.prepSeconds ?? 0) / 60),
    cookingDuration: Math.round((draft.cookSeconds ?? 0) / 60),
    defaultScale: 1,
    isPublicRecipe: false,
    ...(draft.sourceUrl ? { webLink: draft.sourceUrl } : {}),
    ...(draft.sourceName ? { sourceName: draft.sourceName } : {}),
    ...(draft.notes ? { notes: draft.notes } : {}),
    ...(draft.rating ? { rating: draft.rating } : {}),
    ...(draft.difficulty ? { rawDifficulty: draft.difficulty } : {}),
    ...(nutrition.length ? { neutritionalInfo: nutrition.join('\n') } : {}),
  };
}

/** Reads the quantity Crouton would store for an amount string ("1-2" -> 1 and 2). */
export function crumbQuantityFromText(text: string): CrumbQuantity | undefined {
  const q = parseQuantity(text);
  if (!q) return undefined;
  return { amount: q.value, ...(q.max !== undefined ? { secondaryAmount: q.max } : {}) };
}

/** A zip of one `.crumb` per recipe, named after the recipes. */
export function crumbArchive(drafts: readonly RecipeDraft[], uuid: () => string): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const used = new Set<string>();
  for (const draft of drafts) {
    const base = draft.name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Recipe';
    let name = `${base}.crumb`;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base} ${n}.crumb`;
    used.add(name.toLowerCase());
    files[name] = strToU8(JSON.stringify(crumbFromDraft(draft, uuid)));
  }
  return zipSync(files, { level: 6 });
}
