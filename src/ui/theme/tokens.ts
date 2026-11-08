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
  { id: 'sky', name: 'Sky', light: '#3D8EF0', dark: '#4C9AF5', onAccent: '#FFFFFF' },
  { id: 'tomato', name: 'Tomato', light: '#E8553D', dark: '#FF6A4D', onAccent: '#FFFFFF' },
  { id: 'saffron', name: 'Saffron', light: '#E8930C', dark: '#FFAD33', onAccent: '#FFFFFF' },
  { id: 'honey', name: 'Honey', light: '#D9A400', dark: '#F5C518', onAccent: '#2B2100' },
  { id: 'sage', name: 'Sage', light: '#4E9F6B', dark: '#6CC48A', onAccent: '#FFFFFF' },
  { id: 'mint', name: 'Mint', light: '#20A889', dark: '#3CCBA8', onAccent: '#FFFFFF' },
  { id: 'teal', name: 'Teal', light: '#1B9AA8', dark: '#35C2D0', onAccent: '#FFFFFF' },
  { id: 'indigo', name: 'Indigo', light: '#5E5CE6', dark: '#7D7AFF', onAccent: '#FFFFFF' },
  { id: 'plum', name: 'Plum', light: '#A04FD3', dark: '#BD74F0', onAccent: '#FFFFFF' },
  { id: 'beet', name: 'Beet', light: '#D6336C', dark: '#F05A8E', onAccent: '#FFFFFF' },
  { id: 'cocoa', name: 'Cocoa', light: '#8B5E3C', dark: '#B9875F', onAccent: '#FFFFFF' },
  { id: 'graphite', name: 'Graphite', light: '#48484A', dark: '#D1D1D6', onAccent: '#FFFFFF' },
];

export function accentById(id: string): AccentDef {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0]!;
}

export interface Palette {
  /** Screen background behind grouped cards. */
  background: string;
  /** Cards, rows and sheets. */
  surface: string;
  /** The wide-screen sidebar. */
  sidebar: string;
  /** Surfaces raised above cards (menus, popovers). */
  surfaceRaised: string;
  /** Subtle fills: chips, search fields, inactive segments, card header bands. */
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
  /** Durations in recipe text (tap to start a timer). */
  timer: string;
  /** Placeholder behind images while they load. */
  imagePlaceholder: string;
  /** Soft shadow for floating cards. */
  shadow: string;
  /** Pastel action buttons: icon color and its tinted background. */
  green: string;
  greenSoft: string;
  yellow: string;
  yellowSoft: string;
  purple: string;
  purpleSoft: string;
  redSoft: string;
}

export const LIGHT: Palette = {
  background: '#F2F3F5',
  surface: '#FFFFFF',
  sidebar: '#E9EAEE',
  surfaceRaised: '#FFFFFF',
  fill: 'rgba(118, 118, 128, 0.10)',
  fillStrong: 'rgba(118, 118, 128, 0.20)',
  separator: 'rgba(60, 60, 67, 0.12)',
  text: '#1C1C1E',
  textSecondary: 'rgba(60, 60, 67, 0.62)',
  textTertiary: 'rgba(60, 60, 67, 0.34)',
  textOnImage: '#FFFFFF',
  scrim: 'rgba(0, 0, 0, 0.40)',
  danger: '#FF3B30',
  success: '#34C759',
  warning: '#FF9500',
  timer: '#F2A33A',
  imagePlaceholder: '#E5E6EA',
  shadow: 'rgba(0, 0, 0, 0.06)',
  green: '#34C759',
  greenSoft: '#D5F4E0',
  yellow: '#F5A623',
  yellowSoft: '#FDF0CF',
  purple: '#5E5CE6',
  purpleSoft: '#E1E1FA',
  redSoft: '#FDE4E2',
};

export const DARK: Palette = {
  background: '#000000',
  surface: '#1C1C1E',
  sidebar: '#121214',
  surfaceRaised: '#2C2C2E',
  fill: 'rgba(118, 118, 128, 0.24)',
  fillStrong: 'rgba(118, 118, 128, 0.36)',
  separator: 'rgba(84, 84, 88, 0.60)',
  text: '#F5F5F7',
  textSecondary: 'rgba(235, 235, 245, 0.60)',
  textTertiary: 'rgba(235, 235, 245, 0.30)',
  textOnImage: '#FFFFFF',
  scrim: 'rgba(0, 0, 0, 0.55)',
  danger: '#FF453A',
  success: '#30D158',
  warning: '#FF9F0A',
  timer: '#FFB340',
  imagePlaceholder: '#2C2C2E',
  shadow: 'rgba(0, 0, 0, 0.4)',
  green: '#30D158',
  greenSoft: 'rgba(48, 209, 88, 0.18)',
  yellow: '#FFB340',
  yellowSoft: 'rgba(255, 179, 64, 0.18)',
  purple: '#7D7AFF',
  purpleSoft: 'rgba(125, 122, 255, 0.20)',
  redSoft: 'rgba(255, 69, 58, 0.18)',
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

/** Rounded display faces (Nunito) for titles, buttons and numbers; system faces for reading text. */
export const ROUNDED = {
  '600': 'Nunito_600SemiBold',
  '700': 'Nunito_700Bold',
  '800': 'Nunito_800ExtraBold',
  '900': 'Nunito_900Black',
} as const;

export interface TypeStyle {
  fontSize: number;
  lineHeight: number;
  weight: '400' | '500' | '600' | '700' | '800' | '900';
  rounded?: boolean;
  letterSpacing?: number;
  textTransform?: 'uppercase';
}

/** Type ramp modelled on iOS text styles, with rounded display type like Crouton's. */
export const TYPE = {
  largeTitle: { fontSize: 34, lineHeight: 41, weight: '800', rounded: true },
  title1: { fontSize: 28, lineHeight: 34, weight: '800', rounded: true },
  title2: { fontSize: 22, lineHeight: 28, weight: '700', rounded: true },
  title3: { fontSize: 20, lineHeight: 25, weight: '700', rounded: true },
  headline: { fontSize: 17, lineHeight: 22, weight: '700', rounded: true },
  body: { fontSize: 17, lineHeight: 23, weight: '400' },
  callout: { fontSize: 16, lineHeight: 21, weight: '400' },
  subhead: { fontSize: 15, lineHeight: 20, weight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, weight: '400' },
  caption: { fontSize: 12, lineHeight: 16, weight: '500' },
  overline: { fontSize: 13, lineHeight: 18, weight: '700', rounded: true },
  step: { fontSize: 24, lineHeight: 34, weight: '400' },
} as const satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof TYPE;
