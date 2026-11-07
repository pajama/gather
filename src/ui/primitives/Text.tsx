import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme } from '../theme/theme';
import type { TypeVariant } from '../theme/tokens';

export type TextTone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'onAccent' | 'danger' | 'onImage' | 'success';

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: TextTone;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
  color?: string;
}

export function Text({ variant = 'body', tone = 'primary', weight, align, color, style, ...rest }: TextProps) {
  const { type, colors } = useTheme();
  const toneColor: Record<TextTone, string> = {
    primary: colors.text,
    secondary: colors.textSecondary,
    tertiary: colors.textTertiary,
    accent: colors.accent,
    onAccent: colors.onAccent,
    danger: colors.danger,
    onImage: colors.textOnImage,
    success: colors.success,
  };
  return (
    <RNText
      {...rest}
      style={[
        type[variant] as TextStyle,
        { color: color ?? toneColor[tone] },
        weight ? { fontWeight: weight } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
