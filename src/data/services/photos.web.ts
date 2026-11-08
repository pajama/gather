/**
 * Web: photos stay data: URLs inside the recipe (a blob: URL from the picker
 * dies with the page). See photos.ts for the device version.
 */

export function isStoredPhoto(uri: string): boolean {
  return uri.startsWith('photo://');
}

export function photoDisplayUri(uri: string): string {
  return uri;
}

export async function storePhoto(uri: string): Promise<string> {
  return uri;
}

export async function photoDataUrl(uri: string): Promise<string> {
  return uri;
}

export function sweepPhotos(_referenced: Iterable<string>): number {
  return 0;
}
