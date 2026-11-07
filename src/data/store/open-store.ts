import type { DocumentStore } from './document-store';
import { SQLiteStore } from './sqlite-store';

/** Device builds persist to SQLite. (The web build resolves open-store.web.ts instead.) */
export function openStore(): Promise<DocumentStore> {
  return SQLiteStore.open();
}
