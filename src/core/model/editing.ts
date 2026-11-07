/**
 * Text round-tripping for the recipe editor: one ingredient or step per
 * line, with "Heading:" lines starting a new section. Ids are reused for
 * unchanged lines so edits do not churn identities.
 */

import { newId } from './recipe';
import type { IngredientSection, StepSection } from './types';

interface Section<T> {
  id: string;
  title?: string;
  items: T[];
}

const HEADING = /^(?:#{1,6}\s+)?(.{1,60}):\s*$/;

function sectionsToText<T extends { text: string }>(sections: Section<T>[]): string {
  const lines: string[] = [];
  sections.forEach((section, index) => {
    if (section.title) {
      if (index > 0) lines.push('');
      lines.push(`${section.title}:`);
    }
    for (const item of section.items) lines.push(item.text);
  });
  return lines.join('\n');
}

function textToSections<T extends { id: string; text: string }>(
  text: string,
  previous: Section<T>[],
  make: (id: string, text: string) => T,
  stripNumbers: boolean,
): Section<T>[] {
  const reuse = new Map<string, string[]>();
  for (const section of previous)
    for (const item of section.items) {
      const ids = reuse.get(item.text) ?? [];
      ids.push(item.id);
      reuse.set(item.text, ids);
    }
  const takeId = (line: string) => reuse.get(line)?.shift() ?? newId();

  const sections: Section<T>[] = [];
  let current: Section<T> = { id: previous[0]?.id ?? newId(), items: [] };
  for (const raw of text.split('\n')) {
    let line = raw.replace(/\s+/g, ' ').trim();
    if (!line) continue;
    const heading = HEADING.exec(line);
    if (heading) {
      if (current.items.length || current.title) sections.push(current);
      const title = heading[1]!.trim();
      current = { id: previous.find((s) => s.title === title)?.id ?? newId(), title, items: [] };
      continue;
    }
    if (stripNumbers) line = line.replace(/^(?:step\s*)?\d+[.):]\s+/i, '');
    current.items.push(make(takeId(line), line));
  }
  if (current.items.length || current.title) sections.push(current);
  return sections;
}

export function ingredientsToText(sections: IngredientSection[]): string {
  return sectionsToText(sections);
}

export function stepsToText(sections: StepSection[]): string {
  return sectionsToText(sections);
}

export function textToIngredients(text: string, previous: IngredientSection[] = []): IngredientSection[] {
  return textToSections(text, previous, (id, line) => ({ id, text: line }), false);
}

export function textToSteps(text: string, previous: StepSection[] = []): StepSection[] {
  return textToSections(text, previous, (id, line) => ({ id, text: line }), true);
}

/** "15" -> 900 seconds; "1:30" -> 5400; "" -> undefined. */
export function minutesFieldToSeconds(value: string): number | undefined {
  const text = value.trim();
  if (!text) return undefined;
  const clock = /^(\d+):(\d{1,2})$/.exec(text);
  if (clock) return Number(clock[1]) * 3600 + Number(clock[2]) * 60;
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : undefined;
}

export function secondsToMinutesField(seconds: number | undefined): string {
  return seconds ? String(Math.round(seconds / 60)) : '';
}
