/**
 * Design tokens. Colors come in light/dark pairs; the accent is a user
 * setting (like Crouton's custom app colors), so components read it from
 * the theme instead of hard-coding a brand color.
 */

export interface AccentDef {
  id: string;
  name: string;
  light: string;
  dark: string;
  /** Text/icon color on top of a filled accent surface. */
  onAccent: string;
}

export const ACCENTS: readonly AccentDef[] = [
  { id: 'tomato', name: 'Tomato', light: '#E8553D', dark: '#FF6A4D', onAccent: '#FFFFFF' },
  { id: 'saffron', name: 'Saffron', light: '#E89A14', dark: '#FFB236', onAccent: '#FFFFFF' },
  { id: 'honey', name: 'Honey', light: '#D9A400', dark: '#F5C518', onAccent: '#2B2100' },
  { id: 'sage', name: 'Sage', light: '#5E9B6A', dark: '#7CC08A', onAccent: '#FFFFFF' },
  { id: 'basil', name: 'Basil', light: '#2E8B57', dark: '#45B577', onAccent: '#FFFFFF' },
  { id: 'teal', name: 'Teal', light: '#1B9AA0', dark: '#35C2C8', onAccent: '#FFFFFF' },
  { id: 'blueberry', name: 'Blueberry', light: '#3D6FE0', dark: '#5C8BFF', onAccent: '#FFFFFF' },
  { id: 'plum', name: 'Plum', light: '#8A4FD3', dark: '#A874F0', onAccent: '#FFFFFF' },
  { id: 'beet', name: 'Beet', light: '#C8366B', dark: '#EE5A8E', onAccent: '#FFFFFF' },
  { id: 'cocoa', name: 'Cocoa', light: '#8B5E3C', dark: '#B9875F', onAccent: '#FFFFFF' },
  { id: 'graphite', name: 'Graphite', light: '#3A3A3C', dark: '#D1D1D6', onAccent: '#FFFFFF' },
];

export function accentById(id: string): AccentDef {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0]!;
}

export interface Palette {
  /** Screen background behind grouped cards. */
  background: string;
  /** Cards, rows and sheets. */
  surface: string;
  /** Surfaces raised above cards (menus, popovers). */
  surfaceRaised: string;
  /** Subtle fills: chips, search fields, inactive segments. */
  fill: string;
  fillStrong: string;
  separator: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  /** Text on photos and dark scrims. */
  textOnImage: string;
  scrim: string;
  danger: string;
  success: string;
  warning: string;
  /** Placeholder behind images while they load. */
  imagePlaceholder: string;
}

export const LIGHT: Palette = {
  background: '#F4F2EE',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  fill: 'rgba(120, 110, 95, 0.10)',
  fillStrong: 'rgba(120, 110, 95, 0.18)',
  separator: 'rgba(60, 50, 40, 0.12)',
  text: '#1D1B18',
  textSecondary: 'rgba(40, 35, 30, 0.62)',
  textTertiary: 'rgba(40, 35, 30, 0.38)',
  textOnImage: '#FFFFFF',
  scrim: 'rgba(0, 0, 0, 0.45)',
  danger: '#D93B30',
  success: '#2F9E5B',
  warning: '#D98B00',
  imagePlaceholder: '#E9E5DE',
};

export const DARK: Palette = {
  background: '#0F0E0D',
  surface: '#1C1B19',
  surfaceRaised: '#262523',
  fill: 'rgba(235, 225, 210, 0.10)',
  fillStrong: 'rgba(235, 225, 210, 0.18)',
  separator: 'rgba(235, 225, 210, 0.12)',
  text: '#F5F2ED',
  textSecondary: 'rgba(245, 242, 237, 0.62)',
  textTertiary: 'rgba(245, 242, 237, 0.36)',
  textOnImage: '#FFFFFF',
  scrim: 'rgba(0, 0, 0, 0.55)',
  danger: '#FF5A4F',
  success: '#43C27A',
  warning: '#FFAE33',
  imagePlaceholder: '#2A2826',
};

export const SPACE = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const RADIUS = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

/** Type ramp modelled on iOS text styles. */
export const TYPE = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '800' },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '800' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '700' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
} as const;

export type TypeVariant = keyof typeof TYPE;
