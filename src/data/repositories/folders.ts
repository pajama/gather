import { newId, now } from '@/core/model/recipe';
import { inFolder } from '@/core/model/library';
import type { Folder, ID } from '@/core/model/types';

import type { Collections } from '../database';

export class FoldersRepository {
  constructor(private readonly c: Collections) {}

  /** Folders in display order. */
  list(): Folder[] {
    return [...this.c.folders.all()].sort(
      (a, b) => a.sortIndex - b.sortIndex || a.name.localeCompare(b.name),
    );
  }

  get(id: ID | undefined): Folder | undefined {
    return this.c.folders.get(id);
  }

  create(name: string, fields: Partial<Folder> = {}): Folder {
    const stamp = now();
    const folder: Folder = {
      id: newId(),
      createdAt: stamp,
      updatedAt: stamp,
      name: name.trim() || 'New folder',
      sortIndex: this.list().length,
      ...fields,
    };
    this.c.folders.upsert(folder);
    return folder;
  }

  update(id: ID, patch: Partial<Folder>): void {
    this.c.folders.update(id, (f) => ({ ...f, ...patch, updatedAt: now() }));
  }

  /** Deletes the folder; its recipes stay in the library. */
  delete(id: ID): void {
    this.c.folders.remove(id);
    const affected = this.c.recipes.all().filter((r) => r.folderIds.includes(id));
    const stamp = now();
    this.c.recipes.upsert(
      ...affected.map((r) => ({ ...r, folderIds: r.folderIds.filter((f) => f !== id), updatedAt: stamp })),
    );
  }

  reorder(ids: ID[]): void {
    const stamp = now();
    const updated = ids
      .map((id, index) => {
        const folder = this.c.folders.get(id);
        return folder ? { ...folder, sortIndex: index, updatedAt: stamp } : undefined;
      })
      .filter((f): f is Folder => !!f);
    this.c.folders.upsert(...updated);
  }

  setRecipeFolders(recipeId: ID, folderIds: ID[]): void {
    this.c.recipes.update(recipeId, (r) => ({ ...r, folderIds: [...new Set(folderIds)], updatedAt: now() }));
  }

  toggleRecipe(recipeId: ID, folderId: ID): void {
    this.c.recipes.update(recipeId, (r) => ({
      ...r,
      folderIds: r.folderIds.includes(folderId)
        ? r.folderIds.filter((f) => f !== folderId)
        : [...r.folderIds, folderId],
      updatedAt: now(),
    }));
  }

  /** Recipes in the folder, counting ones its tag rule collects. */
  recipeCount(folderId: ID): number {
    const folder = this.c.folders.get(folderId);
    return folder ? this.c.recipes.all().filter((r) => inFolder(r, folder)).length : 0;
  }
}
