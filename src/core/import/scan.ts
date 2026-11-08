/**
 * Tidies text recognized from a photo of a cookbook page (OCR) so the
 * pasted-text parser can read it: rejoins words hyphenated across lines,
 * reflows sentences broken by the page width, and fixes the usual digit
 * mix-ups in amounts ("l cup" -> "1 cup", "1/2" kept, "%" for "½").
 */

const UNIT_WORD = '(?:cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|g|kg|ml|l|cloves?|cans?|pinch|bunch|sticks?)';

/** Lines that start a new ingredient or step rather than continuing a sentence. */
const STARTS_ITEM = /^(?:[-–—*•·]|\d|[¼½¾⅓⅔⅛]|step\b|ingredients?\b|method\b|directions?\b|instructions?\b|for the\b)/i;

const HEADING = /^(ingredients?|method|directions?|instructions?|preparation|steps?|notes?|serves|makes|yield)\b/i;
const SECTION_HEADING = /^(ingredients?|method|directions?|instructions?|preparation|steps?|notes?)\b/i;

function fixAmounts(line: string): string {
  return (
    line
      // "l cup", "I tbsp" at the start of an ingredient line are almost always a 1.
      .replace(new RegExp(`^([lI|])(\\s+${UNIT_WORD}\\b)`, 'i'), '1$2')
      // "1 l/2 cups" style slips inside fractions.
      .replace(/\b(\d)\s*[lI|]\s*\/\s*(\d)\b/g, '$1 1/$2')
      // OCR often reads ½ as "%" or "Y2" right after a number or at the start.
      .replace(/^(\d+)?\s*%\s+/, (_m, whole: string | undefined) => (whole ? `${whole}½ ` : '½ '))
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export function cleanScannedText(raw: string): string {
  const lines = raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    // Words hyphenated across a line break.
    .replace(/([a-z])-\n([a-z])/g, '$1$2')
    .split('\n')
    .map((l) => fixAmounts(l));

  const out: string[] = [];
  for (const line of lines) {
    if (!line) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      continue;
    }
    const prev = out[out.length - 1];
    const continues =
      prev !== undefined &&
      prev !== '' &&
      prev.length > 38 &&
      !/[.!?:]$/.test(prev) &&
      !HEADING.test(prev) &&
      !STARTS_ITEM.test(line) &&
      /^[a-z(,]/.test(line);
    if (continues) out[out.length - 1] = `${prev} ${line}`;
    else out.push(line);
  }
  while (out[out.length - 1] === '') out.pop();

  // OCR engines often put a blank line after every printed line; when most lines are spaced
  // like that, keep blank lines only before headings so ingredient lists stay together.
  const filled = out.filter(Boolean).length;
  const blanks = out.length - filled;
  if (filled > 3 && blanks >= filled * 0.5) {
    const compact: string[] = [];
    for (const line of out) {
      if (!line) continue;
      if (compact.length && SECTION_HEADING.test(line)) compact.push('');
      compact.push(line);
    }
    return compact.join('\n');
  }
  return out.join('\n');
}
