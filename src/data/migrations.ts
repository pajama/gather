import { newId } from '@/core/model/recipe';
import type { Recipe } from '@/core/model/types';

/**
 * Upgrades stored recipes to the current shape. Every field added after the
 * first release gets a default here, so older documents keep loading.
 */
export function migrateRecipe(raw: unknown): Recipe {
  const r = (raw ?? {}) as Partial<Recipe> & Record<string, unknown>;
  const stamp = typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString();
  return {
    ...r,
    id: typeof r.id === 'string' ? r.id : newId(),
    createdAt: stamp,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : stamp,
    name: typeof r.name === 'string' ? r.name : 'Untitled recipe',
    images: Array.isArray(r.images) ? r.images : [],
    ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
    steps: Array.isArray(r.steps) ? r.steps : [],
    tags: Array.isArray(r.tags) ? r.tags : [],
    folderIds: Array.isArray(r.folderIds) ? r.folderIds : [],
    favorite: r.favorite === true,
    cookCount: typeof r.cookCount === 'number' ? r.cookCount : 0,
  } as Recipe;
}
