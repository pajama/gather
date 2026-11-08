import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Platform, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/theme';
import { Icon, type IconName } from './Icon';
import { haptic, Tap } from './Tap';
import { Text } from './Text';

/** Browsers draw a focus ring around inputs; native has no such thing and rejects outlineStyle: 'none'. */
export const noFocusRing = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as object;

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search',
  style,
  autoFocus,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  autoFocus?: boolean;
}) {
  const { colors, radius } = useTheme();
  return (
    <View style={[styles.search, { backgroundColor: colors.fill, borderRadius: radius.md }, style]}>
      <Icon name="search" size={18} tone="secondary" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={[styles.searchInput, { color: colors.text }]}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoFocus={autoFocus}
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Tap onPress={() => onChangeText('')} accessibilityLabel="Clear search" hitSlop={10}>
          <Icon name="close" size={18} tone="secondary" />
        </Tap>
      ) : null}
    </View>
  );
}

export function Field({
  label,
  style,
  multiline,
  minInputHeight,
  ...props
}: TextInputProps & { label?: string; style?: StyleProp<ViewStyle>; /** Height of a multiline field before it scrolls. */ minInputHeight?: number }) {
  const { colors, radius, space } = useTheme();
  return (
    <View style={[{ gap: space.xs }, style]}>
      {label ? (
        <Text variant="footnote" tone="secondary" weight="600">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textTertiary}
        multiline={multiline}
        accessibilityLabel={label}
        {...props}
        style={[
          styles.field,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            minHeight: multiline ? (minInputHeight ?? 96) : 46,
            textAlignVertical: multiline ? 'top' : 'center',
            paddingTop: multiline ? 12 : 0,
          },
        ]}
      />
    </View>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: readonly { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, radius } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.fill, borderRadius: radius.sm + 2 }, style]} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Tap
            key={option.value}
            feedback="none"
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) haptic();
              onChange(option.value);
            }}
            style={[
              styles.segment,
              {
                borderRadius: radius.sm,
                backgroundColor: selected ? colors.surfaceRaised : 'transparent',
                boxShadow: selected ? '0 1px 3px rgba(0,0,0,0.12)' : undefined,
              },
            ]}
          >
            {option.icon ? <Icon name={option.icon} size={16} tone={selected ? 'primary' : 'secondary'} /> : null}
            <Text variant="subhead" weight={selected ? '600' : '500'} tone={selected ? 'primary' : 'secondary'} numberOfLines={1}>
              {option.label}
            </Text>
          </Tap>
        );
      })}
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 99,
  step = 1,
  format = (v) => String(v),
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
}) {
  const { colors, radius } = useTheme();
  return (
    <View style={[styles.stepper, { backgroundColor: colors.fill, borderRadius: radius.pill }]}>
      <Tap
        haptic
        accessibilityLabel="Decrease"
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - step))}
        style={[styles.stepperButton, { opacity: value <= min ? 0.35 : 1 }]}
      >
        <Icon name="minus" size={18} tone="accent" />
      </Tap>
      <Text variant="headline" style={styles.stepperValue} accessibilityLiveRegion="polite">
        {format(value)}
      </Text>
      <Tap
        haptic
        accessibilityLabel="Increase"
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + step))}
        style={[styles.stepperButton, { opacity: value >= max ? 0.35 : 1 }]}
      >
        <Icon name="add" size={18} tone="accent" />
      </Tap>
    </View>
  );
}

export function Checkbox({ checked, size = 24, shape = 'square' }: { checked: boolean; size?: number; shape?: 'square' | 'circle' }) {
  const { colors } = useTheme();
  const corner = shape === 'circle' ? size / 2 : size * 0.3;
  const [scale] = useState(() => new Animated.Value(checked ? 1 : 0));
  useEffect(() => {
    Animated.spring(scale, { toValue: checked ? 1 : 0, useNativeDriver: true, speed: 30, bounciness: 10 }).start();
  }, [checked, scale]);
  return (
    <View
      style={[
        styles.checkbox,
        shape === 'circle'
          ? { width: size, height: size, borderRadius: corner, borderWidth: 2, borderColor: checked ? colors.accent : colors.textTertiary }
          : { width: size, height: size, borderRadius: corner, backgroundColor: colors.fill },
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.checkFill,
          { borderRadius: corner, backgroundColor: colors.accent, transform: [{ scale }], opacity: scale },
        ]}
      >
        <Icon name="check" size={size * 0.68} color={colors.onAccent} />
      </Animated.View>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, radius } = useTheme();
  return (
    <Tap
      haptic
      onPress={onPress}
      accessibilityState={{ selected: !!selected }}
      style={[styles.chip, { borderRadius: radius.pill, backgroundColor: selected ? colors.accent : colors.fill }, style]}
    >
      {icon ? <Icon name={icon} size={15} color={selected ? colors.onAccent : colors.textSecondary} /> : null}
      <Text variant="subhead" weight="600" color={selected ? colors.onAccent : colors.text} numberOfLines={1}>
        {label}
      </Text>
    </Tap>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  style,
}: {
  icon: IconName;
  title: string;
  message?: string;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, space } = useTheme();
  return (
    <View style={[styles.empty, { padding: space.xxxl, gap: space.md }, style]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
        <Icon name={icon} size={34} tone="accent" />
      </View>
      <Text variant="title3" align="center">
        {title}
      </Text>
      {message ? (
        <Text variant="subhead" tone="secondary" align="center" style={{ maxWidth: 320 }}>
          {message}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: space.sm }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, height: 40 },
  searchInput: { flex: 1, fontSize: 17, height: 40, ...noFocusRing },
  field: { fontSize: 17, paddingHorizontal: 14, ...noFocusRing },
  segmented: { flexDirection: 'row', padding: 2, gap: 2 },
  segment: { flex: 1, height: 32, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', height: 36, paddingHorizontal: 4 },
  stepperButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { minWidth: 34, textAlign: 'center', fontVariant: ['tabular-nums'] },
  checkbox: { alignItems: 'center', justifyContent: 'center' },
  checkFill: { alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 34 },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
