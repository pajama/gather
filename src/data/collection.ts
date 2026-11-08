/**
 * A reactive, write-through cache of one document collection.
 *
 * Reads are synchronous from memory (the whole collection is loaded at
 * startup), so screens render instantly. Writes update memory, notify
 * subscribers, then persist in order on a per-collection queue.
 */

import type { DocumentStore } from './store/document-store';

export type Listener = () => void;

export interface Identified {
  id: string;
}

export class Collection<T extends Identified> {
  private items = new Map<string, T>();
  private listeners = new Set<Listener>();
  private snapshot: readonly T[] | null = null;
  private queue: Promise<void> = Promise.resolve();
  private loaded = false;

  constructor(
    private readonly store: DocumentStore,
    readonly name: string,
    private readonly options: {
      /** Upgrades documents written by older versions of the app. */
      migrate?: (raw: unknown) => T;
      onError?: (error: unknown) => void;
    } = {},
  ) {}

  async load(): Promise<void> {
    const docs = await this.store.loadAll(this.name);
    this.items.clear();
    for (const doc of docs) {
      try {
        const raw = JSON.parse(doc.json) as unknown;
        const item = this.options.migrate ? this.options.migrate(raw) : (raw as T);
        this.items.set(doc.id, item);
      } catch (error) {
        this.options.onError?.(error);
      }
    }
    this.loaded = true;
    this.emit();
  }

  /** Reloads from storage after this collection's own pending writes (another tab changed it). */
  async reload(): Promise<void> {
    await this.queue;
    await this.load();
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  get size(): number {
    return this.items.size;
  }

  get(id: string | undefined): T | undefined {
    return id ? this.items.get(id) : undefined;
  }

  /** Stable array reference until the collection changes (safe for useSyncExternalStore). */
  all(): readonly T[] {
    if (!this.snapshot) this.snapshot = [...this.items.values()];
    return this.snapshot;
  }

  upsert(...items: T[]): void {
    if (items.length === 0) return;
    for (const item of items) this.items.set(item.id, item);
    this.emit();
    this.persist(() =>
      this.store.putMany(
        this.name,
        items.map((item) => ({ id: item.id, json: JSON.stringify(item) })),
      ),
    );
  }

  /** Applies `change` to an existing item; returns the updated item. */
  update(id: string, change: Partial<T> | ((current: T) => T)): T | undefined {
    const current = this.items.get(id);
    if (!current) return undefined;
    const next = typeof change === 'function' ? change(current) : { ...current, ...change };
    this.upsert(next);
    return next;
  }

  remove(...ids: string[]): void {
    const present = ids.filter((id) => this.items.delete(id));
    if (present.length === 0) return;
    this.emit();
    this.persist(() => this.store.deleteMany(this.name, present));
  }

  /** Replaces the whole collection, atomically in storage. */
  replaceAll(items: T[]): void {
    this.replaceLocal(items);
    this.persist(() =>
      this.store.replaceCollections({
        [this.name]: items.map((item) => ({ id: item.id, json: JSON.stringify(item) })),
      }),
    );
  }

  /** Swaps the in-memory contents without writing (after the caller has already persisted them). */
  replaceLocal(items: T[]): void {
    this.items = new Map(items.map((item) => [item.id, item]));
    this.emit();
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Resolves when every queued write has reached storage. */
  flush(): Promise<void> {
    return this.queue;
  }

  private emit(): void {
    this.snapshot = null;
    for (const listener of this.listeners) listener();
  }

  private persist(write: () => Promise<void>): void {
    this.queue = this.queue.then(write).catch((error: unknown) => this.options.onError?.(error));
  }
}

/** A single settings-like document stored in the meta table. */
export class Singleton<T extends object> {
  private value: T;
  private listeners = new Set<Listener>();
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: DocumentStore,
    private readonly key: string,
    private readonly defaults: T,
    private readonly onError?: (error: unknown) => void,
    /** Cleans up a stored value (wrong types, missing keys); defaults to merging over the defaults. */
    private readonly migrate: (raw: unknown) => T = (raw) => ({ ...defaults, ...(raw as Partial<T>) }),
  ) {
    this.value = defaults;
  }

  async load(): Promise<void> {
    const raw = await this.store.getMeta(this.key);
    if (raw) {
      try {
        this.value = this.migrate(JSON.parse(raw));
      } catch (error) {
        this.onError?.(error);
      }
    }
    this.emit();
  }

  get(): T {
    return this.value;
  }

  set(patch: Partial<T>): void {
    this.value = { ...this.value, ...patch };
    this.emit();
    const json = JSON.stringify(this.value);
    this.queue = this.queue
      .then(() => this.store.setMeta(this.key, json))
      .catch((e: unknown) => this.onError?.(e));
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  flush(): Promise<void> {
    return this.queue;
  }

  /** Reloads from storage after pending writes (another tab changed it). */
  async reload(): Promise<void> {
    await this.queue;
    await this.load();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
