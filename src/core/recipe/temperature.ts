/**
 * Temperatures in step text, shown in the reader's units: "Heat the oven to
 * 425°F" reads "220°C" in metric, rounded the way ovens and recipes do.
 */

import type { UnitPreference } from '../model/types';

// "425°F", "425 °F", "425 degrees F", "350-375°F", "180 degrees Celsius", and the bare "350F".
const TEMPERATURE =
  /\b(\d{2,3})(?:\s*(?:-|–|to)\s*(\d{2,3}))?\s*(?:°\s*|º\s*|degrees?\s+)(fahrenheit|celsius|centigrade|f|c)\b|\b(\d{3})(f|c)\b/gi;

function toCelsius(f: number): number {
  const c = ((f - 32) * 5) / 9;
  // Oven settings in tens (350°F -> 180°C); food temperatures to the degree (165°F -> 74°C).
  return c >= 100 ? Math.round(c / 10) * 10 : Math.round(c);
}

function toFahrenheit(c: number): number {
  const f = (c * 9) / 5 + 32;
  // Oven dials step in 25s (180°C -> 350°F); food temperatures to the degree (74°C -> 165°F).
  return f >= 250 ? Math.round(f / 25) * 25 : Math.round(f);
}

/** Rewrites temperatures in `text` for `units`; 'original' leaves the text as written. */
export function convertTemperatures(text: string, units: UnitPreference): string {
  if (units === 'original') return text;
  return text.replace(TEMPERATURE, (match, low: string | undefined, high: string | undefined, scale: string | undefined, bare: string | undefined, bareScale: string | undefined) => {
    const from = (scale ?? bareScale ?? '').toLowerCase().startsWith('f') ? 'F' : 'C';
    const target = units === 'metric' ? 'C' : 'F';
    if (from === target) return match;
    const convert = target === 'C' ? toCelsius : toFahrenheit;
    const first = convert(Number(low ?? bare));
    return high ? `${first}–${convert(Number(high))}°${target}` : `${first}°${target}`;
  });
}
