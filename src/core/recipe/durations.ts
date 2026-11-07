/**
 * Durations in recipe text: finding "bake for 25-30 minutes" so a step can
 * offer a timer, and parsing schema.org ISO 8601 durations ("PT1H30M").
 */

export interface DurationMatch {
  start: number;
  end: number;
  text: string;
  /** Lower (or only) duration in seconds. */
  seconds: number;
  /** Upper duration for ranges ("25-30 minutes"). */
  maxSeconds?: number;
}

const FRACTION_GLYPHS: Record<string, number> = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125 };

const WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  'forty-five': 45,
  fifty: 50,
  sixty: 60,
  ninety: 90,
  half: 0.5,
  'half an': 0.5,
  'half a': 0.5,
  'a half': 0.5,
};

const NUM = String.raw`(?:\d+(?:[.,]\d+)?(?:\s*[½⅓⅔¼¾⅛])?|\d+\s*/\s*\d+|[½⅓⅔¼¾⅛]|half an?|a half|forty-five|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|ninety|half)`;
const UNIT_LONG = String.raw`(?:seconds?|secs?|minutes?|mins?|hours?|hrs?|days?)`;
const UNIT_SHORT = String.raw`(?:h|m|s)`;
const PAIR = new RegExp(
  String.raw`\b(${NUM})(?:\s*(?:-|–|—|to|or)\s*(${NUM}))?(?:\s*(${UNIT_LONG})\b|(${UNIT_SHORT})\b)`,
  'gi',
);

function readNumber(raw: string): number | null {
  const text = raw.trim().toLowerCase();
  if (text in WORDS) return WORDS[text]!;
  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(text);
  if (frac) return Number(frac[2]) === 0 ? null : Number(frac[1]) / Number(frac[2]);
  const glyphOnly = FRACTION_GLYPHS[text];
  if (glyphOnly !== undefined) return glyphOnly;
  const mixed = /^(\d+(?:[.,]\d+)?)\s*([½⅓⅔¼¾⅛])?$/.exec(text);
  if (mixed) return Number(mixed[1]!.replace(',', '.')) + (mixed[2] ? FRACTION_GLYPHS[mixed[2]]! : 0);
  return null;
}

function unitSeconds(unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith('d')) return 86400;
  if (u.startsWith('h')) return 3600;
  if (u.startsWith('m')) return 60;
  return 1;
}

interface Pair extends DurationMatch {
  unitSize: number;
}

/** Finds every duration mentioned in `text`, merging compounds like "1 hour 30 minutes". */
export function findDurations(text: string): DurationMatch[] {
  const pairs: Pair[] = [];
  PAIR.lastIndex = 0;
  for (let m = PAIR.exec(text); m; m = PAIR.exec(text)) {
    const unit = m[3] ?? m[4]!;
    // Short units must be glued to a digit ("30m", "1h"), never "a m" or "5 m".
    if (m[4] && !/\d$/.test(text.slice(m.index, m.index + m[0].length - m[4].length))) continue;
    const low = readNumber(m[1]!);
    if (low === null) continue;
    const high = m[2] ? readNumber(m[2]) : null;
    const size = unitSeconds(unit);
    // "a" and "an" only count right before the unit ("an hour"), not "a 9x13 pan... 5 minutes".
    pairs.push({
      start: m.index,
      end: m.index + m[0].length,
      text: m[0],
      seconds: Math.round(low * size),
      ...(high !== null && high > low ? { maxSeconds: Math.round(high * size) } : {}),
      unitSize: size,
    });
  }

  const merged: DurationMatch[] = [];
  for (const pair of pairs) {
    const prev = merged[merged.length - 1] as Pair | undefined;
    const gap = prev ? text.slice(prev.end, pair.start) : '';
    if (prev && prev.maxSeconds === undefined && /^\s*(?:,|and|&|\+)?\s*$/i.test(gap) && pair.unitSize < prev.unitSize) {
      prev.end = pair.end;
      prev.text = text.slice(prev.start, pair.end);
      prev.seconds += pair.seconds;
      if (pair.maxSeconds !== undefined) prev.maxSeconds = prev.seconds - pair.seconds + pair.maxSeconds;
      prev.unitSize = pair.unitSize;
      continue;
    }
    merged.push({ ...pair });
  }
  return merged.map(({ start, end, text: t, seconds, maxSeconds }) =>
    maxSeconds === undefined ? { start, end, text: t, seconds } : { start, end, text: t, seconds, maxSeconds },
  );
}

/** Parses an ISO 8601 duration ("PT1H30M", "P1DT2H", "PT90M") into seconds. */
export function parseIsoDuration(iso: string | undefined | null): number | null {
  if (!iso) return null;
  const m = /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(
    iso.trim(),
  );
  if (!m || m[0] === 'P' || m[0] === 'PT') return null;
  const [, y, mo, w, d, h, mi, s] = m.map((v) => (v === undefined ? 0 : Number(v)));
  return Math.round(
    (y as number) * 31536000 +
      (mo as number) * 2592000 +
      (w as number) * 604800 +
      (d as number) * 86400 +
      (h as number) * 3600 +
      (mi as number) * 60 +
      (s as number),
  );
}

/** Parses human durations from metadata fields ("1 hr 20 mins", "45 minutes", "PT45M"). */
export function parseDurationText(text: string | undefined | null): number | null {
  if (!text) return null;
  const iso = parseIsoDuration(text);
  if (iso !== null) return iso;
  const found = findDurations(text);
  if (found.length === 0) {
    const bare = /^\s*(\d+)\s*$/.exec(text);
    return bare ? Number(bare[1]) * 60 : null;
  }
  return found.reduce((sum, d) => sum + d.seconds, 0);
}

/** "1 hr 30 min", "45 min", "2 days". */
export function formatDuration(seconds: number, style: 'short' | 'long' = 'short'): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return style === 'short' ? '0 min' : '0 minutes';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);
  const parts: string[] = [];
  const label = (n: number, short: string, long: string) =>
    style === 'short' ? `${n} ${short}` : `${n} ${long}${n === 1 ? '' : 's'}`;
  if (days) parts.push(label(days, days === 1 ? 'day' : 'days', 'day'));
  if (hours) parts.push(label(hours, 'hr', 'hour'));
  if (minutes) parts.push(label(minutes, 'min', 'minute'));
  if (secs && !days && !hours) parts.push(label(secs, 'sec', 'second'));
  return parts.join(' ');
}

/** Countdown display: "4:05", "1:02:30". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}
