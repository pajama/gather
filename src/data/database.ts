/**
 * The app's data model at runtime: one reactive collection per entity plus
 * the settings document. Domain operations live in the repositories; this
 * file only wires storage, migrations and first-run seeding.
 */

import { DEFAULT_AISLE_ORDER } from '@/core/grocery/aisles';
import type { Folder, GroceryItem, GroceryList, MealPlanEntry, Recipe, Settings } from '@/core/model/types';

import { Collection, Singleton } from './collection';
import { migrateRecipe } from './migrations';
import { FoldersRepository } from './repositories/folders';
import { GroceriesRepository } from './repositories/groceries';
import { PlannerRepository } from './repositories/planner';
import { RecipesRepository } from './repositories/recipes';
import type { DocumentStore } from './store/document-store';

export const DEFAULT_SETTINGS: Settings = {
  accent: 'tomato',
  theme: 'system',
  units: 'original',
  keepAwake: true,
  weekStartsOn: 0,
  plannerSlots: ['breakfast', 'lunch', 'dinner'],
  aisleOrder: [...DEFAULT_AISLE_ORDER],
};

export interface Collections {
  recipes: Collection<Recipe>;
  folders: Collection<Folder>;
  plan: Collection<MealPlanEntry>;
  groceries: Collection<GroceryItem>;
  lists: Collection<GroceryList>;
  settings: Singleton<Settings>;
}

export class Database {
  readonly collections: Collections;
  readonly recipes: RecipesRepository;
  readonly folders: FoldersRepository;
  readonly planner: PlannerRepository;
  readonly groceries: GroceriesRepository;

  private constructor(
    readonly store: DocumentStore,
    onError: (error: unknown) => void,
  ) {
    this.collections = {
      recipes: new Collection<Recipe>(store, 'recipes', { migrate: migrateRecipe, onError }),
      folders: new Collection<Folder>(store, 'folders', { onError }),
      plan: new Collection<MealPlanEntry>(store, 'plan', { onError }),
      groceries: new Collection<GroceryItem>(store, 'groceries', { onError }),
      lists: new Collection<GroceryList>(store, 'lists', { onError }),
      settings: new Singleton<Settings>(store, 'settings', DEFAULT_SETTINGS, onError),
    };
    this.recipes = new RecipesRepository(this.collections);
    this.folders = new FoldersRepository(this.collections);
    this.planner = new PlannerRepository(this.collections);
    this.groceries = new GroceriesRepository(this.collections);
  }

  static async open(
    store: DocumentStore,
    options: { seed?: (db: Database) => void | Promise<void>; onError?: (error: unknown) => void } = {},
  ): Promise<Database> {
    const db = new Database(store, options.onError ?? ((e) => console.warn('[gather] storage error', e)));
    const c = db.collections;
    await Promise.all([c.recipes.load(), c.folders.load(), c.plan.load(), c.groceries.load(), c.lists.load(), c.settings.load()]);
    if ((await store.getMeta('seeded')) === null) {
      await options.seed?.(db);
      await store.setMeta('seeded', new Date().toISOString());
    }
    db.groceries.ensureDefaultList();
    return db;
  }

  get settings(): Settings {
    return this.collections.settings.get();
  }

  updateSettings(patch: Partial<Settings>): void {
    this.collections.settings.set(patch);
  }

  /** Waits for all pending writes (tests, backups, app backgrounding). */
  async flush(): Promise<void> {
    const c = this.collections;
    await Promise.all([c.recipes.flush(), c.folders.flush(), c.plan.flush(), c.groceries.flush(), c.lists.flush(), c.settings.flush()]);
  }

  /** Everything, as one JSON-serializable backup. */
  exportBackup(): Backup {
    const c = this.collections;
    return {
      format: 'gather-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      recipes: [...c.recipes.all()],
      folders: [...c.folders.all()],
      plan: [...c.plan.all()],
      groceries: [...c.groceries.all()],
      lists: [...c.lists.all()],
      settings: c.settings.get(),
    };
  }

  restoreBackup(backup: Backup): void {
    if (backup.format !== 'gather-backup') throw new Error('Not a Gather backup');
    const c = this.collections;
    c.recipes.replaceAll(backup.recipes.map(migrateRecipe));
    c.folders.replaceAll(backup.folders);
    c.plan.replaceAll(backup.plan);
    c.groceries.replaceAll(backup.groceries);
    c.lists.replaceAll(backup.lists);
    c.settings.set(backup.settings);
    this.groceries.ensureDefaultList();
  }
}

export interface Backup {
  format: 'gather-backup';
  version: 1;
  exportedAt: string;
  recipes: Recipe[];
  folders: Folder[];
  plan: MealPlanEntry[];
  groceries: GroceryItem[];
  lists: GroceryList[];
  settings: Settings;
}
