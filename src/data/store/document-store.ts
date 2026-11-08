/**
 * Storage engine boundary. Every entity is a JSON document in a named
 * collection; engines (SQLite on device, IndexedDB on the web, memory in
 * tests) implement this interface and nothing else knows which one runs.
 */

export interface StoredDocument {
  id: string;
  json: string;
}

export interface DocumentStore {
  readonly kind: string;
  loadAll(collection: string): Promise<StoredDocument[]>;
  putMany(collection: string, docs: StoredDocument[]): Promise<void>;
  deleteMany(collection: string, ids: string[]): Promise<void>;
  clear(collection: string): Promise<void>;
  /**
   * Replaces the whole contents of each named collection, all or nothing: if
   * any write fails, every collection keeps its previous documents.
   */
  replaceCollections(contents: Record<string, StoredDocument[]>): Promise<void>;
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
  /**
   * Calls back when another process (another browser tab) changed stored
   * collections or meta keys, so this one can reload them. Engines with a
   * single writer (SQLite in the app, memory) don't implement it.
   */
  onExternalChange?(listener: (change: { collections: string[]; meta: string[] }) => void): () => void;
  close?(): Promise<void>;
}

export class MemoryStore implements DocumentStore {
  readonly kind = 'memory';
  private collections = new Map<string, Map<string, string>>();
  private meta = new Map<string, string>();

  private bucket(name: string): Map<string, string> {
    let bucket = this.collections.get(name);
    if (!bucket) {
      bucket = new Map();
      this.collections.set(name, bucket);
    }
    return bucket;
  }

  async loadAll(collection: string): Promise<StoredDocument[]> {
    return [...this.bucket(collection)].map(([id, json]) => ({ id, json }));
  }

  async putMany(collection: string, docs: StoredDocument[]): Promise<void> {
    const bucket = this.bucket(collection);
    for (const doc of docs) bucket.set(doc.id, doc.json);
  }

  async deleteMany(collection: string, ids: string[]): Promise<void> {
    const bucket = this.bucket(collection);
    for (const id of ids) bucket.delete(id);
  }

  async clear(collection: string): Promise<void> {
    this.collections.delete(collection);
  }

  async replaceCollections(contents: Record<string, StoredDocument[]>): Promise<void> {
    // Build every bucket first so a bad document cannot leave a partial result.
    const next = Object.entries(contents).map(([name, docs]) => {
      const bucket = new Map<string, string>();
      for (const doc of docs) {
        if (typeof doc.id !== 'string' || typeof doc.json !== 'string') throw new TypeError(`Invalid document in ${name}`);
        bucket.set(doc.id, doc.json);
      }
      return [name, bucket] as const;
    });
    for (const [name, bucket] of next) this.collections.set(name, bucket);
  }

  async getMeta(key: string): Promise<string | null> {
    return this.meta.get(key) ?? null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    this.meta.set(key, value);
  }
}
