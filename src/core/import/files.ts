/**
 * Recipe files from other apps and from Gather itself:
 * - Crouton: `.crumb` (JSON, one recipe) and zips of them
 * - Paprika: `.paprikarecipes` (zip of gzipped JSON) and `.paprikarecipe`
 * - Gather: `.gather` / `.json` single-recipe or multi-recipe files
 * - Web pages saved as `.html` and plain `.txt` recipes
 *
 * Everything becomes `RecipeDraft`s; the app decides what to save.
 */

import { gunzipSync, strFromU8, unzipSync } from 'fflate';

import { parseDurationText } from '../recipe/durations';
import { draftFromCrumb, isCrumb } from './crumb';
import { emptyDraft, normalizeDraft, type DraftSection, type RecipeDraft } from './draft';
import { parseRecipeText } from './text';
import { extractRecipesFromHtml } from './web';

export interface ImportedFile {
  drafts: RecipeDraft[];
  /** Human-readable format name ("Paprika"). */
  format: string;
  /** Entries that could not be read, with a reason. */
  skipped: string[];
}

const HEADING = /^(.{1,60}):\s*$/;

/** Splits newline-separated text into sections, starting a new one at "Heading:" lines. */
export function linesToSections(text: string | undefined, stripNumbers = false): DraftSection[] {
  if (!text) return [];
  const sections: DraftSection[] = [];
  let current: DraftSection = { lines: [] };
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    let line = raw.replace(/\s+/g, ' ').trim();
    if (!line) continue;
    const heading = HEADING.exec(line);
    if (heading && !/\d/.test(line.slice(0, 2))) {
      if (current.lines.length || current.title) sections.push(current);
      current = { title: heading[1]!.trim(), lines: [] };
      continue;
    }
    if (stripNumbers) line = line.replace(/^(?:step\s*)?\d+[.):]\s+/i, '');
    current.lines.push(line);
  }
  if (current.lines.length || current.title) sections.push(current);
  return sections.filter((s) => s.lines.length > 0);
}

interface PaprikaRecipe {
  name?: string;
  description?: string;
  ingredients?: string;
  directions?: string;
  notes?: string;
  nutritional_info?: string;
  servings?: string | number;
  prep_time?: string;
  cook_time?: string;
  total_time?: string;
  source?: string;
  source_url?: string;
  image_url?: string;
  photo_data?: string;
  categories?: string[];
  rating?: number;
}

export function draftFromPaprika(p: PaprikaRecipe): RecipeDraft {
  const draft = emptyDraft((p.name ?? '').trim() || 'Untitled recipe');
  if (p.description?.trim()) draft.description = p.description.trim();
  draft.ingredients = linesToSections(p.ingredients);
  draft.steps = linesToSections(p.directions, true);
  const notes = [p.notes?.trim(), p.nutritional_info?.trim() ? `Nutrition: ${p.nutritional_info.trim()}` : undefined].filter(Boolean);
  if (notes.length) draft.notes = notes.join('\n\n');
  const servings = /(\d+(?:\.\d+)?)/.exec(String(p.servings ?? ''));
  if (servings) draft.servings = Number(servings[1]);
  if (p.servings && /[a-z]/i.test(String(p.servings))) draft.yieldText = String(p.servings);
  const prep = parseDurationText(p.prep_time);
  const cook = parseDurationText(p.cook_time);
  const total = parseDurationText(p.total_time);
  if (prep) draft.prepSeconds = prep;
  if (cook) draft.cookSeconds = cook;
  if (total) draft.totalSeconds = total;
  if (p.source?.trim()) draft.sourceName = p.source.trim();
  if (p.source_url?.trim()) draft.sourceUrl = p.source_url.trim();
  if (p.photo_data) draft.imageUrls = [`data:image/jpeg;base64,${p.photo_data}`];
  else if (p.image_url && /^https?:\/\//.test(p.image_url)) draft.imageUrls = [p.image_url];
  draft.tags = (p.categories ?? []).map((c) => c.trim()).filter(Boolean);
  if (typeof p.rating === 'number' && p.rating > 0) draft.rating = p.rating;
  return draft;
}

function isGzip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x1f && bytes[1] === 0x8b;
}

function isZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function readPaprikaEntry(bytes: Uint8Array): RecipeDraft {
  const json = strFromU8(isGzip(bytes) ? gunzipSync(bytes) : bytes);
  return draftFromPaprika(JSON.parse(json) as PaprikaRecipe);
}

export interface GatherRecipeFile {
  format: 'gather-recipes';
  version: 1;
  recipes: RecipeDraft[];
}

export function toGatherFile(drafts: RecipeDraft[]): GatherRecipeFile {
  return { format: 'gather-recipes', version: 1, recipes: drafts };
}

/**
 * Reads any supported recipe file. `name` is used for its extension. Every
 * draft is normalized (types checked, links http(s) only), so a malformed or
 * hostile file cannot put bad data into the library.
 */
export function readRecipeFile(name: string, bytes: Uint8Array): ImportedFile {
  const file = readRawRecipeFile(name, bytes);
  return { ...file, drafts: file.drafts.map(normalizeDraft) };
}

function readRawRecipeFile(name: string, bytes: Uint8Array): ImportedFile {
  const lower = name.toLowerCase();
  const skipped: string[] = [];

  if (lower.endsWith('.paprikarecipes') || isZip(bytes)) {
    const entries = unzipSync(bytes);
    const drafts: RecipeDraft[] = [];
    let crumbs = 0;
    for (const [entryName, data] of Object.entries(entries)) {
      if (entryName.endsWith('/') || entryName.startsWith('__MACOSX') || /(^|\/)\./.test(entryName)) continue;
      try {
        if (entryName.toLowerCase().endsWith('.crumb')) {
          drafts.push(draftFromCrumb(JSON.parse(strFromU8(data)) as never));
          crumbs++;
        } else drafts.push(readPaprikaEntry(data));
      } catch {
        skipped.push(entryName);
      }
    }
    return { drafts, format: crumbs > drafts.length / 2 ? 'Crouton' : 'Paprika', skipped };
  }

  if (lower.endsWith('.paprikarecipe') || isGzip(bytes)) {
    return { drafts: [readPaprikaEntry(bytes)], format: 'Paprika', skipped };
  }

  const text = strFromU8(bytes);
  const namedJson = lower.endsWith('.json') || lower.endsWith('.gather') || lower.endsWith('.crumb');
  let parsed: unknown;
  if (namedJson || /^\s*[[{]/.test(text)) {
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      // "[Grandma] Pie" in a .txt starts like JSON but isn't.
      if (namedJson) throw error;
    }
  }
  if (parsed !== undefined) {
    if (Array.isArray(parsed) && parsed.length && parsed.every(isCrumb)) return { drafts: parsed.map(draftFromCrumb), format: 'Crouton', skipped };
    if (isCrumb(parsed) && (lower.endsWith('.crumb') || !('directions' in parsed))) return { drafts: [draftFromCrumb(parsed)], format: 'Crouton', skipped };
    const data = parsed as Partial<GatherRecipeFile> & PaprikaRecipe;
    if (data.format === 'gather-recipes' && Array.isArray(data.recipes)) return { drafts: data.recipes, format: 'Gather', skipped };
    if (typeof data.name === 'string' && (data.ingredients !== undefined || data.directions !== undefined)) {
      return { drafts: [draftFromPaprika(data)], format: 'Paprika', skipped };
    }
    throw new Error('This JSON file is not a recipe file Gather knows.');
  }

  if (lower.endsWith('.html') || lower.endsWith('.htm') || /<html|<script[^>]+ld\+json/i.test(text.slice(0, 5000))) {
    return { drafts: extractRecipesFromHtml(text), format: 'Web page', skipped };
  }

  return { drafts: [parseRecipeText(text)], format: 'Text', skipped };
}
