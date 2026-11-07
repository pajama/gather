import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/theme';
import { Text } from './Text';

/** Max content width on tablets and desktop browsers; phones use the full width. */
export const CONTENT_MAX_WIDTH = 760;

export function useContentWidth(): { width: number; gutter: number; wide: boolean } {
  const { width } = useWindowDimensions();
  const wide = width >= 720;
  const gutter = wide ? 24 : 16;
  return { width: Math.min(width, CONTENT_MAX_WIDTH) - gutter * 2, gutter, wide };
}

/** Large-title header used at the top of each tab. */
export function LargeHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const { space } = useTheme();
  return (
    <View style={[styles.largeHeader, { marginBottom: space.md }]}>
      <View style={styles.largeHeaderText}>
        <Text variant="largeTitle" accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="subhead" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.largeHeaderRight}>{right}</View> : null}
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
    paddingTop: (topInset ? insets.top : 0) + space.sm,
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
  largeHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, minHeight: 52 },
  largeHeaderText: { flex: 1 },
  largeHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 },
});
