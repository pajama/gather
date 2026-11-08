import { describe, expect, it } from 'vitest';

import { findDurations, formatClock, formatDuration, parseDurationText, parseIsoDuration } from './durations';
import { findIngredientMentions, mentionPhrases, segmentText } from './mentions';
import { convertTemperatures } from './temperature';

describe('durations', () => {
  it('finds simple durations', () => {
    const [d] = findDurations('Bake for 25 minutes until golden.');
    expect(d).toMatchObject({ text: '25 minutes', seconds: 1500 });
  });

  it('finds ranges and compounds', () => {
    expect(findDurations('Simmer 25-30 mins.')[0]).toMatchObject({ seconds: 1500, maxSeconds: 1800 });
    expect(findDurations('Roast for 1 hour 30 minutes')[0]).toMatchObject({
      seconds: 5400,
      text: '1 hour 30 minutes',
    });
    expect(findDurations('Rest 1 hr and 15 min')[0]).toMatchObject({ seconds: 4500 });
    expect(findDurations('Chill for 1½ hours')[0]).toMatchObject({ seconds: 5400 });
    expect(findDurations('Cook 2 to 3 minutes per side')[0]).toMatchObject({ seconds: 120, maxSeconds: 180 });
    expect(findDurations('Let it rise for an hour')[0]).toMatchObject({ seconds: 3600 });
    expect(findDurations('Let it rest for half an hour')[0]).toMatchObject({ seconds: 1800 });
    expect(findDurations('Microwave 30s')[0]).toMatchObject({ seconds: 30 });
  });

  it('reads mixed numbers whole', () => {
    expect(findDurations('Braise 1 1/2 hours')[0]).toMatchObject({ seconds: 5400, text: '1 1/2 hours' });
    expect(findDurations('Rest 2 1/2 minutes')[0]).toMatchObject({ seconds: 150 });
    expect(findDurations('Bake 1-1/2 hours')[0]).toMatchObject({ seconds: 5400 });
    expect(findDurations('Simmer 1 1/2-2 hours')[0]).toMatchObject({ seconds: 5400, maxSeconds: 7200 });
    expect(findDurations('Rise 1-2 hours')[0]).toMatchObject({ seconds: 3600, maxSeconds: 7200 });
    expect(parseDurationText('1 1/2 hours')).toBe(5400);
  });

  it('finds several durations in one step', () => {
    const found = findDurations('Boil for 10 minutes, then simmer for 20 minutes.');
    expect(found.map((d) => d.seconds)).toEqual([600, 1200]);
  });

  it('ignores non-durations', () => {
    expect(findDurations('Use a 9x13 pan and 2 cups of milk')).toEqual([]);
    expect(findDurations('Add 5 m of string')).toEqual([]);
  });

  it('parses ISO and text metadata', () => {
    expect(parseIsoDuration('PT1H30M')).toBe(5400);
    expect(parseIsoDuration('PT90M')).toBe(5400);
    expect(parseIsoDuration('P1DT2H')).toBe(93600);
    expect(parseIsoDuration('PT')).toBeNull();
    expect(parseDurationText('1 hr 20 mins')).toBe(4800);
    expect(parseDurationText('45')).toBe(2700);
  });

  it('formats', () => {
    expect(formatDuration(5400)).toBe('1 hr 30 min');
    expect(formatDuration(2700, 'long')).toBe('45 minutes');
    expect(formatDuration(4500, 'compact')).toBe('1h 15m');
    expect(formatDuration(2700, 'compact')).toBe('45m');
    expect(formatClock(245)).toBe('4:05');
    expect(formatClock(3750)).toBe('1:02:30');
  });
});

describe('ingredient mentions', () => {
  const ingredients = [
    { id: 'flour', name: 'all-purpose flour' },
    { id: 'brown', name: 'brown sugar' },
    { id: 'white', name: 'granulated sugar' },
    { id: 'oil', name: 'extra virgin olive oil' },
    { id: 'eggs', name: 'large eggs' },
    { id: 'tomato', name: 'ripe tomatoes' },
  ];

  it('builds phrases from names', () => {
    expect(mentionPhrases('extra virgin olive oil')).toEqual(
      expect.arrayContaining(['virgin olive oil', 'olive oil', 'oil']),
    );
    expect(mentionPhrases('large eggs')).toEqual(expect.arrayContaining(['eggs', 'egg']));
    expect(mentionPhrases('fresh thyme leaves')).toEqual(expect.arrayContaining(['thyme leaves', 'thyme']));
    expect(mentionPhrases('fresh thyme leaves')).not.toContain('leaves');
  });

  it('finds mentions, preferring longer phrases and skipping ambiguous ones', () => {
    const text = 'Whisk the flour, brown sugar and sugar. Add the egg and the olive oil, then the tomato.';
    const found = findIngredientMentions(text, ingredients);
    expect(found.map((m) => [m.text, m.ingredientId])).toEqual([
      ['flour', 'flour'],
      ['brown sugar', 'brown'],
      ['egg', 'eggs'],
      ['olive oil', 'oil'],
      ['tomato', 'tomato'],
    ]);
  });

  it('segments text', () => {
    const text = 'Add flour and bake 10 minutes';
    const segments = segmentText(text, [
      { start: 4, end: 9, ingredientId: 'flour' },
      { start: 19, end: 29, seconds: 600 },
    ]);
    expect(segments.map((s) => s.kind)).toEqual(['text', 'ingredient', 'text', 'duration']);
  });
});

describe('temperatures', () => {
  it('converts oven and food temperatures for the reader', () => {
    expect(convertTemperatures('Heat the oven to 425°F.', 'metric')).toBe('Heat the oven to 220°C.');
    expect(convertTemperatures('Bake at 350 degrees F until set', 'metric')).toBe('Bake at 180°C until set');
    expect(convertTemperatures('Roast until it reaches 165°F', 'metric')).toBe('Roast until it reaches 74°C');
    expect(convertTemperatures('Preheat to 350F', 'metric')).toBe('Preheat to 180°C');
    expect(convertTemperatures('Bake at 375-400°F', 'metric')).toBe('Bake at 190–200°C');
    expect(convertTemperatures('Heat the oven to 180°C (160°C fan)', 'us')).toBe(
      'Heat the oven to 350°F (325°F fan)',
    );
    expect(convertTemperatures('Cook to 74 degrees Celsius', 'us')).toBe('Cook to 165°F');
  });

  it('leaves text alone when written in the reader’s units or shown as written', () => {
    expect(convertTemperatures('Heat the oven to 425°F.', 'us')).toBe('Heat the oven to 425°F.');
    expect(convertTemperatures('Heat the oven to 425°F.', 'original')).toBe('Heat the oven to 425°F.');
    expect(convertTemperatures('Use 2 cups of flour and 3 eggs', 'metric')).toBe(
      'Use 2 cups of flour and 3 eggs',
    );
  });
});
