/**
 * Finds where a recipe step mentions its ingredients ("Whisk the flour and
 * sugar"), so step-by-step mode can show each ingredient's amount in place.
 */

export interface MentionTarget {
  id: string;
  /** Parsed ingredient name ("extra virgin olive oil"). */
  name: string;
}

export interface Mention {
  start: number;
  end: number;
  text: string;
  ingredientId: string;
}

/** Words that describe an ingredient but never identify it on their own. */
const DESCRIPTORS = new Set(
  `large small medium big extra fresh freshly dried ground finely roughly coarsely thinly thickly chopped
  minced diced sliced grated shredded crushed peeled softened melted cold warm hot room temperature boneless
  skinless whole halved quartered packed loosely lightly heaping level good quality organic optional raw cooked
  frozen thawed canned ripe unsalted salted plain to taste divided about approx approximately of the a an and or
  for into cut pieces piece inch cm-thick`.split(/\s+/),
);

const WORD = /[\p{L}\p{N}'’-]+/gu;

function words(text: string): string[] {
  return (text.toLowerCase().match(WORD) ?? []).map((w) => w.replace(/[’']/g, "'"));
}

function singular(word: string): string {
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(?:oes|ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  return word;
}

function variants(phrase: string[]): string[] {
  const last = phrase[phrase.length - 1]!;
  const head = phrase.slice(0, -1).join(' ');
  const forms = new Set<string>([last, singular(last)]);
  const s = singular(last);
  forms.add(s.endsWith('y') ? `${s.slice(0, -1)}ies` : /(?:o|ch|sh|ss|x)$/.test(s) ? `${s}es` : `${s}s`);
  return [...forms].map((f) => (head ? `${head} ${f}` : f));
}

/** Candidate phrases for an ingredient, longest first. */
export function mentionPhrases(name: string): string[] {
  const cleaned = name.replace(/\([^)]*\)/g, ' ');
  const all = words(cleaned).filter((w) => !DESCRIPTORS.has(w));
  if (all.length === 0) return [];
  const phrases = new Set<string>();
  // Suffixes of the cleaned name: "extra virgin olive oil" -> "virgin olive oil", "olive oil", "oil".
  for (let i = 0; i < all.length; i++) for (const v of variants(all.slice(i))) phrases.add(v);
  // Also the first noun phrase before "or"/"and" alternatives: "butter or margarine" -> "butter".
  const alt = name.toLowerCase().split(/\s+(?:or|and)\s+/)[0];
  if (alt && alt !== name.toLowerCase()) for (const p of mentionPhrases(alt)) phrases.add(p);
  return [...phrases].sort((a, b) => b.length - a.length);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns non-overlapping mentions, preferring the longest phrase. A phrase
 * shared by several ingredients ("sugar" for brown and white sugar) is
 * ambiguous and is only used when it names exactly one ingredient.
 */
export function findIngredientMentions(text: string, ingredients: readonly MentionTarget[]): Mention[] {
  const owners = new Map<string, Set<string>>();
  for (const ingredient of ingredients) {
    for (const phrase of mentionPhrases(ingredient.name)) {
      const set = owners.get(phrase) ?? new Set<string>();
      set.add(ingredient.id);
      owners.set(phrase, set);
    }
  }
  const candidates: Mention[] = [];
  for (const [phrase, ids] of owners) {
    if (ids.size !== 1) continue;
    const [ingredientId] = ids;
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(phrase).replace(/ /g, '\\s+')}(?![\\p{L}\\p{N}])`, 'giu');
    for (let m = re.exec(text); m; m = re.exec(text)) {
      candidates.push({ start: m.index, end: m.index + m[0].length, text: m[0], ingredientId: ingredientId! });
    }
  }
  candidates.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const chosen: Mention[] = [];
  for (const c of candidates) {
    if (chosen.some((m) => c.start < m.end && m.start < c.end)) continue;
    chosen.push(c);
  }
  return chosen.sort((a, b) => a.start - b.start);
}

export type TextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'ingredient'; text: string; ingredientId: string }
  | { kind: 'duration'; text: string; seconds: number; maxSeconds?: number };

/** Splits text into plain, ingredient and duration segments for rich rendering. */
export function segmentText(
  text: string,
  marks: ReadonlyArray<
    | { start: number; end: number; ingredientId: string }
    | { start: number; end: number; seconds: number; maxSeconds?: number }
  >,
): TextSegment[] {
  const sorted = [...marks].sort((a, b) => a.start - b.start);
  const segments: TextSegment[] = [];
  let pos = 0;
  for (const mark of sorted) {
    if (mark.start < pos) continue;
    if (mark.start > pos) segments.push({ kind: 'text', text: text.slice(pos, mark.start) });
    const slice = text.slice(mark.start, mark.end);
    if ('ingredientId' in mark) segments.push({ kind: 'ingredient', text: slice, ingredientId: mark.ingredientId });
    else
      segments.push(
        mark.maxSeconds === undefined
          ? { kind: 'duration', text: slice, seconds: mark.seconds }
          : { kind: 'duration', text: slice, seconds: mark.seconds, maxSeconds: mark.maxSeconds },
      );
    pos = mark.end;
  }
  if (pos < text.length) segments.push({ kind: 'text', text: text.slice(pos) });
  return segments;
}
