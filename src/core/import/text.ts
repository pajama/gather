/**
 * Plain-text recipe import: pasted text, OCR output or a shared note.
 * Uses section markers when present ("Ingredients", "Method") and line
 * shape otherwise.
 */

import { findDurations, parseDurationText } from '../recipe/durations';
import { headingText, isIngredientHeading } from '../recipe/ingredients';
import { parseLeadingQuantity } from '../recipe/quantity';
import { emptyDraft, type DraftSection, type RecipeDraft } from './draft';

type Zone = 'intro' | 'ingredients' | 'steps' | 'notes';

const MARKERS: [Zone, RegExp][] = [
  ['ingredients', /^(?:ingredients?|what you(?:'|’)ll need|you(?:'|’)ll need|you will need|shopping list)\s*:?$/i],
  ['steps', /^(?:directions?|instructions?|method|steps|preparation|how to make(?: it)?|to make)\s*:?$/i],
  ['notes', /^(?:notes?|tips?|cook(?:'|’)s notes?|variations?)\s*:?$/i],
];

const BULLET_OR_NUMBER = /^\s*(?:[-–—*•·▢☐□]|\d+[.)])\s+/;
/** "1. …", "2) …", "Step 3: …" start a step, not an ingredient with an amount of 1. */
const STEP_MARKER = /^\s*(?:step\s*\d+\s*[:.)-]?|\d+\s*[.)])\s+/i;

function zoneFor(line: string): Zone | undefined {
  const cleaned = line.replace(/^#+\s*/, '').trim();
  return MARKERS.find(([, re]) => re.test(cleaned))?.[0];
}

function looksLikeIngredient(line: string): boolean {
  if (STEP_MARKER.test(line)) return false;
  const stripped = line.replace(/^\s*[-–—*•·▢☐□]\s+/, '');
  return stripped.length <= 90 && (!!parseLeadingQuantity(stripped, { words: false }) || /^\s*[-–—*•·▢☐□]\s+/.test(line));
}

/** True when the text is a duration and nothing more ("1 hr 20 mins", "45 minutes", "PT30M"). */
function isOnlyDuration(text: string): boolean {
  if (/^\s*(?:PT?[\dHMS.]+|\d+)\s*$/i.test(text)) return true;
  let rest = text;
  for (const d of findDurations(text).reverse()) rest = rest.slice(0, d.start) + rest.slice(d.end);
  return rest !== text && /^[\s,&+.]*(?:and)?[\s,&+.]*$/i.test(rest);
}

function pushTo(sections: DraftSection[], line: string) {
  if (sections.length === 0) sections.push({ lines: [] });
  sections[sections.length - 1]!.lines.push(line);
}

export function parseRecipeText(input: string): RecipeDraft {
  const lines = input
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim());
  const draft = emptyDraft();
  const ingredients: DraftSection[] = [];
  const steps: DraftSection[] = [];
  const notes: string[] = [];
  const intro: string[] = [];
  const hasMarkers = lines.some((l) => zoneFor(l) === 'ingredients' || zoneFor(l) === 'steps');
  let zone: Zone = 'intro';

  for (const line of lines) {
    if (!line) continue;
    const marker = zoneFor(line);
    if (marker) {
      zone = marker;
      continue;
    }
    if (!draft.name && zone === 'intro') {
      draft.name = line.replace(/^#+\s*/, '');
      continue;
    }
    // Metadata lines are short and say nothing else ("Serves 4", "Prep time: 10 minutes"). A
    // sentence that happens to start with "Cook" or "Makes" is part of the recipe and is kept.
    const meta = /^(serves|servings|yield|yields|makes)\s*:?\s*(.+)$/i.exec(line);
    if (meta && zone !== 'steps' && line.length <= 40) {
      const n = /(\d+)/.exec(meta[2]!);
      if (n) {
        draft.servings = Number(n[1]);
        draft.yieldText = line;
        continue;
      }
    }
    const time = /^(prep|cook|cooking|total)(\s*time)?\s*([:\-–])?\s*(.+)$/i.exec(line);
    if (time && zone !== 'steps' && (time[2] || time[3]) && isOnlyDuration(time[4]!)) {
      const secs = parseDurationText(time[4]!);
      if (secs) {
        const kind = time[1]!.toLowerCase();
        if (kind === 'prep') draft.prepSeconds = secs;
        else if (kind === 'total') draft.totalSeconds = secs;
        else draft.cookSeconds = secs;
        continue;
      }
    }

    let target: Zone = zone;
    if (!hasMarkers && zone === 'intro') target = looksLikeIngredient(line) ? 'ingredients' : line.length > 60 || BULLET_OR_NUMBER.test(line) ? 'steps' : 'intro';
    if (!hasMarkers && zone === 'ingredients' && (STEP_MARKER.test(line) || (!looksLikeIngredient(line) && line.length > 60))) target = 'steps';
    if (!hasMarkers) zone = target === 'intro' ? zone : target;

    switch (target) {
      case 'ingredients':
        if (isIngredientHeading(line)) ingredients.push({ title: headingText(line), lines: [] });
        else pushTo(ingredients, line.replace(/^\s*[-–—*•·▢☐□]\s+/, ''));
        break;
      case 'steps': {
        const isHeading = /:$/.test(line) && line.length <= 50;
        if (isHeading) steps.push({ title: headingText(line), lines: [] });
        else pushTo(steps, line.replace(/^\s*(?:step\s*)?\d+[.):]?\s+/i, '').replace(/^\s*[-–—*•·]\s+/, ''));
        break;
      }
      case 'notes':
        notes.push(line);
        break;
      default:
        intro.push(line);
    }
  }

  draft.ingredients = ingredients.filter((s) => s.lines.length > 0);
  draft.steps = steps.filter((s) => s.lines.length > 0);
  if (intro.length) draft.description = intro.join(' ');
  if (notes.length) draft.notes = notes.join('\n');
  if (!draft.name) draft.name = 'Untitled recipe';
  return draft;
}
