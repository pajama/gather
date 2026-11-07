/**
 * Recipe quantities: whole numbers, decimals, fractions, mixed numbers and
 * ranges, as they appear in ingredient lines ("1 1/2", "1½", "2-3", "½ to 1").
 *
 * Pure functions with no platform dependencies.
 */

export interface Quantity {
  /** Lower (or only) value. */
  value: number;
  /** Upper value when the quantity is a range ("2-3"). */
  max?: number;
}

export const VULGAR_FRACTIONS: Readonly<Record<string, number>> = {
  '½': 1 / 2,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 1 / 4,
  '¾': 3 / 4,
  '⅕': 1 / 5,
  '⅖': 2 / 5,
  '⅗': 3 / 5,
  '⅘': 4 / 5,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅐': 1 / 7,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8,
  '⅑': 1 / 9,
  '⅒': 1 / 10,
};

const VULGAR_CLASS = `[${Object.keys(VULGAR_FRACTIONS).join('')}]`;

const WORD_NUMBERS: Readonly<Record<string, number>> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  dozen: 12,
  half: 0.5,
};

/** Words after "a"/"an" that make it vague rather than a count ("a few"). */
const VAGUE_AFTER_ARTICLE = /^(few|little|bit|couple|handful of|splash|drizzle|dash|pinch|sprinkle)\b/i;

type AtomParser = { re: RegExp; read: (m: RegExpExecArray) => number | null };

const ATOMS: AtomParser[] = [
  // Mixed number: "1 1/2", "1-1/2", "1 1⁄2"
  {
    re: /(\d+)(?:\s+|\s*-\s*)(\d+)\s*[/⁄]\s*(\d+)/y,
    read: (m) => (Number(m[3]) === 0 ? null : Number(m[1]) + Number(m[2]) / Number(m[3])),
  },
  // Whole + vulgar fraction: "1½", "1 ½"
  {
    re: new RegExp(`(\\d+)\\s*(${VULGAR_CLASS})`, 'y'),
    read: (m) => Number(m[1]) + (VULGAR_FRACTIONS[m[2] ?? ''] ?? 0),
  },
  // Simple fraction: "1/2"
  {
    re: /(\d+)\s*[/⁄]\s*(\d+)/y,
    read: (m) => (Number(m[2]) === 0 ? null : Number(m[1]) / Number(m[2])),
  },
  // Lone vulgar fraction: "½"
  {
    re: new RegExp(VULGAR_CLASS, 'y'),
    read: (m) => VULGAR_FRACTIONS[m[0]] ?? null,
  },
  // Decimal: "1.5", ".5", European "2,5" (a comma followed by 3 digits is a thousands separator)
  {
    re: /(\d{1,3}(?:,\d{3})+|\d+)?(?:[.](\d+)|,(\d{1,2})(?!\d))?/y,
    read: (m) => {
      if (!m[0]) return null;
      const whole = m[1] ? Number(m[1].replace(/,/g, '')) : 0;
      const frac = m[2] ?? m[3];
      if (!m[1] && !frac) return null;
      return frac ? Number(`${whole}.${frac}`) : whole;
    },
  },
];

const RANGE_SEPARATOR = /\s*(?:-|–|—|~|to|or)\s*/iy;

/** Reads one number atom at `pos`. */
function readAtom(input: string, pos: number): { value: number; end: number } | null {
  for (const atom of ATOMS) {
    atom.re.lastIndex = pos;
    const m = atom.re.exec(input);
    if (m && m[0].length > 0) {
      const value = atom.read(m);
      if (value !== null && Number.isFinite(value)) return { value, end: pos + m[0].length };
    }
  }
  return null;
}

function readWordNumber(input: string, pos: number): { value: number; end: number } | null {
  const m = /([A-Za-z]+)\b/y;
  m.lastIndex = pos;
  const match = m.exec(input);
  if (!match) return null;
  const word = match[1]!.toLowerCase();
  const value = WORD_NUMBERS[word];
  if (value === undefined) return null;
  const rest = input.slice(pos + match[0].length).trimStart();
  if ((word === 'a' || word === 'an') && VAGUE_AFTER_ARTICLE.test(rest)) return null;
  // "half a cup", "a half cup"
  return { value, end: pos + match[0].length };
}

export interface QuantityMatch {
  quantity: Quantity;
  /** Index just past the matched text. */
  end: number;
  /** The matched source text. */
  text: string;
}

/**
 * Parses a quantity at the start of `input` (after optional whitespace).
 * Returns null when the text does not start with a quantity.
 */
export function parseLeadingQuantity(input: string, options: { words?: boolean } = {}): QuantityMatch | null {
  const words = options.words ?? true;
  const start = input.length - input.trimStart().length;
  let first = readAtom(input, start);
  if (!first && words) first = readWordNumber(input, start);
  if (!first) return null;

  let end = first.end;
  let max: number | undefined;
  RANGE_SEPARATOR.lastIndex = end;
  const sep = RANGE_SEPARATOR.exec(input);
  if (sep) {
    const second = readAtom(input, end + sep[0].length);
    if (second && second.value > first.value) {
      max = second.value;
      end = second.end;
    }
  }
  const quantity: Quantity = max === undefined ? { value: first.value } : { value: first.value, max };
  return { quantity, end, text: input.slice(start, end) };
}

/** Parses a whole string as a quantity; returns null if anything else remains. */
export function parseQuantity(input: string): Quantity | null {
  const match = parseLeadingQuantity(input);
  if (!match) return null;
  return input.slice(match.end).trim() === '' ? match.quantity : null;
}

export function scaleQuantity(q: Quantity, factor: number): Quantity {
  return q.max === undefined ? { value: q.value * factor } : { value: q.value * factor, max: q.max * factor };
}

export function addQuantities(a: Quantity, b: Quantity): Quantity {
  const max = a.max !== undefined || b.max !== undefined ? (a.max ?? a.value) + (b.max ?? b.value) : undefined;
  return max === undefined ? { value: a.value + b.value } : { value: a.value + b.value, max };
}

const NICE_FRACTIONS: readonly (readonly [number, string])[] = [
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
];

export type NumberStyle = 'fraction' | 'decimal';

function trimDecimal(n: number, digits: number): string {
  return Number(n.toFixed(digits)).toString();
}

/**
 * Formats a number for display. "fraction" style renders common cooking
 * fractions as glyphs (1½, ⅓) and falls back to decimals otherwise;
 * "decimal" style rounds sensibly for metric amounts.
 */
export function formatNumber(n: number, style: NumberStyle = 'fraction'): string {
  if (!Number.isFinite(n)) return '';
  if (n < 0) return `-${formatNumber(-n, style)}`;
  if (style === 'decimal') {
    if (n >= 100) return Math.round(n).toString();
    if (n >= 10) return trimDecimal(n, 1);
    return trimDecimal(n, 2);
  }
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  if (frac < 0.03) return whole.toString();
  if (frac > 0.97) return (whole + 1).toString();
  let best: readonly [number, string] | undefined;
  let bestDelta = Infinity;
  for (const candidate of NICE_FRACTIONS) {
    const delta = Math.abs(candidate[0] - frac);
    if (delta < bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }
  if (best && bestDelta <= 0.035) return whole > 0 ? `${whole}${best[1]}` : best[1];
  if (whole >= 10) return trimDecimal(n, 1);
  return trimDecimal(n, 2);
}

export function formatQuantity(q: Quantity, style: NumberStyle = 'fraction'): string {
  const low = formatNumber(q.value, style);
  if (q.max === undefined) return low;
  return `${low}–${formatNumber(q.max, style)}`;
}

/** True when the quantity calls for a plural unit ("2 cups", "1–2 cups"). */
export function isPlural(q: Quantity): boolean {
  return (q.max ?? q.value) > 1 + 1e-9;
}
