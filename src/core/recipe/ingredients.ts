/**
 * Ingredient line parsing and formatting.
 *
 * "1 ½ cups (190g) all-purpose flour, sifted" ->
 *   { quantity: 1.5, unit: 'cup', alt: '190g', name: 'all-purpose flour', note: 'sifted' }
 */

import { formatQuantity, parseLeadingQuantity, scaleQuantity, type Quantity } from './quantity';
import { canConvert, convert, convertToSystem, getUnit, humanize, matchUnitAt, unitLabel, type UnitDef } from './units';

export interface ParsedIngredient {
  /** The line as written, trimmed. */
  text: string;
  quantity?: Quantity;
  /** Unit id from the unit table (see units.ts). */
  unit?: string;
  /** Package size between the quantity and the unit: "2 (14 oz) cans" -> "14 oz". Never scaled. */
  size?: string;
  /**
   * Alternative measure after the unit: "1 cup (240ml) milk" or "200g/7oz butter" -> "240ml", "7oz".
   * Scaled with the quantity; when converting to its system it replaces the main measure.
   */
  alt?: string;
  /** A second amount added to the first: "½ cup + 2 tbsp sugar" -> 2 tbsp. Folded into the first when scaling or converting. */
  extra?: { quantity: Quantity; unit: string; text: string };
  /** The ingredient itself. */
  name: string;
  /** Preparation or comment: "sifted", "to taste", "optional". */
  note?: string;
}

const BULLET = /^\s*(?:[-–—*•·▢☐□◦‣⁃]|\d+[.)](?=\s))\s*/u;

const TRAILING_NOTE =
  /\s+(to taste|as needed|if needed|or to taste|optional|for (?:serving|garnish|garnishing|frying|greasing|dusting|drizzling|topping|decoration|the pan|the top))\.?$/i;

function normalize(line: string): string {
  return line
    // Some recipe plugins double-wrap notes: "garlic ((or garlic powder))".
    .replace(/\(\(/g, '(')
    .replace(/\)\)/g, ')')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2009\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Reads a balanced parenthetical starting at `pos` (which must be "(" or "["). */
function readParenthetical(text: string, pos: number): { inner: string; end: number } | null {
  const open = text[pos];
  if (open !== '(' && open !== '[') return null;
  const close = open === '(' ? ')' : ']';
  let depth = 0;
  for (let i = pos; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close) {
      depth--;
      if (depth === 0) return { inner: text.slice(pos + 1, i).trim(), end: i + 1 };
    }
  }
  return null;
}

function skipSpaces(text: string, pos: number): number {
  while (text[pos] === ' ') pos++;
  return pos;
}

/** A number followed by a unit at `pos` ("2 tbsp", "7oz"), or null. */
function measureAt(text: string, pos: number): { quantity: Quantity; unit: UnitDef; end: number } | null {
  const q = parseLeadingQuantity(text.slice(pos), { words: false });
  if (!q) return null;
  const unit = matchUnitAt(text, skipSpaces(text, pos + q.end));
  return unit ? { quantity: q.quantity, unit: unit.unit, end: unit.end } : null;
}

/** Splits at the first comma that is not inside parentheses. */
function splitTopLevelComma(text: string): [string, string | undefined] {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0) return [text.slice(0, i).trim(), text.slice(i + 1).trim() || undefined];
  }
  return [text.trim(), undefined];
}

function joinNotes(...notes: (string | undefined)[]): string | undefined {
  const parts = notes.map((n) => n?.trim()).filter((n): n is string => !!n);
  return parts.length ? parts.join(', ') : undefined;
}

export function parseIngredient(line: string): ParsedIngredient {
  const text = normalize(line.replace(BULLET, ''));
  const result: ParsedIngredient = { text, name: text };
  if (!text) return result;

  let pos = 0;
  const q = parseLeadingQuantity(text);
  if (q) {
    result.quantity = q.quantity;
    pos = skipSpaces(text, q.end);
  }

  // "2 x 400g tins" -> size "400g"
  if (q) {
    const times = /^[x×]\s*/i.exec(text.slice(pos));
    if (times) {
      const sizeStart = pos + times[0].length;
      const sizeQ = parseLeadingQuantity(text.slice(sizeStart), { words: false });
      if (sizeQ) {
        const afterNum = sizeStart + sizeQ.end;
        const sizeUnit = matchUnitAt(text, skipSpaces(text, afterNum));
        const sizeEnd = sizeUnit ? sizeUnit.end : afterNum;
        result.size = text.slice(sizeStart, sizeEnd).trim();
        pos = skipSpaces(text, sizeEnd);
      }
    }
  }

  // "2 (14 oz) cans"
  if (q) {
    const paren = readParenthetical(text, pos);
    if (paren && /\d/.test(paren.inner)) {
      result.size = paren.inner;
      pos = skipSpaces(text, paren.end);
    }
  }

  const unit = matchUnitAt(text, pos);
  if (unit && (q || unit.unit.dimension === 'count' || /\bof\b/i.test(unit.text))) {
    result.unit = unit.unit.id;
    pos = skipSpaces(text, unit.end);
    // "1 cup (240ml) milk"
    const alt = readParenthetical(text, pos);
    if (alt && /\d/.test(alt.inner)) {
      result.alt = alt.inner;
      pos = skipSpaces(text, alt.end);
    }
    // "200g/7oz butter": the same amount in the other system.
    const slash = /^\/\s*/.exec(text.slice(pos));
    if (!result.alt && slash) {
      const measure = measureAt(text, pos + slash[0].length);
      if (measure) {
        result.alt = text.slice(pos + slash[0].length, measure.end).trim();
        pos = skipSpaces(text, measure.end);
      }
    }
    // "½ cup + 2 tbsp sugar", "1 cup plus 2 tablespoons flour"
    const addend = /^(?:\+|plus|and)\s*/i.exec(text.slice(pos));
    if (q && addend) {
      const measure = measureAt(text, pos + addend[0].length);
      if (measure && canConvert(measure.unit, unit.unit)) {
        result.extra = { quantity: measure.quantity, unit: measure.unit.id, text: text.slice(pos, measure.end).trim() };
        pos = skipSpaces(text, measure.end);
      }
    }
  }

  let rest = text.slice(pos).replace(/^of\s+/i, '');
  let [name, note] = splitTopLevelComma(rest);

  // Trailing parenthetical on the name becomes a note: "butter (softened)".
  const trailingParen = /\s*\(([^()]*)\)$/.exec(name);
  if (trailingParen && trailingParen.index > 0) {
    name = name.slice(0, trailingParen.index).trim();
    note = joinNotes(trailingParen[1], note);
  }
  // "onion - diced"
  const dash = /\s+[-–—]\s+(.+)$/.exec(name);
  if (dash && dash.index > 0) {
    name = name.slice(0, dash.index).trim();
    note = joinNotes(dash[1], note);
  }
  const trailing = TRAILING_NOTE.exec(name);
  if (trailing && trailing.index > 0) {
    name = name.slice(0, trailing.index).trim();
    note = joinNotes(trailing[1], note);
  }
  rest = name;
  result.name = rest || text;
  if (note) result.note = note;
  return result;
}

/** Ingredient-list section headings: "For the sauce:", "FROSTING", "## Dough". */
export function isIngredientHeading(line: string): boolean {
  const text = normalize(line);
  if (!text || parseLeadingQuantity(text, { words: false })) return false;
  if (/^#{1,6}\s+\S/.test(text)) return true;
  if (/:$/.test(text) && text.length <= 60) return true;
  if (/^for the\b/i.test(text) && text.split(' ').length <= 6 && !/,/.test(text)) return true;
  const letters = text.replace(/[^A-Za-z]/g, '');
  return letters.length >= 3 && letters === letters.toUpperCase() && text.split(' ').length <= 5;
}

export function headingText(line: string): string {
  return normalize(line)
    .replace(/^#{1,6}\s+/, '')
    .replace(/:$/, '')
    .trim();
}

export interface FormatOptions {
  /** Multiplies quantities (recipe scaling). Default 1. */
  scale?: number;
  /** Converts measured units to this system; 'original' leaves them. */
  system?: 'original' | 'us' | 'metric';
  /** Pick a more readable unit after scaling (48 tsp -> 1 cup). Default true. */
  humanize?: boolean;
}

export interface FormattedIngredient {
  /** "1½ cups" or "" when the ingredient has no amount. */
  amount: string;
  /** Quantity alone ("1½"). */
  quantity: string;
  /** Unit label ("cups"). */
  unit: string;
  /** Name with size/alt detail ("all-purpose flour"). */
  name: string;
  note?: string;
  /** Whole line ready to display or copy. */
  full: string;
}

function scaleInlineAmount(text: string, factor: number): string {
  if (factor === 1) return text;
  const q = parseLeadingQuantity(text, { words: false });
  if (!q) return text;
  const unit = matchUnitAt(text, skipSpaces(text, q.end));
  const style = unit?.unit.numberStyle ?? 'fraction';
  return `${formatQuantity(scaleQuantity(q.quantity, factor), style)}${text.slice(q.end)}`;
}

/** Adds the second amount into the first, in the first's unit ("½ cup + 2 tbsp" -> ⅝ cup). */
export function foldExtra(ingredient: ParsedIngredient): ParsedIngredient {
  if (!ingredient.extra) return ingredient;
  const { extra, ...rest } = ingredient;
  const main = getUnit(ingredient.unit);
  const added = getUnit(extra.unit);
  if (!ingredient.quantity || !main || !added || !canConvert(added, main)) return rest;
  const delta = convert(extra.quantity.value, added, main);
  const q = ingredient.quantity;
  return { ...rest, quantity: q.max === undefined ? { value: q.value + delta } : { value: q.value + delta, max: q.max + delta } };
}

/** The alternative measure as a number and unit, when it is exactly that ("240ml", "7 oz"). */
function altMeasure(alt: string): { quantity: Quantity; unit: UnitDef } | undefined {
  const measure = measureAt(alt, 0);
  return measure && skipSpaces(alt, measure.end) === alt.length ? measure : undefined;
}

export function formatIngredient(ingredient: ParsedIngredient, options: FormatOptions = {}): FormattedIngredient {
  const factor = options.scale ?? 1;
  const system = options.system ?? 'original';
  // As written, "½ cup + 2 tbsp" stays two amounts; scaled or converted it becomes one.
  const asWritten = factor === 1 && system === 'original';
  const source = asWritten ? ingredient : foldExtra(ingredient);
  let unit: UnitDef | undefined = getUnit(source.unit);
  let quantity = source.quantity ? scaleQuantity(source.quantity, factor) : undefined;

  if (quantity && unit) {
    // The author's own measure in the target system beats a conversion: "1 cup (120g) flour" -> 120 g.
    const alt = system !== 'original' && ingredient.alt && !ingredient.extra ? altMeasure(ingredient.alt) : undefined;
    if (alt && unit.system !== system && alt.unit.system === system && alt.unit.dimension !== 'count') {
      quantity = scaleQuantity(alt.quantity, factor);
      unit = alt.unit;
    }
    let converted = { value: quantity.value, unit };
    if (system !== 'original' && unit.system !== 'neutral' && unit.system !== system) converted = convertToSystem(quantity.value, unit, system);
    else if (options.humanize !== false && factor !== 1) converted = humanize(quantity.value, unit);
    if (converted.unit !== unit) {
      const ratio = converted.value / quantity.value;
      quantity = quantity.max === undefined ? { value: converted.value } : { value: converted.value, max: quantity.max * ratio };
      unit = converted.unit;
    }
  }

  const style = unit?.numberStyle ?? 'fraction';
  const quantityText = quantity ? formatQuantity(quantity, style) : '';
  const plural = quantity ? (quantity.max ?? quantity.value) > 1 + 1e-9 : false;
  const unitText = unit ? unitLabel(unit, plural) : '';
  const sizeText = ingredient.size ? `(${ingredient.size})` : '';
  // A converted line shows one system; the alternative measure would repeat it.
  const altText = ingredient.alt && system === 'original' ? `(${scaleInlineAmount(ingredient.alt, factor)})` : '';
  const extraText = asWritten && ingredient.extra ? ingredient.extra.text : '';

  const amount = [quantityText, sizeText, unitText, extraText].filter(Boolean).join(' ');
  const name = [altText, ingredient.name].filter(Boolean).join(' ');
  const full = [amount, name].filter(Boolean).join(' ') + (ingredient.note ? `, ${ingredient.note}` : '');
  return { amount, quantity: quantityText, unit: unitText, name, note: ingredient.note, full };
}
