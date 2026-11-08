/**
 * The app's data model at runtime: one reactive collection per entity (see
 * schema.ts) plus the settings document. Domain operations live in the
 * repositories; this file wires storage, migrations, first-run seeding,
 * backups and storage health.
 */

import type { Settings } from '@/core/model/types';

import { BACKUP_FORMAT, BACKUP_VERSION, parseBackup, type Backup } from './backup';
import { Collection, Singleton, type Identified } from './collection';
import { migrateSettings } from './migrations';
import { FeedsRepository } from './repositories/feeds';
import { FoldersRepository } from './repositories/folders';
import { GroceriesRepository } from './repositories/groceries';
import { PlannerRepository } from './repositories/planner';
import { RecipesRepository } from './repositories/recipes';
import { TimersRepository } from './repositories/timers';
import { BACKUP_COLLECTIONS, COLLECTION_NAMES, DEFAULT_SETTINGS, SCHEMA, type Docs } from './schema';
import { Signal } from './signal';
import type { DocumentStore } from './store/document-store';

export { DEFAULT_SETTINGS } from './schema';
export type { Backup } from './backup';
export { BackupError } from './backup';

export type Collections = { [K in keyof Docs]: Collection<Docs[K]> } & { settings: Singleton<Settings> };

/** Whether what the user does is being saved. */
export interface StorageHealth {
  /** False when no durable storage is available (for example, a browser that blocks IndexedDB). */
  persistent: boolean;
  /** Message of the most recent failed write or load. */
  lastError?: string;
  /** Increments with every failure, so the UI can show a new one even after dismissing the last. */
  failures: number;
}

/** Where the library is copied before a restore, so the restore can be undone. */
const PRE_RESTORE_KEY = 'backup:before-restore';

export class Database {
  readonly collections: Collections;
  readonly recipes: RecipesRepository;
  readonly folders: FoldersRepository;
  readonly planner: PlannerRepository;
  readonly groceries: GroceriesRepository;
  readonly feeds: FeedsRepository;
  readonly timers: TimersRepository;
  readonly health: Signal<StorageHealth>;

  private constructor(
    readonly store: DocumentStore,
    private readonly onError: (error: unknown) => void,
  ) {
    this.health = new Signal<StorageHealth>({ persistent: store.kind !== 'memory', failures: 0 });
    const report = (error: unknown) => this.reportError(error);
    const collections: Record<string, unknown> = {};
    for (const name of COLLECTION_NAMES) {
      collections[name] = new Collection<Identified>(store, name, { migrate: SCHEMA[name].migrate as (raw: unknown) => Identified, onError: report });
    }
    collections.settings = new Singleton<Settings>(store, 'settings', DEFAULT_SETTINGS, report, (raw) => migrateSettings(raw, DEFAULT_SETTINGS));
    this.collections = collections as Collections;
    this.recipes = new RecipesRepository(this.collections);
    this.folders = new FoldersRepository(this.collections);
    this.planner = new PlannerRepository(this.collections);
    this.groceries = new GroceriesRepository(this.collections);
    this.feeds = new FeedsRepository(this.collections);
    this.timers = new TimersRepository(this.collections);
  }

  static async open(
    store: DocumentStore,
    options: { seed?: (db: Database) => void | Promise<void>; onError?: (error: unknown) => void } = {},
  ): Promise<Database> {
    const db = new Database(store, options.onError ?? ((e) => console.warn('[gather] storage error', e)));
    await Promise.all([...COLLECTION_NAMES.map((name) => db.collections[name].load()), db.collections.settings.load()]);
    if ((await store.getMeta('seeded')) === null) {
      await options.seed?.(db);
      await store.setMeta('seeded', new Date().toISOString());
    }
    db.groceries.ensureDefaultList();
    db.timers.prune();
    // Another browser tab wrote: reload what it changed, so the two don't overwrite each other.
    store.onExternalChange?.(({ collections, meta }) => {
      for (const name of collections) {
        if ((COLLECTION_NAMES as string[]).includes(name)) void db.collections[name as keyof Docs].reload().catch((e: unknown) => db.reportError(e));
      }
      if (meta.includes('settings')) void db.collections.settings.reload().catch((e: unknown) => db.reportError(e));
    });
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
    await Promise.all([...COLLECTION_NAMES.map((name) => this.collections[name].flush()), this.collections.settings.flush()]);
  }

  /** Everything in the library, as one JSON-serializable backup. */
  exportBackup(): Backup {
    const collections = Object.fromEntries(BACKUP_COLLECTIONS.map((name) => [name, [...this.collections[name].all()]]));
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      settings: this.collections.settings.get(),
      ...collections,
    } as Backup;
  }

  /**
   * Replaces the library with a backup. The file is validated first (throws
   * BackupError and changes nothing if it can't be used), the current library
   * is kept for undoRestore(), and storage is replaced in one transaction
   * before the screens see the new data.
   */
  async restoreBackup(raw: unknown, options: { keepUndo?: boolean } = {}): Promise<{ recipes: number }> {
    const backup = parseBackup(raw);
    await this.flush();
    if (options.keepUndo !== false) await this.store.setMeta(PRE_RESTORE_KEY, JSON.stringify(this.exportBackup()));
    const contents = Object.fromEntries(
      BACKUP_COLLECTIONS.map((name) => [name, (backup[name] as Identified[]).map((doc) => ({ id: doc.id, json: JSON.stringify(doc) }))]),
    );
    await this.store.replaceCollections(contents);
    for (const name of BACKUP_COLLECTIONS) (this.collections[name] as Collection<Identified>).replaceLocal(backup[name] as Identified[]);
    this.collections.settings.set(backup.settings);
    this.groceries.ensureDefaultList();
    return { recipes: backup.recipes.length };
  }

  /** Whether a restore can be undone (the library from before it was kept). */
  async canUndoRestore(): Promise<boolean> {
    return !!(await this.store.getMeta(PRE_RESTORE_KEY));
  }

  /** Puts back the library from before the last restore. */
  async undoRestore(): Promise<{ recipes: number }> {
    const saved = await this.store.getMeta(PRE_RESTORE_KEY);
    if (!saved) throw new Error('There is no restore to undo.');
    const result = await this.restoreBackup(JSON.parse(saved), { keepUndo: false });
    await this.store.setMeta(PRE_RESTORE_KEY, '');
    return result;
  }

  /** Every image URI the library refers to, including the library kept for undoing a restore. */
  async imageReferences(): Promise<Set<string>> {
    const uris = new Set<string>();
    for (const recipe of this.collections.recipes.all()) for (const image of recipe.images) uris.add(image.uri);
    const saved = await this.store.getMeta(PRE_RESTORE_KEY);
    if (saved) {
      try {
        const backup = JSON.parse(saved) as { recipes?: { images?: { uri?: unknown }[] }[] };
        for (const recipe of backup.recipes ?? []) for (const image of recipe.images ?? []) if (typeof image.uri === 'string') uris.add(image.uri);
      } catch {
        // An unreadable saved library has nothing worth keeping photos for.
      }
    }
    return uris;
  }

  /** Records a storage failure for the UI, and passes it on. */
  reportError(error: unknown): void {
    const current = this.health.get();
    this.health.set({ ...current, failures: current.failures + 1, lastError: error instanceof Error ? error.message : String(error) });
    this.onError(error);
  }
}
