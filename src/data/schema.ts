/**
 * The one list of stored collections. The database, loading, flushing,
 * backups and restore are all derived from it, so adding an entity means
 * adding one line here (plus its type and migration), not editing every
 * place that enumerates collections.
 */

import { DEFAULT_AISLE_ORDER } from '@/core/grocery/aisles';
import type {
  Feed,
  Folder,
  GroceryItem,
  GroceryList,
  MealPlanEntry,
  Recipe,
  Settings,
} from '@/core/model/types';
import type { KitchenTimer } from '@/core/timers/timers';

import {
  migrateFeed,
  migrateFolder,
  migrateGroceryItem,
  migrateGroceryList,
  migratePlanEntry,
  migrateRecipe,
  migrateTimer,
} from './migrations';

/** The document type stored in each collection. */
export interface Docs {
  recipes: Recipe;
  folders: Folder;
  plan: MealPlanEntry;
  groceries: GroceryItem;
  lists: GroceryList;
  feeds: Feed;
  timers: KitchenTimer;
}

export type CollectionName = keyof Docs;

export interface CollectionSpec<T> {
  /** Upgrades a stored or restored document; throws InvalidDocumentError for one that cannot be used. */
  migrate: (raw: unknown) => T;
  /**
   * How backups treat the collection: `required` (every backup has it),
   * `optional` (added after backups shipped; older files lack it) or `none`
   * (device state, such as running timers, that a backup should not carry).
   */
  backup: 'required' | 'optional' | 'none';
  /** Human name for messages ("meal plan"). */
  label: string;
}

export const SCHEMA: { [K in CollectionName]: CollectionSpec<Docs[K]> } = {
  recipes: { migrate: migrateRecipe, backup: 'required', label: 'recipes' },
  folders: { migrate: migrateFolder, backup: 'required', label: 'folders' },
  plan: { migrate: migratePlanEntry, backup: 'required', label: 'meal plan' },
  groceries: { migrate: migrateGroceryItem, backup: 'required', label: 'groceries' },
  lists: { migrate: migrateGroceryList, backup: 'required', label: 'grocery lists' },
  feeds: { migrate: migrateFeed, backup: 'optional', label: 'feeds' },
  timers: { migrate: migrateTimer, backup: 'none', label: 'timers' },
};

export const COLLECTION_NAMES = Object.keys(SCHEMA) as CollectionName[];

export const BACKUP_COLLECTIONS = COLLECTION_NAMES.filter((name) => SCHEMA[name].backup !== 'none');

export const DEFAULT_SETTINGS: Settings = {
  accent: 'sky',
  theme: 'system',
  units: 'original',
  keepAwake: true,
  plannerSlots: ['breakfast', 'lunch', 'dinner'],
  aisleOrder: [...DEFAULT_AISLE_ORDER],
};
