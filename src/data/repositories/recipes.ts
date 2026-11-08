import type { RecipeDraft } from '@/core/import/draft';
import { createRecipe, now, recipeFromDraft, withFreshIds } from '@/core/model/recipe';
import type { ID, Recipe } from '@/core/model/types';

import type { Collections } from '../database';

export type RecipeSort = 'recent' | 'name' | 'cooked' | 'time';

export class RecipesRepository {
  constructor(private readonly c: Collections) {}

  get(id: ID | undefined): Recipe | undefined {
    return this.c.recipes.get(id);
  }

  all(): readonly Recipe[] {
    return this.c.recipes.all();
  }

  create(fields: Omit<Partial<Recipe>, 'id'> = {}): Recipe {
    const recipe = createRecipe(fields);
    this.c.recipes.upsert(recipe);
    return recipe;
  }

  /** Saves several imported recipes in one write: all of them, or (if one can't be built) none. */
  createManyFromDrafts(drafts: RecipeDraft[]): Recipe[] {
    const recipes = drafts.map((draft) => recipeFromDraft(draft));
    this.c.recipes.upsert(...recipes);
    return recipes;
  }

  createFromDraft(draft: RecipeDraft, extra: Partial<Recipe> = {}): Recipe {
    const recipe = recipeFromDraft(draft, extra);
    this.c.recipes.upsert(recipe);
    return recipe;
  }

  /** Saves edits, stamping updatedAt. */
  save(recipe: Recipe): Recipe {
    const next = { ...recipe, updatedAt: now() };
    this.c.recipes.upsert(next);
    return next;
  }

  update(id: ID, patch: Partial<Recipe>): Recipe | undefined {
    return this.c.recipes.update(id, (r) => ({ ...r, ...patch, updatedAt: now() }));
  }

  /** A new recipe with the same content: its own id, timestamps and history; the source is untouched. */
  duplicate(id: ID): Recipe | undefined {
    const source = this.get(id);
    if (!source) return undefined;
    const { id: _id, createdAt: _created, updatedAt: _updated, lastCookedAt: _cooked, ...content } = JSON.parse(JSON.stringify(source)) as Recipe;
    const copy = createRecipe({
      ...content,
      ...withFreshIds(content),
      name: `${source.name} (copy)`,
      favorite: false,
      cookCount: 0,
    });
    this.c.recipes.upsert(copy);
    return copy;
  }

  toggleFavorite(id: ID): void {
    this.c.recipes.update(id, (r) => ({ ...r, favorite: !r.favorite, updatedAt: now() }));
  }

  setRating(id: ID, rating: number | undefined): void {
    this.c.recipes.update(id, (r) => {
      const next = { ...r, updatedAt: now() };
      if (rating === undefined || rating <= 0) delete next.rating;
      else next.rating = Math.min(5, Math.max(1, Math.round(rating)));
      return next;
    });
  }

  markCooked(id: ID): void {
    const stamp = now();
    this.c.recipes.update(id, (r) => ({ ...r, lastCookedAt: stamp, cookCount: r.cookCount + 1, updatedAt: stamp }));
  }

  /** Deletes a recipe and everything that pointed at it. */
  delete(id: ID): void {
    this.c.recipes.remove(id);
    const planned = this.c.plan.all().filter((e) => e.recipeId === id);
    this.c.plan.remove(...planned.map((e) => e.id));
    const items = this.c.groceries.all().filter((g) => g.recipeIds.includes(id));
    const stamp = now();
    this.c.groceries.upsert(...items.map((g) => ({ ...g, recipeIds: g.recipeIds.filter((r) => r !== id), updatedAt: stamp })));
  }

  /** Distinct tags in use, most used first. */
  tags(): string[] {
    const counts = new Map<string, { label: string; n: number }>();
    for (const r of this.all()) {
      for (const tag of r.tags) {
        const key = tag.toLowerCase();
        const entry = counts.get(key) ?? { label: tag, n: 0 };
        entry.n++;
        counts.set(key, entry);
      }
    }
    return [...counts.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).map((e) => e.label);
  }
}
