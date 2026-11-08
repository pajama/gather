/**
 * React bindings for the database: a provider that opens storage once, and
 * hooks that subscribe screens to exactly the collections they read.
 */

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';

import type { DayKey, Feed, Folder, GroceryItem, ID, MealPlanEntry, Recipe, Settings } from '@/core/model/types';
import type { KitchenTimer } from '@/core/timers/timers';

import type { Collection, Identified, Singleton } from './collection';
import { Database, type StorageHealth } from './database';
import { DEFAULT_LIST_ID } from './repositories/groceries';
import { openStore } from './store/open-store';

const DatabaseContext = createContext<Database | null>(null);

export function DatabaseProvider({
  children,
  seed,
  fallback = null,
  renderError,
  database,
}: {
  children: ReactNode;
  seed?: (db: Database) => void | Promise<void>;
  fallback?: ReactNode;
  /** Shown when storage cannot be opened; `retry` tries again. */
  renderError?: (error: unknown, retry: () => void) => ReactNode;
  /** Inject a database (tests, previews). */
  database?: Database;
}) {
  const [db, setDb] = useState<Database | null>(database ?? null);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (database) return;
    let cancelled = false;
    openStore()
      .then((store) => Database.open(store, seed ? { seed } : {}))
      .then((opened) => {
        if (!cancelled) setDb(opened);
      })
      .catch((error: unknown) => {
        console.error('[gather] could not open storage', error);
        if (!cancelled) setFailure({ error });
      });
    return () => {
      cancelled = true;
    };
  }, [database, seed, attempt]);
  if (!db && failure && renderError) {
    return (
      <>
        {renderError(failure.error, () => {
          setFailure(null);
          setAttempt((n) => n + 1);
        })}
      </>
    );
  }
  if (!db) return <>{fallback}</>;
  return <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>;
}

/** Whether changes are being saved, and the last storage failure. */
export function useStorageHealth(): StorageHealth {
  const db = useDb();
  return useSyncExternalStore(db.health.subscribe, db.health.get, db.health.get);
}

export function useDb(): Database {
  const db = useContext(DatabaseContext);
  if (!db) throw new Error('useDb must be used inside <DatabaseProvider>');
  return db;
}

export function useCollection<T extends Identified>(collection: Collection<T>): readonly T[] {
  return useSyncExternalStore(collection.subscribe, () => collection.all(), () => collection.all());
}

function useSingleton<T extends object>(singleton: Singleton<T>): T {
  return useSyncExternalStore(singleton.subscribe, () => singleton.get(), () => singleton.get());
}

export function useRecipes(): readonly Recipe[] {
  return useCollection(useDb().collections.recipes);
}

export function useRecipe(id: ID | undefined): Recipe | undefined {
  const recipes = useRecipes();
  return useMemo(() => recipes.find((r) => r.id === id), [recipes, id]);
}

export function useFolders(): Folder[] {
  const db = useDb();
  const folders = useCollection(db.collections.folders);
  return useMemo(() => [...folders].sort((a, b) => a.sortIndex - b.sortIndex || a.name.localeCompare(b.name)), [folders]);
}

export function usePlanEntries(days: readonly DayKey[]): MealPlanEntry[] {
  const db = useDb();
  const entries = useCollection(db.collections.plan);
  const key = days.join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => db.planner.entriesFor(days), [entries, key]);
}

export function useAllPlanEntries(): readonly MealPlanEntry[] {
  return useCollection(useDb().collections.plan);
}

export function useGroceryItems(listId: ID = DEFAULT_LIST_ID): GroceryItem[] {
  const db = useDb();
  const items = useCollection(db.collections.groceries);
  return useMemo(() => items.filter((g) => g.listId === listId).sort((a, b) => a.sortIndex - b.sortIndex), [items, listId]);
}

/** Stored kitchen timers (running, paused or finished). */
export function useKitchenTimers(): readonly KitchenTimer[] {
  return useCollection(useDb().collections.timers);
}

export function useFeeds(): readonly Feed[] {
  return useCollection(useDb().collections.feeds);
}

export function useSettings(): Settings {
  return useSingleton(useDb().collections.settings);
}
