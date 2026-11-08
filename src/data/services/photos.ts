import { Directory, File, Paths } from 'expo-file-system';

import { newId } from '@/core/model/recipe';

/**
 * Photos the person adds or imports, kept as files in the app's documents
 * folder. Recipes refer to them as `photo://<name>` rather than by absolute
 * path, because the app container path changes on reinstall and restore.
 * (The OS may clear the image picker's cache folder at any time, so picked
 * files are copied here before a recipe points at them.)
 */

const SCHEME = 'photo://';
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
};
const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
};

function folder(): Directory {
  return new Directory(Paths.document, 'photos');
}

export function isStoredPhoto(uri: string): boolean {
  return uri.startsWith(SCHEME);
}

/** A URI an Image can load. Stored photos resolve to their current file path. */
export function photoDisplayUri(uri: string): string {
  return isStoredPhoto(uri) ? new File(folder(), uri.slice(SCHEME.length)).uri : uri;
}

/**
 * Copies a picked image (file:// in the picker's cache) or an embedded one
 * (data: URL from an imported file) into app storage and returns its
 * photo:// URI. Remote and bundled images are returned unchanged.
 */
export async function storePhoto(uri: string): Promise<string> {
  if (isStoredPhoto(uri) || /^(https?|asset|blob):/i.test(uri)) return uri;
  const dir = folder();
  dir.create({ intermediates: true, idempotent: true });
  const data = /^data:([^;,]+)?((?:;[^;,]+)*?)(;base64)?,/i.exec(uri);
  if (data) {
    const name = `${newId()}.${EXTENSIONS[(data[1] ?? '').toLowerCase()] ?? 'jpg'}`;
    const payload = uri.slice(data[0].length);
    const file = new File(dir, name);
    file.create();
    if (data[3]) await file.write(payload, { encoding: 'base64' });
    else await file.write(decodeURIComponent(payload));
    return SCHEME + name;
  }
  const ext = /\.(jpe?g|png|webp|gif|heic)(?:[?#]|$)/i.exec(uri)?.[1]?.toLowerCase() ?? 'jpg';
  const name = `${newId()}.${ext}`;
  await new File(uri).copy(new File(dir, name));
  return SCHEME + name;
}

/** The photo as a data: URL, for files that must carry their photos (backups, shared recipes). */
export async function photoDataUrl(uri: string): Promise<string> {
  if (!isStoredPhoto(uri)) return uri;
  const file = new File(folder(), uri.slice(SCHEME.length));
  if (!file.exists) return uri;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  return `data:${MIME[ext] ?? 'image/jpeg'};base64,${await file.base64()}`;
}

/**
 * Deletes stored photos nothing refers to any more: images removed in the
 * editor, edits that were cancelled, deleted recipes. Returns how many went.
 */
export function sweepPhotos(referenced: Iterable<string>): number {
  const dir = folder();
  if (!dir.exists) return 0;
  const keep = new Set<string>();
  for (const uri of referenced) if (isStoredPhoto(uri)) keep.add(uri.slice(SCHEME.length));
  let removed = 0;
  for (const entry of dir.list()) {
    if (entry instanceof File && !keep.has(entry.name)) {
      entry.delete();
      removed++;
    }
  }
  return removed;
}
