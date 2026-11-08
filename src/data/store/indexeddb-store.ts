import type { DocumentStore, StoredDocument } from './document-store';

const DOCS = 'documents';
const META = 'meta';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

interface DocRow {
  collection: string;
  id: string;
  json: string;
}

/** Browser storage: IndexedDB, which holds far more than localStorage (photos included). */
export class IndexedDBStore implements DocumentStore {
  readonly kind = 'indexeddb';
  // Other tabs of the same app share the database; each write tells them what changed.
  private readonly channel: BroadcastChannel | null;

  private constructor(
    private readonly db: IDBDatabase,
    name: string,
  ) {
    this.channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(`${name}-changes`);
  }

  private announce(collections: string[], meta: string[] = []): void {
    try {
      this.channel?.postMessage({ collections, meta });
    } catch {
      // A closed channel (page unloading) has no one left to tell.
    }
  }

  onExternalChange(listener: (change: { collections: string[]; meta: string[] }) => void): () => void {
    const channel = this.channel;
    if (!channel) return () => undefined;
    const handler = (event: MessageEvent) => {
      const data = event.data as { collections?: unknown; meta?: unknown };
      listener({
        collections: Array.isArray(data?.collections) ? data.collections.filter((c): c is string => typeof c === 'string') : [],
        meta: Array.isArray(data?.meta) ? data.meta.filter((m): m is string => typeof m === 'string') : [],
      });
    };
    channel.addEventListener('message', handler);
    return () => channel.removeEventListener('message', handler);
  }

  static async open(name = 'gather'): Promise<IndexedDBStore> {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DOCS)) {
        const store = db.createObjectStore(DOCS, { keyPath: ['collection', 'id'] });
        store.createIndex('collection', 'collection');
      }
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    return new IndexedDBStore(await request(req), name);
  }

  async loadAll(collection: string): Promise<StoredDocument[]> {
    const tx = this.db.transaction(DOCS, 'readonly');
    const rows = await request(tx.objectStore(DOCS).index('collection').getAll(collection) as IDBRequest<DocRow[]>);
    return rows.map(({ id, json }) => ({ id, json }));
  }

  async putMany(collection: string, docs: StoredDocument[]): Promise<void> {
    if (docs.length === 0) return;
    const tx = this.db.transaction(DOCS, 'readwrite');
    const store = tx.objectStore(DOCS);
    for (const doc of docs) store.put({ collection, id: doc.id, json: doc.json } satisfies DocRow);
    await done(tx);
    this.announce([collection]);
  }

  async deleteMany(collection: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const tx = this.db.transaction(DOCS, 'readwrite');
    const store = tx.objectStore(DOCS);
    for (const id of ids) store.delete([collection, id]);
    await done(tx);
    this.announce([collection]);
  }

  clear(collection: string): Promise<void> {
    return this.replaceCollections({ [collection]: [] });
  }

  /** One readwrite transaction: IndexedDB rolls all of it back if any request fails. */
  async replaceCollections(contents: Record<string, StoredDocument[]>): Promise<void> {
    const tx = this.db.transaction(DOCS, 'readwrite');
    const store = tx.objectStore(DOCS);
    const index = store.index('collection');
    for (const [collection, docs] of Object.entries(contents)) {
      const keys = index.getAllKeys(collection);
      keys.onsuccess = () => {
        for (const key of keys.result) store.delete(key);
        for (const doc of docs) store.put({ collection, id: doc.id, json: doc.json } satisfies DocRow);
      };
    }
    await done(tx);
    this.announce(Object.keys(contents));
  }

  async getMeta(key: string): Promise<string | null> {
    const tx = this.db.transaction(META, 'readonly');
    const value = await request(tx.objectStore(META).get(key) as IDBRequest<string | undefined>);
    return value ?? null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    const tx = this.db.transaction(META, 'readwrite');
    tx.objectStore(META).put(value, key);
    await done(tx);
    this.announce([], [key]);
  }

  async close(): Promise<void> {
    this.channel?.close();
    this.db.close();
  }
}
