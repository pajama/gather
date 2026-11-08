/**
 * Turning recipe ingredients into grocery list lines, and merging lines for
 * the same ingredient ("1 cup milk" + "½ cup milk" -> "1½ cups milk").
 */

import { foldExtra, formatIngredient, parseIngredient, type ParsedIngredient } from '../recipe/ingredients';
import { addQuantities, scaleQuantity } from '../recipe/quantity';
import { canConvert, convert, getUnit, humanize } from '../recipe/units';
import { aisleFor } from './aisles';

const PREP_WORDS =
  /\b(chopped|finely|roughly|coarsely|thinly|minced|diced|sliced|grated|shredded|crushed|peeled|softened|melted|beaten|cubed|halved|quartered|trimmed|rinsed|drained|divided|packed|sifted|toasted|room temperature|at room temperature|to taste|optional|fresh|freshly|large|medium|small|extra-large|jumbo)\b/gi;

/** Display name for the grocery list: preparation words removed ("large eggs" -> "eggs"). */
export function groceryName(parsed: ParsedIngredient): string {
  const name = parsed.name
    .replace(/\([^)]*\)/g, ' ')
    .replace(PREP_WORDS, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;-]+|[\s,;-]+$/g, '')
    .trim();
  return name || parsed.name;
}

function singularWord(word: string): string {
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(?:oes|ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  return word;
}

/** Merge key: lower-case, singular, punctuation-free. */
export function groceryKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(singularWord)
    .join(' ');
}

export interface GroceryLine {
  /** Display text ("1½ cups milk"). */
  text: string;
  /** Normalized ingredient name ("milk"). */
  name: string;
  aisle: string;
  recipeIds: string[];
}

/** Builds a grocery line from an ingredient, scaled for the servings being cooked. */
export function groceryLineFrom(ingredientText: string, options: { recipeId?: string; scale?: number } = {}): GroceryLine {
  const parsed = parseIngredient(ingredientText);
  const name = groceryName(parsed);
  const scaled: ParsedIngredient = { ...parsed, name, note: undefined };
  return {
    text: formatIngredient(scaled, { scale: options.scale ?? 1 }).full,
    name,
    aisle: aisleFor(name),
    recipeIds: options.recipeId ? [options.recipeId] : [],
  };
}

/**
 * Combines two lines for the same ingredient when their amounts can be
 * added; returns null when they should stay separate.
 */
function withoutAlt(p: ParsedIngredient): ParsedIngredient {
  const { alt: _alt, ...rest } = p;
  return rest;
}

export function combineLines(a: GroceryLine, b: GroceryLine): GroceryLine | null {
  if (groceryKey(a.name) !== groceryKey(b.name)) return null;
  // Two-part amounts ("½ cup + 2 tbsp") count as one; an alternative measure ("(240ml)") no longer
  // matches once amounts are added, so it is dropped.
  const pa = withoutAlt(foldExtra(parseIngredient(a.text)));
  const pb = withoutAlt(foldExtra(parseIngredient(b.text)));
  const recipeIds = [...new Set([...a.recipeIds, ...b.recipeIds])];
  // Neither has an amount ("salt" + "salt"): keep one.
  if (!pa.quantity && !pb.quantity) return { ...a, recipeIds };
  if (!pa.quantity || !pb.quantity || pa.size !== pb.size) return null;
  const ua = getUnit(pa.unit);
  const ub = getUnit(pb.unit);
  let quantity;
  let unitId = pa.unit;
  if (!ua && !ub) quantity = addQuantities(pa.quantity, pb.quantity);
  else if (ua && ub && ua.id === ub.id) quantity = addQuantities(pa.quantity, pb.quantity);
  else if (ua && ub && canConvert(ub, ua)) {
    const factor = convert(1, ub, ua);
    quantity = addQuantities(pa.quantity, scaleQuantity(pb.quantity, factor));
    const readable = humanize(quantity.value, ua);
    if (readable.unit.id !== ua.id) {
      quantity = scaleQuantity(quantity, readable.value / quantity.value);
      unitId = readable.unit.id;
    }
  } else return null;
  const merged: ParsedIngredient = { ...pa, quantity, ...(unitId ? { unit: unitId } : {}), name: a.name, note: undefined };
  return { ...a, text: formatIngredient(merged).full, recipeIds };
}

/** Adds lines to a list, merging with matching entries; returns the new list. */
export function mergeGroceryLines(existing: readonly GroceryLine[], incoming: readonly GroceryLine[]): GroceryLine[] {
  const result = [...existing];
  for (const line of incoming) {
    let merged = false;
    for (let i = 0; i < result.length; i++) {
      const combined = combineLines(result[i]!, line);
      if (combined) {
        result[i] = combined;
        merged = true;
        break;
      }
    }
    if (!merged) result.push(line);
  }
  return result;
}
