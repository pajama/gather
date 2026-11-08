/**
 * Gather backups: one JSON file with every collection that belongs to the
 * library (see schema.ts) plus settings. Restoring validates the whole file
 * before anything is replaced.
 */

import type { Settings } from '@/core/model/types';

import { migrateSettings } from './migrations';
import { BACKUP_COLLECTIONS, DEFAULT_SETTINGS, SCHEMA, type Docs } from './schema';

export const BACKUP_FORMAT = 'gather-backup';
export const BACKUP_VERSION = 2;

type BackupCollections = { [K in (typeof BACKUP_COLLECTIONS)[number]]: Docs[K][] };

export type Backup = {
  format: typeof BACKUP_FORMAT;
  /** 1: the first release; 2: adds optional collections such as feeds. */
  version: number;
  exportedAt: string;
  settings: Settings;
} & BackupCollections;

/** Why a file cannot be restored, in words for the person restoring it. */
export class BackupError extends Error {}

/**
 * Validates and upgrades a parsed backup file. Throws BackupError when the
 * file is not a backup, comes from a newer Gather, lacks a collection every
 * backup has, or contains an entry that cannot be read.
 */
export function parseBackup(raw: unknown): Backup {
  if (!raw || typeof raw !== 'object' || (raw as { format?: unknown }).format !== BACKUP_FORMAT) {
    throw new BackupError('That file isn’t a Gather backup.');
  }
  const file = raw as Record<string, unknown>;
  if (typeof file.version === 'number' && file.version > BACKUP_VERSION) {
    throw new BackupError(
      'This backup comes from a newer version of Gather. Update Gather, then restore it.',
    );
  }
  const out: Record<string, unknown> = {};
  for (const name of BACKUP_COLLECTIONS) {
    const spec = SCHEMA[name];
    const value = file[name];
    if (value === undefined && spec.backup === 'optional') {
      out[name] = [];
      continue;
    }
    if (!Array.isArray(value))
      throw new BackupError(`The backup has no ${spec.label}, so it may be damaged. Nothing was changed.`);
    const byId = new Map<string, { id: string }>();
    value.forEach((doc, index) => {
      try {
        const migrated = spec.migrate(doc) as { id: string };
        byId.set(migrated.id, migrated);
      } catch (error) {
        const reason = error instanceof Error ? ` (${error.message})` : '';
        throw new BackupError(
          `Entry ${index + 1} in ${spec.label} can’t be read${reason}. Nothing was changed.`,
        );
      }
    });
    out[name] = [...byId.values()];
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : new Date().toISOString(),
    settings: migrateSettings(file.settings, DEFAULT_SETTINGS),
    ...(out as BackupCollections),
  };
}
