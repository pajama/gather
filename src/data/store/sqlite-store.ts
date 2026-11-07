import * as SQLite from 'expo-sqlite';

import type { DocumentStore, StoredDocument } from './document-store';

/** Device storage: one SQLite table of JSON documents, keyed by collection and id. */
export class SQLiteStore implements DocumentStore {
  readonly kind = 'sqlite';

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

  async loadAll(collection: string): Promise<StoredDocument[]> {
    return this.db.getAllAsync<StoredDocument>('SELECT id, json FROM documents WHERE collection = ?', collection);
  }

  async putMany(collection: string, docs: StoredDocument[]): Promise<void> {
    if (docs.length === 0) return;
    await this.db.withTransactionAsync(async () => {
      for (const doc of docs) {
        await this.db.runAsync(
          'INSERT INTO documents (collection, id, json) VALUES (?, ?, ?) ON CONFLICT(collection, id) DO UPDATE SET json = excluded.json',
          collection,
          doc.id,
          doc.json,
        );
      }
    });
  }

  async deleteMany(collection: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db.withTransactionAsync(async () => {
      for (const id of ids) await this.db.runAsync('DELETE FROM documents WHERE collection = ? AND id = ?', collection, id);
    });
  }

  async clear(collection: string): Promise<void> {
    await this.db.runAsync('DELETE FROM documents WHERE collection = ?', collection);
  }

  async getMeta(key: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key);
    return row?.value ?? null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      value,
    );
  }

  async close(): Promise<void> {
    await this.db.closeAsync();
  }
}
