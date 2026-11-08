import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme, type Theme } from '../theme/theme';
import { Icon, type IconName } from './Icon';
import { Tap } from './Tap';
import { Text } from './Text';

export type ButtonVariant =
  'filled' | 'tinted' | 'plain' | 'outline' | 'destructive' | 'green' | 'yellow' | 'purple';
export type ButtonSize = 'sm' | 'md' | 'lg';

/** Soft pastel pairs used across the app (Start = green, groceries = yellow, share = purple). */
export type Tint = 'accent' | 'green' | 'yellow' | 'purple' | 'red' | 'neutral';

export function tintColors(colors: Theme['colors'], tint: Tint): { fg: string; bg: string } {
  switch (tint) {
    case 'green':
      return { fg: colors.green, bg: colors.greenSoft };
    case 'yellow':
      return { fg: colors.yellow, bg: colors.yellowSoft };
    case 'purple':
      return { fg: colors.purple, bg: colors.purpleSoft };
    case 'red':
      return { fg: colors.danger, bg: colors.redSoft };
    case 'neutral':
      return { fg: colors.text, bg: colors.fill };
    default:
      return { fg: colors.accent, bg: colors.accentSoft };
  }
}

export function Button({
  title,
  onPress,
  variant = 'filled',
  size = 'md',
  icon,
  disabled,
  loading,
  style,
  full,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Stretch to the container width. */
  full?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors, radius } = useTheme();
  const height = { sm: 32, md: 46, lg: 56 }[size];
  let bg: string;
  let fg: string;
  switch (variant) {
    case 'filled':
      bg = colors.accent;
      fg = colors.onAccent;
      break;
    case 'destructive':
      bg = colors.danger;
      fg = '#FFFFFF';
      break;
    case 'plain':
    case 'outline':
      bg = 'transparent';
      fg = colors.accent;
      break;
    case 'green':
    case 'yellow':
    case 'purple':
      ({ bg, fg } = tintColors(colors, variant));
      break;
    default:
      ({ bg, fg } = tintColors(colors, 'accent'));
  }
  return (
    <Tap
      haptic
      feedback="scale"
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel ?? title}
      style={[
        styles.base,
        {
          height,
          backgroundColor: bg,
          borderRadius: radius.pill,
          paddingHorizontal: size === 'sm' ? 14 : size === 'lg' ? 26 : 20,
          opacity: disabled ? 0.45 : 1,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          borderColor: colors.accentMuted,
        },
        full ? styles.full : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={size === 'lg' ? 24 : size === 'sm' ? 16 : 19} color={fg} /> : null}
          <Text
            variant={size === 'sm' ? 'subhead' : size === 'lg' ? 'title3' : 'headline'}
            rounded
            weight="700"
            color={fg}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      )}
    </Tap>
  );
}

export function IconButton({
  icon,
  onPress,
  variant = 'plain',
  tint = 'accent',
  size = 36,
  accessibilityLabel,
  active,
  disabled,
  style,
  badge,
}: {
  icon: IconName;
  onPress?: () => void;
  /** plain: bare icon; tinted: soft pastel circle; filled: solid accent; glass: dark translucent (on photos); fill: neutral gray */
  variant?: 'plain' | 'tinted' | 'filled' | 'glass' | 'fill';
  tint?: Tint;
  size?: number;
  accessibilityLabel: string;
  active?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Small "+" badge (Crouton's add-timer button). */
  badge?: boolean;
}) {
  const { colors } = useTheme();
  const tinted = tintColors(colors, tint);
  const bg = {
    plain: 'transparent',
    tinted: tinted.bg,
    filled: tint === 'accent' ? colors.accent : tinted.fg,
    glass: 'rgba(20, 18, 16, 0.42)',
    fill: colors.fill,
  }[variant];
  const fg = {
    plain: active ? colors.accent : variant === 'plain' && tint !== 'accent' ? tinted.fg : colors.accent,
    tinted: tinted.fg,
    filled: tint === 'accent' ? colors.onAccent : '#FFFFFF',
    glass: '#FFFFFF',
    fill: active ? colors.accent : colors.text,
  }[variant];
  return (
    <Tap
      haptic
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={[
        styles.iconButton,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.55)} color={fg} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.accent, borderColor: colors.background }]}>
          <Icon name="add" size={10} color={colors.onAccent} />
        </View>
      ) : null}
    </Tap>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  full: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
