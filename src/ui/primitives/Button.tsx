import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme';
import { Icon, type IconName } from './Icon';
import { Tap } from './Tap';
import { Text } from './Text';

export type ButtonVariant = 'filled' | 'tinted' | 'plain' | 'outline' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

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
  const height = { sm: 34, md: 44, lg: 54 }[size];
  const bg = {
    filled: colors.accent,
    tinted: colors.accentSoft,
    plain: 'transparent',
    outline: 'transparent',
    destructive: colors.danger,
  }[variant];
  const fg = { filled: colors.onAccent, tinted: colors.accent, plain: colors.accent, outline: colors.accent, destructive: '#FFFFFF' }[
    variant
  ];
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
          borderRadius: size === 'sm' ? radius.pill : radius.md,
          paddingHorizontal: size === 'sm' ? 14 : 18,
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
          {icon ? <Icon name={icon} size={size === 'lg' ? 22 : 18} color={fg} /> : null}
          <Text variant={size === 'sm' ? 'subhead' : 'headline'} weight="600" color={fg} numberOfLines={1}>
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
  size = 36,
  accessibilityLabel,
  active,
  disabled,
  style,
}: {
  icon: IconName;
  onPress?: () => void;
  variant?: 'plain' | 'tinted' | 'filled' | 'glass' | 'fill';
  size?: number;
  accessibilityLabel: string;
  active?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const bg = {
    plain: 'transparent',
    tinted: colors.accentSoft,
    filled: colors.accent,
    glass: 'rgba(20, 18, 16, 0.42)',
    fill: colors.fill,
  }[variant];
  const fg = {
    plain: active ? colors.accent : colors.text,
    tinted: colors.accent,
    filled: colors.onAccent,
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
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, opacity: disabled ? 0.4 : 1 },
        style,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.56)} color={fg} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  full: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
});
