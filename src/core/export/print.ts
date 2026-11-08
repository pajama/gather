/**
 * A printable, self-contained HTML rendering of a recipe (print, PDF,
 * "share as document"). Pure string building so it runs on every platform.
 */

import { totalSeconds } from '../model/recipe';
import type { Recipe, UnitPreference } from '../model/types';
import { formatDuration } from '../recipe/durations';
import { formatIngredient, parseIngredient } from '../recipe/ingredients';
import { formatNumber } from '../recipe/quantity';

export interface PrintOptions {
  scale?: number;
  units?: UnitPreference;
  /** Cover image URL (http(s) or data:); omitted when undefined. */
  imageUrl?: string;
  includeNotes?: boolean;
  accentColor?: string;
}

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
  );
}

export function recipeToHtml(recipe: Recipe, options: PrintOptions = {}): string {
  const scale = options.scale ?? 1;
  const accent = options.accentColor ?? '#E8553D';
  const meta: string[] = [];
  if (recipe.servings) meta.push(`Serves ${formatNumber(recipe.servings * scale)}`);
  if (recipe.prepSeconds) meta.push(`Prep ${formatDuration(recipe.prepSeconds)}`);
  if (recipe.cookSeconds) meta.push(`Cook ${formatDuration(recipe.cookSeconds)}`);
  const total = totalSeconds(recipe);
  if (total) meta.push(`Total ${formatDuration(total)}`);

  const ingredients = recipe.ingredients
    .map((section) => {
      const items = section.items
        .map((item) => {
          const f = formatIngredient(parseIngredient(item.text), {
            scale,
            system: options.units ?? 'original',
          });
          const amount = f.amount ? `<strong>${escapeHtml(f.amount)}</strong> ` : '';
          const note = f.note ? `<span class="note">, ${escapeHtml(f.note)}</span>` : '';
          return `<li>${amount}${escapeHtml(f.name)}${note}</li>`;
        })
        .join('');
      return `${section.title ? `<h3>${escapeHtml(section.title)}</h3>` : ''}<ul>${items}</ul>`;
    })
    .join('');

  const steps = recipe.steps
    .map((section) => {
      const items = section.items.map((item) => `<li>${escapeHtml(item.text)}</li>`).join('');
      return `${section.title ? `<h3>${escapeHtml(section.title)}</h3>` : ''}<ol>${items}</ol>`;
    })
    .join('');

  const source = recipe.sourceUrl
    ? `<a href="${escapeHtml(recipe.sourceUrl)}">${escapeHtml(recipe.sourceName ?? recipe.sourceUrl)}</a>`
    : recipe.sourceName
      ? escapeHtml(recipe.sourceName)
      : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(recipe.name)}</title>
<style>
  @page { margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font: 11.5pt/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1d1b18; margin: 0; }
  header { display: flex; gap: 20px; align-items: flex-start; margin-bottom: 18px; }
  header img { width: 38%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 12px; }
  h1 { font-size: 24pt; line-height: 1.15; margin: 0 0 6px; }
  .source { color: ${accent}; font-weight: 600; margin: 0 0 8px; }
  .source a { color: inherit; text-decoration: none; }
  .description { color: #5c564f; margin: 0 0 8px; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 14px; color: #5c564f; font-size: 10pt; font-weight: 600; }
  main { display: grid; grid-template-columns: 2fr 3fr; gap: 28px; }
  h2 { font-size: 13pt; text-transform: uppercase; letter-spacing: .06em; color: ${accent}; border-bottom: 2px solid ${accent}; padding-bottom: 4px; margin: 0 0 10px; }
  h3 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: .04em; color: #7a736b; margin: 14px 0 6px; }
  ul { list-style: none; padding: 0; margin: 0; }
  ul li { padding: 4px 0; border-bottom: 1px solid #ece8e1; }
  ul li strong { color: ${accent}; }
  .note { color: #7a736b; }
  ol { padding-left: 1.3em; margin: 0; }
  ol li { margin: 0 0 10px; padding-left: 4px; }
  ol li::marker { color: ${accent}; font-weight: 700; }
  .notes { margin-top: 22px; padding: 12px 14px; background: #f6f3ee; border-radius: 10px; white-space: pre-wrap; }
  footer { margin-top: 24px; color: #a39b91; font-size: 9pt; }
  @media (max-width: 560px) { header { flex-direction: column; } header img { width: 100%; } main { grid-template-columns: 1fr; } }
</style></head>
<body>
<header>
  ${options.imageUrl ? `<img src="${escapeHtml(options.imageUrl)}" alt="">` : ''}
  <div>
    <h1>${escapeHtml(recipe.name)}</h1>
    ${source ? `<p class="source">${source}${recipe.author ? ` · ${escapeHtml(recipe.author)}` : ''}</p>` : ''}
    ${recipe.description ? `<p class="description">${escapeHtml(recipe.description)}</p>` : ''}
    ${meta.length ? `<div class="meta">${meta.map((m) => `<span>${escapeHtml(m)}</span>`).join('')}</div>` : ''}
  </div>
</header>
<main>
  <section><h2>Ingredients</h2>${ingredients || '<p>No ingredients.</p>'}</section>
  <section><h2>Method</h2>${steps || '<p>No steps.</p>'}</section>
</main>
${options.includeNotes !== false && recipe.notes ? `<div class="notes"><strong>Notes</strong>\n${escapeHtml(recipe.notes)}</div>` : ''}
<footer>Printed from Gather</footer>
</body></html>`;
}
