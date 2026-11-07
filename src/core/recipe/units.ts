/**
 * Cooking units: recognition of the many ways recipes spell them, and
 * conversion within a dimension (volume, mass, length, temperature).
 */

export type Dimension = 'volume' | 'mass' | 'length' | 'temperature' | 'count';
export type UnitSystem = 'metric' | 'us' | 'neutral';

export interface UnitDef {
  id: string;
  dimension: Dimension;
  system: UnitSystem;
  /** Multiplier to the dimension's base unit (ml, g, cm). Absent for counts. */
  toBase?: number;
  singular: string;
  plural: string;
  /** Short display form ("tbsp"). */
  short: string;
  /** Lower-case spellings matched case-insensitively (plus singular/plural/short). */
  aliases: string[];
  /** Spellings that must match exactly, case included ("T" is a tablespoon, "t" a teaspoon). */
  caseSensitiveAliases?: string[];
  /** Number style that reads naturally for this unit. */
  numberStyle: 'fraction' | 'decimal';
}

const U = (def: UnitDef): UnitDef => def;

export const UNITS: readonly UnitDef[] = [
  // US volume
  U({ id: 'tsp', dimension: 'volume', system: 'us', toBase: 4.92892, singular: 'teaspoon', plural: 'teaspoons', short: 'tsp', aliases: ['tsp', 'tsps', 'tsp.', 'teaspoon', 'teaspoons', 'teasp'], caseSensitiveAliases: ['t'], numberStyle: 'fraction' }),
  U({ id: 'tbsp', dimension: 'volume', system: 'us', toBase: 14.7868, singular: 'tablespoon', plural: 'tablespoons', short: 'tbsp', aliases: ['tbsp', 'tbsps', 'tbsp.', 'tbs', 'tbl', 'tbl.', 'tblsp', 'tablespoon', 'tablespoons', 'tbls'], caseSensitiveAliases: ['T', 'Tb'], numberStyle: 'fraction' }),
  U({ id: 'floz', dimension: 'volume', system: 'us', toBase: 29.5735, singular: 'fluid ounce', plural: 'fluid ounces', short: 'fl oz', aliases: ['fl oz', 'fl. oz.', 'fl. oz', 'fl.oz.', 'fl.oz', 'floz', 'fluid ounce', 'fluid ounces', 'fl ounce', 'fl ounces'], numberStyle: 'fraction' }),
  U({ id: 'cup', dimension: 'volume', system: 'us', toBase: 236.588, singular: 'cup', plural: 'cups', short: 'cup', aliases: ['cup', 'cups', 'c', 'c.'], numberStyle: 'fraction' }),
  U({ id: 'pint', dimension: 'volume', system: 'us', toBase: 473.176, singular: 'pint', plural: 'pints', short: 'pt', aliases: ['pint', 'pints', 'pt', 'pt.', 'pts'], numberStyle: 'fraction' }),
  U({ id: 'quart', dimension: 'volume', system: 'us', toBase: 946.353, singular: 'quart', plural: 'quarts', short: 'qt', aliases: ['quart', 'quarts', 'qt', 'qt.', 'qts'], numberStyle: 'fraction' }),
  U({ id: 'gallon', dimension: 'volume', system: 'us', toBase: 3785.41, singular: 'gallon', plural: 'gallons', short: 'gal', aliases: ['gallon', 'gallons', 'gal', 'gal.', 'gals'], numberStyle: 'fraction' }),
  // Metric volume
  U({ id: 'ml', dimension: 'volume', system: 'metric', toBase: 1, singular: 'millilitre', plural: 'millilitres', short: 'ml', aliases: ['ml', 'ml.', 'mls', 'milliliter', 'milliliters', 'millilitre', 'millilitres', 'cc'], caseSensitiveAliases: ['mL'], numberStyle: 'decimal' }),
  U({ id: 'cl', dimension: 'volume', system: 'metric', toBase: 10, singular: 'centilitre', plural: 'centilitres', short: 'cl', aliases: ['cl', 'centiliter', 'centiliters', 'centilitre', 'centilitres'], numberStyle: 'decimal' }),
  U({ id: 'dl', dimension: 'volume', system: 'metric', toBase: 100, singular: 'decilitre', plural: 'decilitres', short: 'dl', aliases: ['dl', 'deciliter', 'deciliters', 'decilitre', 'decilitres'], numberStyle: 'decimal' }),
  U({ id: 'l', dimension: 'volume', system: 'metric', toBase: 1000, singular: 'litre', plural: 'litres', short: 'l', aliases: ['l', 'l.', 'liter', 'liters', 'litre', 'litres', 'ltr', 'ltrs'], caseSensitiveAliases: ['L'], numberStyle: 'decimal' }),
  // Mass
  U({ id: 'mg', dimension: 'mass', system: 'metric', toBase: 0.001, singular: 'milligram', plural: 'milligrams', short: 'mg', aliases: ['mg', 'mgs', 'milligram', 'milligrams', 'milligramme', 'milligrammes'], numberStyle: 'decimal' }),
  U({ id: 'g', dimension: 'mass', system: 'metric', toBase: 1, singular: 'gram', plural: 'grams', short: 'g', aliases: ['g', 'g.', 'gr', 'gr.', 'grs', 'gram', 'grams', 'gramme', 'grammes', 'gm', 'gms'], numberStyle: 'decimal' }),
  U({ id: 'kg', dimension: 'mass', system: 'metric', toBase: 1000, singular: 'kilogram', plural: 'kilograms', short: 'kg', aliases: ['kg', 'kg.', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms', 'kilogramme', 'kilogrammes'], numberStyle: 'decimal' }),
  U({ id: 'oz', dimension: 'mass', system: 'us', toBase: 28.3495, singular: 'ounce', plural: 'ounces', short: 'oz', aliases: ['oz', 'oz.', 'ozs', 'ounce', 'ounces'], numberStyle: 'fraction' }),
  U({ id: 'lb', dimension: 'mass', system: 'us', toBase: 453.592, singular: 'pound', plural: 'pounds', short: 'lb', aliases: ['lb', 'lb.', 'lbs', 'lbs.', 'pound', 'pounds', '#'], numberStyle: 'fraction' }),
  // Length
  U({ id: 'mm', dimension: 'length', system: 'metric', toBase: 0.1, singular: 'millimetre', plural: 'millimetres', short: 'mm', aliases: ['mm', 'millimeter', 'millimeters', 'millimetre', 'millimetres'], numberStyle: 'decimal' }),
  U({ id: 'cm', dimension: 'length', system: 'metric', toBase: 1, singular: 'centimetre', plural: 'centimetres', short: 'cm', aliases: ['cm', 'centimeter', 'centimeters', 'centimetre', 'centimetres'], numberStyle: 'decimal' }),
  U({ id: 'in', dimension: 'length', system: 'us', toBase: 2.54, singular: 'inch', plural: 'inches', short: 'in', aliases: ['in', 'in.', 'inch', 'inches', '"', '″'], numberStyle: 'fraction' }),
  // Neutral counts and vague amounts (never converted)
  ...(
    [
      ['pinch', 'pinch', 'pinches', ['pinch', 'pinches', 'pn']],
      ['dash', 'dash', 'dashes', ['dash', 'dashes']],
      ['drop', 'drop', 'drops', ['drop', 'drops']],
      ['splash', 'splash', 'splashes', ['splash', 'splashes']],
      ['handful', 'handful', 'handfuls', ['handful', 'handfuls']],
      ['clove', 'clove', 'cloves', ['clove', 'cloves']],
      ['slice', 'slice', 'slices', ['slice', 'slices']],
      ['piece', 'piece', 'pieces', ['piece', 'pieces', 'pc', 'pcs']],
      ['can', 'can', 'cans', ['can', 'cans', 'tin', 'tins']],
      ['jar', 'jar', 'jars', ['jar', 'jars']],
      ['bottle', 'bottle', 'bottles', ['bottle', 'bottles']],
      ['package', 'package', 'packages', ['package', 'packages', 'pkg', 'pkgs', 'packet', 'packets', 'pack', 'packs']],
      ['box', 'box', 'boxes', ['box', 'boxes']],
      ['bag', 'bag', 'bags', ['bag', 'bags']],
      ['bunch', 'bunch', 'bunches', ['bunch', 'bunches']],
      ['sprig', 'sprig', 'sprigs', ['sprig', 'sprigs']],
      ['stalk', 'stalk', 'stalks', ['stalk', 'stalks']],
      ['stick', 'stick', 'sticks', ['stick', 'sticks']],
      ['head', 'head', 'heads', ['head', 'heads']],
      ['sheet', 'sheet', 'sheets', ['sheet', 'sheets']],
      ['fillet', 'fillet', 'fillets', ['fillet', 'fillets', 'filet', 'filets']],
      ['leaf', 'leaf', 'leaves', ['leaf', 'leaves']],
      ['scoop', 'scoop', 'scoops', ['scoop', 'scoops']],
      ['knob', 'knob', 'knobs', ['knob', 'knobs']],
      ['cube', 'cube', 'cubes', ['cube', 'cubes']],
      ['strip', 'strip', 'strips', ['strip', 'strips']],
      ['wedge', 'wedge', 'wedges', ['wedge', 'wedges']],
      ['loaf', 'loaf', 'loaves', ['loaf', 'loaves']],
      ['envelope', 'envelope', 'envelopes', ['envelope', 'envelopes']],
      ['container', 'container', 'containers', ['container', 'containers', 'tub', 'tubs']],
    ] as const
  ).map(([id, singular, plural, aliases]) =>
    U({ id, dimension: 'count', system: 'neutral', singular, plural, short: singular, aliases: [...aliases], numberStyle: 'fraction' }),
  ),
];

const BY_ID = new Map(UNITS.map((u) => [u.id, u]));

export function getUnit(id: string | undefined): UnitDef | undefined {
  return id ? BY_ID.get(id) : undefined;
}

interface AliasEntry {
  alias: string;
  unit: UnitDef;
  caseSensitive: boolean;
}

/** Longest aliases first so "fl oz" wins over "fl" and "tbsp" over "t". */
const ALIASES: AliasEntry[] = UNITS.flatMap((unit) => {
  const insensitive = new Set([unit.singular, unit.plural, unit.short, ...unit.aliases].map((a) => a.toLowerCase()));
  return [
    ...[...insensitive].map((alias) => ({ alias, unit, caseSensitive: false })),
    ...(unit.caseSensitiveAliases ?? []).map((alias) => ({ alias, unit, caseSensitive: true })),
  ];
}).sort((a, b) => b.alias.length - a.alias.length);

export interface UnitMatch {
  unit: UnitDef;
  /** Index just past the unit (and a trailing "of", if present). */
  end: number;
  text: string;
}

const isWordChar = (ch: string | undefined): boolean => !!ch && /[\p{L}\p{N}]/u.test(ch);

/**
 * Matches a unit at `pos` in `input`. The unit must end at a word boundary so
 * "cloves" does not match "c" and "large" does not match "l".
 */
export function matchUnitAt(input: string, pos: number): UnitMatch | null {
  const rest = input.slice(pos);
  const lower = rest.toLowerCase();
  for (const entry of ALIASES) {
    const candidate = entry.caseSensitive ? rest : lower;
    if (!candidate.startsWith(entry.alias)) continue;
    const next = rest[entry.alias.length];
    const lastIsWord = isWordChar(entry.alias[entry.alias.length - 1]);
    if (lastIsWord && isWordChar(next)) continue;
    let end = pos + entry.alias.length;
    // Tolerate a trailing period ("tbsp.") and an "of" ("a pinch of salt").
    if (input[end] === '.' && !entry.alias.endsWith('.')) end += 1;
    const ofMatch = /^\s+of\b/i.exec(input.slice(end));
    if (ofMatch) end += ofMatch[0].length;
    return { unit: entry.unit, end, text: input.slice(pos, end).trim() };
  }
  return null;
}

/** Finds the unit for a free-form unit string ("Tbsp", "grams"). */
export function findUnit(text: string): UnitDef | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const match = matchUnitAt(trimmed, 0);
  return match && match.end >= trimmed.replace(/\.$/, '').length ? match.unit : undefined;
}

export function unitLabel(unit: UnitDef, plural: boolean, style: 'short' | 'long' = 'short'): string {
  if (style === 'long') return plural ? unit.plural : unit.singular;
  if (unit.dimension === 'count') return plural ? unit.plural : unit.singular;
  if (unit.id === 'cup') return plural ? 'cups' : 'cup';
  return unit.short;
}

export function canConvert(from: UnitDef, to: UnitDef): boolean {
  return from.dimension === to.dimension && from.toBase !== undefined && to.toBase !== undefined;
}

export function convert(value: number, from: UnitDef, to: UnitDef): number {
  if (!canConvert(from, to)) throw new Error(`Cannot convert ${from.id} to ${to.id}`);
  return (value * from.toBase!) / to.toBase!;
}

/** Display ladders: the unit chosen is the largest one the value reaches. */
const LADDERS: Record<string, string[]> = {
  'volume:us': ['tsp', 'tbsp', 'cup', 'quart', 'gallon'],
  'volume:metric': ['ml', 'l'],
  'mass:us': ['oz', 'lb'],
  'mass:metric': ['g', 'kg'],
  'length:us': ['in'],
  'length:metric': ['mm', 'cm'],
};

const LADDER_THRESHOLDS: Record<string, number> = {
  tbsp: 1, // 3 tsp
  cup: 0.25, // 4 tbsp
  quart: 1,
  gallon: 1,
  l: 1,
  lb: 1,
  kg: 1,
  cm: 1,
};

/**
 * Picks a readable unit for an amount expressed in `unit`, within `system`
 * (e.g. 48 tsp -> 1 cup; 1500 g -> 1.5 kg). Returns the converted value.
 */
export function humanize(value: number, unit: UnitDef, system: 'us' | 'metric' = unit.system === 'metric' ? 'metric' : 'us'): { value: number; unit: UnitDef } {
  if (unit.toBase === undefined) return { value, unit };
  const ladder = LADDERS[`${unit.dimension}:${system}`];
  if (!ladder) return { value, unit };
  const base = value * unit.toBase;
  let chosen = getUnit(ladder[0])!;
  for (const id of ladder) {
    const candidate = getUnit(id)!;
    const threshold = LADDER_THRESHOLDS[id] ?? 1;
    if (base / candidate.toBase! >= threshold - 1e-9) chosen = candidate;
  }
  return { value: base / chosen.toBase!, unit: chosen };
}

/** Converts an amount into the other measurement system, choosing a readable unit. */
export function convertToSystem(value: number, unit: UnitDef, system: 'us' | 'metric'): { value: number; unit: UnitDef } {
  if (unit.toBase === undefined || unit.system === system || unit.system === 'neutral') return { value, unit };
  const ladder = LADDERS[`${unit.dimension}:${system}`];
  if (!ladder) return { value, unit };
  const target = getUnit(ladder[0])!;
  return humanize(convert(value, unit, target), target, system);
}
