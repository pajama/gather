/**
 * Moving photos in and out of app storage at the edges: importing files that
 * embed photos, exporting backups and shared recipes that must carry them,
 * and cleaning up photos nothing uses.
 */

import type { RecipeDraft } from '@/core/import/draft';
import { mapRecipeImages } from '@/core/model/recipe';
import type { Recipe } from '@/core/model/types';

import type { Backup, Database } from '../database';
import { photoDataUrl, storePhoto, sweepPhotos } from './photos';

const keep = (uri: string) => (error: unknown) => {
  console.warn('[gather] photo', error);
  return uri;
};

/** Stores embedded (data:) images of an imported recipe as files on device. */
export async function storeDraftPhotos(draft: RecipeDraft): Promise<RecipeDraft> {
  const imageUrls = await Promise.all(draft.imageUrls.map((uri) => storePhoto(uri).catch(keep(uri))));
  return { ...draft, imageUrls };
}

/** The recipe with its stored photos embedded, for sharing as a file. */
export function inlineRecipePhotos(recipe: Recipe): Promise<Recipe> {
  return mapRecipeImages(recipe, (uri) => photoDataUrl(uri).catch(keep(uri)));
}

/** A backup that carries its photos, so restoring on another device keeps them. */
export async function inlineBackupPhotos(backup: Backup): Promise<Backup> {
  return { ...backup, recipes: await Promise.all(backup.recipes.map(inlineRecipePhotos)) };
}

/**
 * Before a restore: stores the photos a backup carries as files (device), so
 * recipes refer to files instead of holding megabytes of base64. Leaves
 * anything that isn't a well-formed recipe image alone for validation to judge.
 */
export async function storeBackupPhotos(raw: unknown): Promise<unknown> {
  const file = raw as { recipes?: unknown };
  if (!raw || typeof raw !== 'object' || !Array.isArray(file.recipes)) return raw;
  const recipes = await Promise.all(
    file.recipes.map(async (recipe: unknown) => {
      const images = (recipe as { images?: unknown })?.images;
      if (!Array.isArray(images)) return recipe;
      const stored = await Promise.all(
        images.map(async (image: unknown) => {
          const uri = (image as { uri?: unknown })?.uri;
          return typeof uri === 'string' && uri.startsWith('data:') ? { ...(image as object), uri: await storePhoto(uri).catch(keep(uri)) } : image;
        }),
      );
      return { ...(recipe as object), images: stored };
    }),
  );
  return { ...(raw as object), recipes };
}

/** Deletes stored photos that no recipe, and no undoable restore, refers to. */
export async function sweepUnusedPhotos(db: Database): Promise<number> {
  try {
    return sweepPhotos(await db.imageReferences());
  } catch (error) {
    console.warn('[gather] photo cleanup', error);
    return 0;
  }
}
