/**
 * Recipe extraction from web pages: schema.org Recipe JSON-LD first, then
 * microdata, which together cover almost every recipe site.
 */

import { parseDurationText } from '../recipe/durations';
import { emptyDraft, normalizeDraft, NUTRITION_KEYS, type DraftSection, type RecipeDraft } from './draft';
import {
  cleanText,
  decodeEntities,
  getMetaContent,
  getTitle,
  hostLabel,
  htmlToText,
  resolveUrl,
} from './html';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

const isObject = (v: Json | undefined): v is JsonObject => !!v && typeof v === 'object' && !Array.isArray(v);
const asArray = (v: Json | undefined): Json[] =>
  v === undefined || v === null ? [] : Array.isArray(v) ? v : [v];

function typesOf(node: JsonObject): string[] {
  return asArray(node['@type'])
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.replace(/^https?:\/\/schema\.org\//, ''));
}

/** Parses a JSON-LD block, tolerating the invalid JSON some sites ship (raw newlines, comments). */
export function parseJsonLd(raw: string): Json | undefined {
  const text = raw
    .replace(/^\s*<!--/, '')
    .replace(/-->\s*$/, '')
    .replace(/^\s*\/\/<!\[CDATA\[/, '')
    .replace(/\/\/\]\]>\s*$/, '')
    .trim();
  try {
    return JSON.parse(text) as Json;
  } catch {
    try {
      return JSON.parse(text.replace(/[\u0000-\u001f]+/g, ' ')) as Json;
    } catch {
      return undefined;
    }
  }
}

export function findJsonLdBlocks(html: string): Json[] {
  const blocks: Json[] = [];
  const re = /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const parsed = parseJsonLd(m[1] ?? '');
    if (parsed !== undefined) blocks.push(parsed);
  }
  return blocks;
}

/** Depth-first search for Recipe nodes, through arrays, @graph, mainEntity and item lists. */
export function findRecipeNodes(root: Json, depth = 0): JsonObject[] {
  if (depth > 8 || root === null || typeof root !== 'object') return [];
  if (Array.isArray(root)) return root.flatMap((n) => findRecipeNodes(n, depth + 1));
  if (typesOf(root).includes('Recipe')) return [root];
  const found: JsonObject[] = [];
  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item', 'about']) {
    if (root[key] !== undefined) found.push(...findRecipeNodes(root[key]!, depth + 1));
  }
  return found;
}

function textOf(v: Json | undefined): string {
  if (typeof v === 'string') return cleanText(v);
  if (typeof v === 'number') return String(v);
  if (isObject(v)) return textOf(v.name ?? v.text ?? v['@value']);
  if (Array.isArray(v)) return textOf(v[0]);
  return '';
}

function stringList(v: Json | undefined): string[] {
  return asArray(v)
    .flatMap((item) => (typeof item === 'string' ? item.split(/\s*,\s*/) : [textOf(item)]))
    .map((s) => cleanText(s))
    .filter(Boolean);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function images(v: Json | undefined, base?: string): string[] {
  const urls: string[] = [];
  for (const item of asArray(v)) {
    if (typeof item === 'string') urls.push(item);
    else if (isObject(item)) {
      const url = item.url ?? item.contentUrl ?? item['@id'];
      if (typeof url === 'string') urls.push(url);
      else if (Array.isArray(url)) urls.push(...images(url, base));
    }
  }
  return unique(urls.filter((u) => /^(https?:)?\/\/|^\//.test(u)).map((u) => resolveUrl(u, base)));
}

function personName(v: Json | undefined): string | undefined {
  for (const item of asArray(v)) {
    const name = typeof item === 'string' ? cleanText(item) : isObject(item) ? textOf(item.name) : '';
    if (name) return name;
  }
  return undefined;
}

/** Splits a single instructions string into steps: by line, or by inline "1. … 2. …" numbering. */
export function splitInstructionText(text: string): string[] {
  const plain = htmlToText(text);
  const lines = plain
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(?:step\s*)?\d+[.):]\s+/i, '').trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;
  const numbered = plain
    .split(/\s(?=\d{1,2}[.)]\s+[A-Z])/)
    .map((s) => s.replace(/^\d{1,2}[.)]\s+/, '').trim());
  return numbered.filter(Boolean).length > 1 ? numbered.filter(Boolean) : lines;
}

function instructionSections(v: Json | undefined): DraftSection[] {
  const sections: DraftSection[] = [];
  let current: DraftSection = { lines: [] };
  const pushLine = (line: string) => {
    const text = line.trim();
    if (text) current.lines.push(text);
  };
  const visit = (item: Json) => {
    if (typeof item === 'string') {
      splitInstructionText(item).forEach(pushLine);
      return;
    }
    if (!isObject(item)) return;
    const types = typesOf(item);
    if (types.includes('HowToSection') || (item.itemListElement !== undefined && !item.text)) {
      if (current.lines.length || current.title) sections.push(current);
      current = { title: textOf(item.name) || undefined, lines: [] };
      asArray(item.itemListElement).forEach(visit);
      sections.push(current);
      current = { lines: [] };
      return;
    }
    const text = textOf(item.text) || textOf(item.description) || textOf(item.name);
    if (text) splitInstructionText(text).forEach(pushLine);
  };
  asArray(v).forEach(visit);
  if (current.lines.length) sections.push(current);
  return sections.filter((s) => s.lines.length > 0);
}

function servingsFrom(v: Json | undefined): { servings?: number; yieldText?: string } {
  const texts = asArray(v)
    .map((item) => (typeof item === 'number' ? String(item) : textOf(item)))
    .filter(Boolean);
  let servings: number | undefined;
  for (const t of texts) {
    const m = /(\d+(?:\.\d+)?)/.exec(t);
    if (m) {
      servings = Number(m[1]);
      break;
    }
  }
  const descriptive = texts.find((t) => /[a-z]/i.test(t)) ?? texts[0];
  return { ...(servings ? { servings } : {}), ...(descriptive ? { yieldText: descriptive } : {}) };
}

function seconds(v: Json | undefined): number | undefined {
  const s = parseDurationText(textOf(v));
  return s && s > 0 ? s : undefined;
}

export function recipeFromJsonLd(node: JsonObject, pageUrl?: string): RecipeDraft {
  const draft = emptyDraft(textOf(node.name) || textOf(node.headline));
  const description = textOf(node.description);
  if (description) draft.description = description;
  const url = typeof node.url === 'string' ? resolveUrl(node.url, pageUrl) : pageUrl;
  if (url) draft.sourceUrl = url;
  const author = personName(node.author);
  if (author) draft.author = author;
  const publisher = personName(node.publisher);
  draft.sourceName = publisher ?? hostLabel(url);
  draft.imageUrls = images(node.image, pageUrl);
  Object.assign(draft, servingsFrom(node.recipeYield ?? node.yield));
  const prep = seconds(node.prepTime);
  const cook = seconds(node.cookTime);
  const total = seconds(node.totalTime);
  if (prep) draft.prepSeconds = prep;
  if (cook) draft.cookSeconds = cook;
  if (total) draft.totalSeconds = total;
  else if (prep || cook) draft.totalSeconds = (prep ?? 0) + (cook ?? 0);

  const ingredientLines = asArray(node.recipeIngredient ?? node.ingredients)
    .flatMap((i) => (typeof i === 'string' ? htmlToText(i).split('\n') : [textOf(i)]))
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (ingredientLines.length) draft.ingredients = [{ lines: ingredientLines }];
  draft.steps = instructionSections(node.recipeInstructions);

  if (isObject(node.nutrition)) {
    const nutrition: RecipeDraft['nutrition'] = {};
    for (const key of NUTRITION_KEYS) {
      const value = textOf(node.nutrition[key]);
      if (value) nutrition[key] = value;
    }
    if (Object.keys(nutrition).length) draft.nutrition = nutrition;
  }
  draft.tags = unique(stringList(node.keywords));
  draft.categories = unique(stringList(node.recipeCategory));
  draft.cuisines = unique(stringList(node.recipeCuisine));
  return draft;
}

/** Microdata fallback for older sites: itemprop="recipeIngredient" etc. */
export function recipeFromMicrodata(html: string, pageUrl?: string): RecipeDraft | undefined {
  if (!/itemtype\s*=\s*["']https?:\/\/schema\.org\/Recipe["']/i.test(html)) return undefined;
  const props = (name: string): string[] => {
    const out: string[] = [];
    const re = new RegExp(
      `<([a-z0-9]+)[^>]*itemprop\\s*=\\s*["'][^"']*\\b${name}\\b[^"']*["'][^>]*?(?:content\\s*=\\s*["']([^"']*)["'][^>]*)?>([\\s\\S]*?)<\\/\\1>`,
      'gi',
    );
    for (let m = re.exec(html); m; m = re.exec(html))
      out.push(m[2] !== undefined ? decodeEntities(m[2]) : htmlToText(m[3] ?? ''));
    const selfClosing = new RegExp(`<(?:meta|img|link)[^>]*itemprop\\s*=\\s*["']${name}["'][^>]*>`, 'gi');
    for (let m = selfClosing.exec(html); m; m = selfClosing.exec(html)) {
      const attr = /(?:content|src|href)\s*=\s*["']([^"']*)["']/i.exec(m[0]);
      if (attr?.[1]) out.push(decodeEntities(attr[1]));
    }
    return out.map((s) => s.trim()).filter(Boolean);
  };
  const draft = emptyDraft(props('name')[0] ?? getTitle(html) ?? '');
  const ingredients = [...props('recipeIngredient'), ...props('ingredients')]
    .flatMap((l) => l.split('\n'))
    .filter(Boolean);
  if (ingredients.length) draft.ingredients = [{ lines: ingredients }];
  const steps = props('recipeInstructions').flatMap(splitInstructionText);
  if (steps.length) draft.steps = [{ lines: steps }];
  Object.assign(draft, servingsFrom(props('recipeYield')[0]));
  const prep = seconds(props('prepTime')[0]);
  const cook = seconds(props('cookTime')[0]);
  const total = seconds(props('totalTime')[0]);
  if (prep) draft.prepSeconds = prep;
  if (cook) draft.cookSeconds = cook;
  if (total) draft.totalSeconds = total;
  draft.imageUrls = unique(props('image').map((u) => resolveUrl(u, pageUrl)));
  if (pageUrl) draft.sourceUrl = pageUrl;
  draft.sourceName = hostLabel(pageUrl);
  return draft.ingredients.length || draft.steps.length ? draft : undefined;
}

/** All recipes found on a page, best candidates first. */
export function extractRecipesFromHtml(html: string, pageUrl?: string): RecipeDraft[] {
  const drafts = findJsonLdBlocks(html)
    .flatMap((block) => findRecipeNodes(block))
    .map((node) => recipeFromJsonLd(node, pageUrl));
  if (drafts.length === 0) {
    const micro = recipeFromMicrodata(html, pageUrl);
    if (micro) drafts.push(micro);
  }
  const siteName = getMetaContent(html, 'og:site_name');
  const ogImage = getMetaContent(html, 'og:image');
  for (const draft of drafts) {
    if (siteName) draft.sourceName = siteName;
    if (!draft.name) draft.name = getMetaContent(html, 'og:title') ?? getTitle(html) ?? 'Untitled recipe';
    if (draft.imageUrls.length === 0 && ogImage) draft.imageUrls = [resolveUrl(ogImage, pageUrl)];
  }
  const score = (d: RecipeDraft) =>
    d.ingredients.reduce((n, s) => n + s.lines.length, 0) * 2 + d.steps.length;
  return drafts.map(normalizeDraft).sort((a, b) => score(b) - score(a));
}
