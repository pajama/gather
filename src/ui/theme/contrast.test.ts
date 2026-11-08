import { describe, expect, it } from 'vitest';

import { contrastRatio, readableOn } from './contrast';
import { ACCENTS, DARK, LIGHT } from './tokens';

describe('contrast', () => {
  it('computes WCAG ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('keeps colors that already read, and darkens ones that do not', () => {
    expect(readableOn('#1F6FD1', '#FFFFFF')).toBe('#1F6FD1');
    const sky = readableOn('#3D8EF0', '#FFFFFF');
    expect(contrastRatio(sky, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(sky, LIGHT.background)).toBeGreaterThanOrEqual(4.2);
  });

  it('gives every accent and the timer color a readable text shade in both themes', () => {
    for (const accent of ACCENTS) {
      expect(contrastRatio(readableOn(accent.light, LIGHT.surface), LIGHT.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(readableOn(accent.dark, DARK.surface), DARK.surface)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(readableOn(LIGHT.timer, LIGHT.surface), LIGHT.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(readableOn(DARK.timer, DARK.surface), DARK.surface)).toBeGreaterThanOrEqual(4.5);
  });
});
