import { aisleFor } from '@/core/grocery/aisles';
import { combineLines, groceryLineFrom, type GroceryLine } from '@/core/grocery/merge';
import { allIngredients, newId, now } from '@/core/model/recipe';
import type { GroceryItem, GroceryList, ID } from '@/core/model/types';
import { parseIngredient } from '@/core/recipe/ingredients';

import type { Collections } from '../database';

export const DEFAULT_LIST_ID = 'default';

export class GroceriesRepository {
  constructor(private readonly c: Collections) {}

  ensureDefaultList(): GroceryList {
    const existing = this.c.lists.get(DEFAULT_LIST_ID);
    if (existing) return existing;
    const stamp = now();
    const list: GroceryList = {
      id: DEFAULT_LIST_ID,
      createdAt: stamp,
      updatedAt: stamp,
      name: 'Groceries',
      sortIndex: 0,
    };
    this.c.lists.upsert(list);
    return list;
  }

  items(listId: ID = DEFAULT_LIST_ID): GroceryItem[] {
    return this.c.groceries
      .all()
      .filter((g) => g.listId === listId)
      .sort((a, b) => a.sortIndex - b.sortIndex);
  }

  /** Adds lines, merging with unchecked items for the same ingredient. */
  addLines(lines: GroceryLine[], listId: ID = DEFAULT_LIST_ID): void {
    const items = this.items(listId);
    let nextIndex = items.reduce((max, g) => Math.max(max, g.sortIndex + 1), 0);
    const changed = new Map<ID, GroceryItem>();
    const created: GroceryItem[] = [];
    const stamp = now();
    for (const line of lines) {
      const open = [...items.filter((g) => !g.checked).map((g) => changed.get(g.id) ?? g), ...created];
      let merged = false;
      for (const item of open) {
        const combined = combineLines(item, line);
        if (combined) {
          const updated = { ...item, text: combined.text, recipeIds: combined.recipeIds, updatedAt: stamp };
          const createdIndex = created.findIndex((c) => c.id === item.id);
          if (createdIndex >= 0) created[createdIndex] = updated;
          else changed.set(item.id, updated);
          merged = true;
          break;
        }
      }
      if (!merged) {
        created.push({
          id: newId(),
          createdAt: stamp,
          updatedAt: stamp,
          listId,
          text: line.text,
          name: line.name,
          aisle: line.aisle,
          checked: false,
          recipeIds: line.recipeIds,
          sortIndex: nextIndex++,
        });
      }
    }
    this.c.groceries.upsert(...changed.values(), ...created);
  }

  /** Adds a recipe's ingredients (all, or the selected ids), scaled. */
  addRecipe(recipeId: ID, options: { scale?: number; ingredientIds?: ID[]; listId?: ID } = {}): number {
    const recipe = this.c.recipes.get(recipeId);
    if (!recipe) return 0;
    const wanted = options.ingredientIds ? new Set(options.ingredientIds) : undefined;
    const lines = allIngredients(recipe)
      .filter((i) => (wanted ? wanted.has(i.id) : true))
      .filter((i) => i.text.trim() && parseIngredient(i.text).name)
      .map((i) => groceryLineFrom(i.text, { recipeId, scale: options.scale ?? 1 }));
    this.addLines(lines, options.listId);
    return lines.length;
  }

  /** Adds free text typed by the user ("2 lemons"). */
  addText(text: string, listId: ID = DEFAULT_LIST_ID): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.addLines([groceryLineFrom(trimmed)], listId);
  }

  toggle(id: ID): void {
    this.c.groceries.update(id, (g) => ({ ...g, checked: !g.checked, updatedAt: now() }));
  }

  edit(id: ID, text: string): void {
    const parsed = groceryLineFrom(text);
    this.c.groceries.update(id, (g) => ({
      ...g,
      text: text.trim(),
      name: parsed.name,
      aisle: aisleFor(parsed.name),
      updatedAt: now(),
    }));
  }

  setAisle(id: ID, aisle: string): void {
    this.c.groceries.update(id, (g) => ({ ...g, aisle, updatedAt: now() }));
  }

  remove(id: ID): void {
    this.c.groceries.remove(id);
  }

  clearChecked(listId: ID = DEFAULT_LIST_ID): number {
    const checked = this.items(listId).filter((g) => g.checked);
    this.c.groceries.remove(...checked.map((g) => g.id));
    return checked.length;
  }

  clearAll(listId: ID = DEFAULT_LIST_ID): void {
    this.c.groceries.remove(...this.items(listId).map((g) => g.id));
  }

  uncheckAll(listId: ID = DEFAULT_LIST_ID): void {
    const stamp = now();
    this.c.groceries.upsert(
      ...this.items(listId)
        .filter((g) => g.checked)
        .map((g) => ({ ...g, checked: false, updatedAt: stamp })),
    );
  }

  /** Plain text for sharing or pasting into another app, grouped by aisle. */
  toText(listId: ID = DEFAULT_LIST_ID): string {
    return this.items(listId)
      .filter((g) => !g.checked)
      .map((g) => `- ${g.text}`)
      .join('\n');
  }
}
