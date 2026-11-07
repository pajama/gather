import { MemoryStore, type DocumentStore } from './document-store';
import { IndexedDBStore } from './indexeddb-store';

/** The web persists to IndexedDB; private browsing modes without it fall back to memory. */
export async function openStore(): Promise<DocumentStore> {
  if (typeof indexedDB === 'undefined') return new MemoryStore();
  try {
    return await IndexedDBStore.open();
  } catch {
    return new MemoryStore();
  }
}
