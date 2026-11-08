import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/theme';
import { Icon } from './Icon';
import { Tap } from './Tap';
import { Text } from './Text';

/** Max content width on tablets and desktop browsers; phones use the full width. */
export const CONTENT_MAX_WIDTH = 720;

export function useContentWidth(): { width: number; gutter: number; wide: boolean } {
  const { width } = useWindowDimensions();
  const wide = width >= 720;
  const gutter = wide ? 24 : 16;
  return { width: Math.min(width, CONTENT_MAX_WIDTH) - gutter * 2, gutter, wide };
}

/** "‹ All Recipes": an iOS-style text back link. */
export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Tap onPress={onPress} accessibilityLabel={`Back to ${label}`} hitSlop={10} style={styles.backLink}>
      <Icon name="back" size={26} tone="accent" />
      <Text variant="body" tone="accent" numberOfLines={1} style={styles.backLabel}>
        {label}
      </Text>
    </Tap>
  );
}

/**
 * Large-title header: a nav row (optional back link on the left, actions on
 * the right) above the big rounded title, as in Crouton and iOS.
 */
export function LargeHeader({
  title,
  subtitle,
  right,
  back,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  back?: { label: string; onPress: () => void };
}) {
  const { space } = useTheme();
  return (
    <View style={{ marginBottom: space.md }}>
      <View style={styles.navRow}>
        <View style={styles.navLeft}>{back ? <BackLink label={back.label} onPress={back.onPress} /> : null}</View>
        <View style={[styles.navRight, { gap: space.md }]}>{right}</View>
      </View>
      <Text variant="largeTitle" accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="subhead" tone="secondary" style={{ marginTop: 2 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/** Scrollable screen body: themed background, safe-area top, centered column on wide screens. */
export function Screen({
  children,
  header,
  scroll = true,
  contentStyle,
  topInset = true,
  ...scrollProps
}: ScrollViewProps & {
  children: ReactNode;
  header?: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  topInset?: boolean;
}) {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  const { gutter } = useContentWidth();
  const padding = {
    paddingTop: (topInset ? insets.top : 0) + space.xs,
    paddingHorizontal: gutter,
    paddingBottom: insets.bottom + 96,
  };
  if (!scroll) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.background }]}>
        <View style={[styles.column, padding, { paddingBottom: 0 }, styles.fill, contentStyle]}>
          {header}
          {children}
        </View>
      </View>
    );
  }
  return (
    <ScrollView
      style={[styles.fill, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.column, padding, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      {...scrollProps}
    >
      {header}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  column: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  navLeft: { flex: 1, flexDirection: 'row' },
  navRight: { flexDirection: 'row', alignItems: 'center' },
  backLink: { flexDirection: 'row', alignItems: 'center', marginLeft: -8, maxWidth: 260 },
  backLabel: { marginLeft: -2 },
});
