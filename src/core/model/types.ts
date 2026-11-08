/**
 * Gather's domain model. Plain serializable data: every entity is a JSON
 * document with a string id and ISO timestamps, so storage adapters and a
 * future sync engine can treat them uniformly.
 */

import type { Difficulty } from '../import/draft';
import type { FeedItem } from '../import/feed';

export type { Difficulty };

export type ID = string;
/** ISO 8601 timestamp. */
export type Timestamp = string;
/** Calendar day, "YYYY-MM-DD", in the user's local time zone. */
export type DayKey = string;

export interface Entity {
  id: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RecipeImage {
  id: ID;
  /** file://, https://, data: or blob: URI. */
  uri: string;
  width?: number;
  height?: number;
}

export interface Ingredient {
  id: ID;
  /** The line as the user wrote it ("1½ cups flour, sifted"). Parsed on read. */
  text: string;
}

export interface IngredientSection {
  id: ID;
  /** Heading for a group ("For the sauce"); undefined for the default group. */
  title?: string;
  items: Ingredient[];
}

export interface Step {
  id: ID;
  text: string;
  imageUri?: string;
}

export interface StepSection {
  id: ID;
  title?: string;
  items: Step[];
}

export interface Nutrition {
  servingSize?: string;
  calories?: string;
  fat?: string;
  saturatedFat?: string;
  carbohydrates?: string;
  fiber?: string;
  sugar?: string;
  protein?: string;
  cholesterol?: string;
  sodium?: string;
}

export interface Recipe extends Entity {
  name: string;
  description?: string;
  sourceUrl?: string;
  /** Website, book or person the recipe came from. */
  sourceName?: string;
  author?: string;
  /** First image is the cover. */
  images: RecipeImage[];
  /** Servings the amounts are written for; scaling is relative to this. */
  servings?: number;
  yieldText?: string;
  prepSeconds?: number;
  cookSeconds?: number;
  /** Explicit total; when absent the total is prep + cook. */
  totalSeconds?: number;
  ingredients: IngredientSection[];
  steps: StepSection[];
  notes?: string;
  nutrition?: Nutrition;
  /** Free-form labels: course, cuisine, diet. */
  tags: string[];
  folderIds: ID[];
  favorite: boolean;
  /** 0-5 stars; undefined when unrated. */
  rating?: number;
  difficulty?: Difficulty;
  lastCookedAt?: Timestamp;
  cookCount: number;
}

export interface Folder extends Entity {
  name: string;
  /** Icon name from the app icon set. */
  icon?: string;
  color?: string;
  sortIndex: number;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEAL_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export interface MealPlanEntry extends Entity {
  day: DayKey;
  slot: MealSlot;
  /** A planned recipe, or a free-text entry ("Leftovers", "Dinner out"). */
  recipeId?: ID;
  title?: string;
  /** Servings to cook; defaults to the recipe's servings. */
  servings?: number;
  sortIndex: number;
}

export interface GroceryItem extends Entity {
  listId: ID;
  /** The line as shown ("2 cups milk"). */
  text: string;
  /** Normalized ingredient name used for merging and aisle lookup. */
  name: string;
  /** Aisle id from the grocery categories. */
  aisle: string;
  checked: boolean;
  /** Recipes this item was added from. */
  recipeIds: ID[];
  sortIndex: number;
}

export interface GroceryList extends Entity {
  name: string;
  sortIndex: number;
}

/** A followed recipe feed (RSS/Atom) with its latest posts cached for offline reading. */
export interface Feed extends Entity {
  url: string;
  title: string;
  siteUrl?: string;
  items: FeedItem[];
  lastFetchedAt?: Timestamp;
  /** Last refresh failure, shown on the feed until the next success. */
  error?: string;
}

export type UnitPreference = 'original' | 'us' | 'metric';
export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  /** Accent color id from the theme palette. */
  accent: string;
  theme: ThemePreference;
  units: UnitPreference;
  /** Keep the screen awake while viewing a recipe or cooking. */
  keepAwake: boolean;
  /** Meal slots shown in the planner. */
  plannerSlots: MealSlot[];
  /** Grocery aisles in shopping order. */
  aisleOrder: string[];
}
