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
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
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

  async getMeta(key: string): Promise<string | null> {
    return this.meta.get(key) ?? null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    this.meta.set(key, value);
  }
}
