/**
 * Upgrades stored documents to the current shape and rejects ones that cannot
 * be used. Every collection has a migration (see schema.ts): it runs when a
 * collection loads and on every document in a backup being restored, so old
 * or hand-edited data never reaches a repository half-formed.
 */

import { aisleFor } from '@/core/grocery/aisles';
import { groceryName } from '@/core/grocery/merge';
import { newId, now } from '@/core/model/recipe';
import {
  MEAL_SLOTS,
  type Feed,
  type Folder,
  type GroceryItem,
  type GroceryList,
  type MealPlanEntry,
  type MealSlot,
  type Recipe,
  type Settings,
} from '@/core/model/types';
import { parseIngredient } from '@/core/recipe/ingredients';
import type { KitchenTimer } from '@/core/timers/timers';

/** A document that cannot be salvaged (not an object, or missing what defines it). */
export class InvalidDocumentError extends Error {}

type Raw = Record<string, unknown>;

function record(raw: unknown, kind: string): Raw {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new InvalidDocumentError(`A ${kind} is not an object.`);
  return raw as Raw;
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isObject = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isString) : []);

function entity(r: Raw): { id: string; createdAt: string; updatedAt: string } {
  const createdAt = isString(r.createdAt) ? r.createdAt : now();
  return { id: isString(r.id) && r.id ? r.id : newId(), createdAt, updatedAt: isString(r.updatedAt) ? r.updatedAt : createdAt };
}

/** Sections of { id, title?, items: [{ id, text }] }, dropping malformed entries. */
function sections<T extends { id: string; text: string }>(value: unknown): { id: string; title?: string; items: T[] }[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isObject).map((s) => ({
    ...s,
    id: isString(s.id) && s.id ? s.id : newId(),
    ...(isString(s.title) && s.title ? { title: s.title } : {}),
    items: (Array.isArray(s.items) ? s.items : [])
      .filter((i): i is Raw => isObject(i) && isString(i.text))
      .map((i) => ({ ...i, id: isString(i.id) && i.id ? i.id : newId() }) as unknown as T),
  }));
}

export function migrateRecipe(raw: unknown): Recipe {
  const r = record(raw, 'recipe');
  const recipe: Recipe = {
    ...(r as Partial<Recipe>),
    ...entity(r),
    name: isString(r.name) && r.name.trim() ? r.name : 'Untitled recipe',
    images: (Array.isArray(r.images) ? r.images : [])
      .filter((i): i is Raw => isObject(i) && isString(i.uri))
      .map((i) => ({ ...i, id: isString(i.id) && i.id ? i.id : newId(), uri: i.uri as string })),
    ingredients: sections(r.ingredients),
    steps: sections(r.steps),
    tags: strings(r.tags),
    folderIds: strings(r.folderIds),
    favorite: r.favorite === true,
    cookCount: finite(r.cookCount) && r.cookCount >= 0 ? Math.floor(r.cookCount) : 0,
  };
  for (const key of ['servings', 'prepSeconds', 'cookSeconds', 'totalSeconds', 'rating'] as const) {
    if (recipe[key] !== undefined && !finite(recipe[key])) delete recipe[key];
  }
  return recipe;
}

export function migrateFolder(raw: unknown): Folder {
  const r = record(raw, 'folder');
  const folder: Folder = {
    ...(r as Partial<Folder>),
    ...entity(r),
    name: isString(r.name) && r.name.trim() ? r.name : 'Folder',
    sortIndex: finite(r.sortIndex) ? r.sortIndex : 0,
  };
  if (r.tags !== undefined) folder.tags = strings(r.tags);
  if (r.tagMatch !== 'all' && r.tagMatch !== 'any') delete folder.tagMatch;
  return folder;
}

export function migratePlanEntry(raw: unknown): MealPlanEntry {
  const r = record(raw, 'meal plan entry');
  if (!isString(r.day) || !/^\d{4}-\d{2}-\d{2}$/.test(r.day)) throw new InvalidDocumentError('A meal plan entry has no day.');
  if (!isString(r.recipeId) && !isString(r.title)) throw new InvalidDocumentError('A meal plan entry has neither a recipe nor a title.');
  const entry: MealPlanEntry = {
    ...(r as Partial<MealPlanEntry>),
    ...entity(r),
    day: r.day,
    slot: MEAL_SLOTS.includes(r.slot as MealSlot) ? (r.slot as MealSlot) : 'dinner',
    sortIndex: finite(r.sortIndex) ? r.sortIndex : 0,
  };
  if (entry.servings !== undefined && !finite(entry.servings)) delete entry.servings;
  return entry;
}

export function migrateGroceryItem(raw: unknown): GroceryItem {
  const r = record(raw, 'grocery item');
  if (!isString(r.text) || !r.text.trim()) throw new InvalidDocumentError('A grocery item has no text.');
  const name = isString(r.name) && r.name ? r.name : groceryName(parseIngredient(r.text));
  return {
    ...(r as Partial<GroceryItem>),
    ...entity(r),
    listId: isString(r.listId) && r.listId ? r.listId : 'default',
    text: r.text,
    name,
    aisle: isString(r.aisle) && r.aisle ? r.aisle : aisleFor(name),
    checked: r.checked === true,
    recipeIds: strings(r.recipeIds),
    sortIndex: finite(r.sortIndex) ? r.sortIndex : 0,
  };
}

export function migrateGroceryList(raw: unknown): GroceryList {
  const r = record(raw, 'grocery list');
  return { ...(r as Partial<GroceryList>), ...entity(r), name: isString(r.name) && r.name ? r.name : 'Groceries', sortIndex: finite(r.sortIndex) ? r.sortIndex : 0 };
}

export function migrateFeed(raw: unknown): Feed {
  const r = record(raw, 'feed');
  if (!isString(r.url) || !r.url) throw new InvalidDocumentError('A feed has no address.');
  return {
    ...(r as Partial<Feed>),
    ...entity(r),
    url: r.url,
    title: isString(r.title) && r.title ? r.title : r.url,
    items: (Array.isArray(r.items) ? r.items : []).filter(
      (i): i is Feed['items'][number] => isObject(i) && isString(i.id) && isString(i.title) && isString(i.link),
    ),
  };
}

export function migrateTimer(raw: unknown): KitchenTimer {
  const r = record(raw, 'timer');
  if (!isString(r.id) || !finite(r.totalSeconds) || (r.state !== 'running' && r.state !== 'paused')) {
    throw new InvalidDocumentError('A timer is incomplete.');
  }
  return {
    ...(r as Partial<KitchenTimer>),
    id: r.id,
    label: isString(r.label) ? r.label : 'Timer',
    totalSeconds: r.totalSeconds,
    state: r.state,
    createdAt: finite(r.createdAt) ? r.createdAt : Date.now(),
  } as KitchenTimer;
}

/** Keeps only settings values of the right type; anything else falls back to the default. */
export function migrateSettings(raw: unknown, defaults: Settings): Settings {
  if (!isObject(raw)) return defaults;
  const out: Settings = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof Settings)[]) {
    const value = raw[key];
    if (value === undefined) continue;
    const expected = defaults[key];
    if (Array.isArray(expected) ? Array.isArray(value) : typeof value === typeof expected) {
      (out as unknown as Raw)[key] = value;
    }
  }
  if (isObject(raw.tagColors)) out.tagColors = Object.fromEntries(Object.entries(raw.tagColors).filter(([, v]) => isString(v))) as Record<string, string>;
  out.plannerSlots = out.plannerSlots.filter((s) => MEAL_SLOTS.includes(s));
  if (out.plannerSlots.length === 0) out.plannerSlots = defaults.plannerSlots;
  return out;
}
