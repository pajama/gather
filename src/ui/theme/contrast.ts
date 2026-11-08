/**
 * WCAG contrast helpers. Accent and timer colors are bright fills; text in
 * those colors gets a variant adjusted until it reads at 4.5:1 (AA for body
 * text) on the surfaces it sits on.
 */

function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * `color`, or the nearest shade of it (mixed toward black on light
 * backgrounds, toward white on dark ones) that reaches `min` contrast.
 */
export function readableOn(color: string, background: string, min = 4.5): string {
  if (contrastRatio(color, background) >= min) return color.toUpperCase();
  const target: [number, number, number] = relativeLuminance(background) > 0.5 ? [0, 0, 0] : [255, 255, 255];
  const start = channels(color);
  for (let step = 1; step <= 40; step++) {
    const t = step / 40;
    const mixed = toHex([0, 1, 2].map((i) => start[i]! + (target[i]! - start[i]!) * t) as [number, number, number]);
    if (contrastRatio(mixed, background) >= min) return mixed;
  }
  return toHex(target);
}
