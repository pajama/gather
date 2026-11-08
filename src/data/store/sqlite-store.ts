import * as SQLite from 'expo-sqlite';

import type { DocumentStore, StoredDocument } from './document-store';
import { SerialQueue } from './serial';

/**
 * Device storage: one SQLite table of JSON documents, keyed by collection and id.
 * Every operation goes through one queue, because transactions on the shared
 * connection must not overlap (see serial.ts).
 */
export class SQLiteStore implements DocumentStore {
  readonly kind = 'sqlite';
  private readonly queue = new SerialQueue();

  private constructor(private readonly db: SQLite.SQLiteDatabase) {}

  static async open(name = 'gather.db'): Promise<SQLiteStore> {
    const db = await SQLite.openDatabaseAsync(name);
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS documents (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY (collection, id)
      );
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    `);
    return new SQLiteStore(db);
  }

  loadAll(collection: string): Promise<StoredDocument[]> {
    return this.queue.run(() => this.db.getAllAsync<StoredDocument>('SELECT id, json FROM documents WHERE collection = ?', collection));
  }

  putMany(collection: string, docs: StoredDocument[]): Promise<void> {
    if (docs.length === 0) return Promise.resolve();
    return this.queue.run(() =>
      this.db.withTransactionAsync(async () => {
        const insert = await this.db.prepareAsync(
          'INSERT INTO documents (collection, id, json) VALUES (?, ?, ?) ON CONFLICT(collection, id) DO UPDATE SET json = excluded.json',
        );
        try {
          for (const doc of docs) await insert.executeAsync(collection, doc.id, doc.json);
        } finally {
          await insert.finalizeAsync();
        }
      }),
    );
  }

  deleteMany(collection: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return Promise.resolve();
    return this.queue.run(() =>
      this.db.withTransactionAsync(async () => {
        for (const id of ids) await this.db.runAsync('DELETE FROM documents WHERE collection = ? AND id = ?', collection, id);
      }),
    );
  }

  async clear(collection: string): Promise<void> {
    await this.queue.run(() => this.db.runAsync('DELETE FROM documents WHERE collection = ?', collection));
  }

  getMeta(key: string): Promise<string | null> {
    return this.queue.run(async () => {
      const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key);
      return row?.value ?? null;
    });
  }

  async setMeta(key: string, value: string): Promise<void> {
    await this.queue.run(() =>
      this.db.runAsync('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value),
    );
  }

  close(): Promise<void> {
    return this.queue.run(() => this.db.closeAsync());
  }
}
