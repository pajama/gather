import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme } from '../theme/theme';
import { ROUNDED, type TypeStyle, type TypeVariant } from '../theme/tokens';

export type TextTone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'onAccent' | 'danger' | 'onImage' | 'success' | 'timer';

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: TextTone;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
  color?: string;
  /** Force the rounded display face on or off for this text. */
  rounded?: boolean;
}

type Weight = TypeStyle['weight'];

function roundedFamily(weight: Weight): string {
  if (weight === '900') return ROUNDED['900'];
  if (weight === '800') return ROUNDED['800'];
  if (weight === '700') return ROUNDED['700'];
  return ROUNDED['600'];
}

/** Resolves a variant (+ overrides) into a concrete style; custom faces carry their weight in the family. */
export function resolveTextStyle(style: TypeStyle, weight?: TextStyle['fontWeight'], rounded?: boolean): TextStyle {
  const w = (weight ? String(weight) : style.weight) as Weight;
  const useRounded = rounded ?? style.rounded ?? false;
  return {
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    ...(style.letterSpacing !== undefined ? { letterSpacing: style.letterSpacing } : {}),
    ...(style.textTransform ? { textTransform: style.textTransform } : {}),
    ...(useRounded ? { fontFamily: roundedFamily(w) } : { fontWeight: w }),
  };
}

export function Text({ variant = 'body', tone = 'primary', weight, align, color, rounded, style, ...rest }: TextProps) {
  const { type, colors } = useTheme();
  const toneColor: Record<TextTone, string> = {
    primary: colors.text,
    secondary: colors.textSecondary,
    tertiary: colors.textTertiary,
    accent: colors.accentText,
    onAccent: colors.onAccent,
    danger: colors.danger,
    onImage: colors.textOnImage,
    success: colors.success,
    timer: colors.timerText,
  };
  return (
    <RNText
      {...rest}
      style={[
        resolveTextStyle(type[variant], weight, rounded),
        { color: color ?? toneColor[tone] },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
