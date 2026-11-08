import { searchText, totalSeconds } from './recipe';
import type { Folder, ID, Recipe } from './types';

export type LibrarySort = 'recent' | 'name' | 'cooked' | 'quickest' | 'rating';

export const LIBRARY_SORTS: readonly { value: LibrarySort; label: string }[] = [
  { value: 'recent', label: 'Recently added' },
  { value: 'name', label: 'Name' },
  { value: 'cooked', label: 'Recently cooked' },
  { value: 'quickest', label: 'Quickest' },
  { value: 'rating', label: 'Top rated' },
];

/** True when the recipe was added to the folder or matches its tag rule. */
export function inFolder(recipe: Recipe, folder: Folder): boolean {
  if (recipe.folderIds.includes(folder.id)) return true;
  const rule = (folder.tags ?? []).map((t) => t.toLowerCase());
  if (rule.length === 0) return false;
  const tags = new Set(recipe.tags.map((t) => t.toLowerCase()));
  return folder.tagMatch === 'all' ? rule.every((t) => tags.has(t)) : rule.some((t) => tags.has(t));
}

export interface LibraryQuery {
  text?: string;
  /** A folder id, 'favorites', or undefined for all recipes. Prefer `folder` so smart rules apply. */
  scope?: ID | 'favorites';
  /** Limit to a folder, including recipes its tag rule collects. */
  folder?: Folder;
  tag?: string;
  sort?: LibrarySort;
}

/**
 * Filters and sorts the library. Every word of the search must appear in
 * the recipe's name, tags, source or ingredient names.
 */
export function queryLibrary(recipes: readonly Recipe[], query: LibraryQuery): Recipe[] {
  const words = (query.text ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const tag = query.tag?.toLowerCase();
  const filtered = recipes.filter((r) => {
    if (query.scope === 'favorites' && !r.favorite) return false;
    if (query.folder && !inFolder(r, query.folder)) return false;
    if (!query.folder && query.scope && query.scope !== 'favorites' && !r.folderIds.includes(query.scope)) return false;
    if (tag && !r.tags.some((t) => t.toLowerCase() === tag)) return false;
    if (words.length) {
      const haystack = searchText(r);
      if (!words.every((w) => haystack.includes(w))) return false;
    }
    return true;
  });
  const byName = (a: Recipe, b: Recipe) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  switch (query.sort ?? 'recent') {
    case 'name':
      return filtered.sort(byName);
    case 'cooked':
      return filtered.sort((a, b) => (b.lastCookedAt ?? '').localeCompare(a.lastCookedAt ?? '') || byName(a, b));
    case 'quickest':
      return filtered.sort((a, b) => (totalSeconds(a) ?? Infinity) - (totalSeconds(b) ?? Infinity) || byName(a, b));
    case 'rating':
      return filtered.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || byName(a, b));
    default:
      return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
