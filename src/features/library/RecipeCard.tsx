import { router } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { coverImage, totalSeconds } from '@/core/model/recipe';
import type { Recipe } from '@/core/model/types';
import { formatDuration } from '@/core/recipe/durations';
import { Icon, Photo, Tap, Text, useTheme } from '@/ui';

export function recipeMeta(recipe: Recipe): string {
  const parts: string[] = [];
  const total = totalSeconds(recipe);
  if (total) parts.push(formatDuration(total));
  if (recipe.sourceName) parts.push(recipe.sourceName);
  return parts.join(' · ');
}

/** Grid card: photo, name, time and source. */
export const RecipeCard = memo(function RecipeCard({
  recipe,
  width,
  onPress,
  onLongPress,
}: {
  recipe: Recipe;
  width: number;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const { colors, radius, space } = useTheme();
  return (
    <Tap
      feedback="scale"
      onPress={onPress ?? (() => router.push(`/recipe/${recipe.id}`))}
      onLongPress={onLongPress}
      accessibilityLabel={recipe.name}
      style={{ width }}
    >
      <View style={[styles.imageWrap, { borderRadius: radius.lg, backgroundColor: colors.imagePlaceholder }]}>
        <Photo uri={coverImage(recipe)} style={[styles.image, { borderRadius: radius.lg }]} />
        {recipe.favorite ? (
          <View style={[styles.badge, { backgroundColor: 'rgba(20,18,16,0.45)' }]}>
            <Icon name="heart" size={14} color="#FFFFFF" />
          </View>
        ) : null}
      </View>
      <View style={{ paddingTop: space.sm, paddingHorizontal: 2, gap: 2 }}>
        <Text variant="headline" numberOfLines={2}>
          {recipe.name}
        </Text>
        {recipeMeta(recipe) ? (
          <Text variant="footnote" tone="secondary" numberOfLines={1}>
            {recipeMeta(recipe)}
          </Text>
        ) : null}
      </View>
    </Tap>
  );
});

/** Compact row: thumbnail and name (planner, pickers, search results). */
export function RecipeRow({
  recipe,
  onPress,
  right,
  subtitle,
}: {
  recipe: Recipe;
  onPress?: () => void;
  right?: React.ReactNode;
  subtitle?: string;
}) {
  const { radius, space } = useTheme();
  return (
    <Tap onPress={onPress ?? (() => router.push(`/recipe/${recipe.id}`))} style={[styles.row, { gap: space.md }]} accessibilityLabel={recipe.name}>
      <Photo uri={coverImage(recipe)} style={[styles.thumb, { borderRadius: radius.sm }]} />
      <View style={styles.rowText}>
        <Text variant="headline" numberOfLines={1}>
          {recipe.name}
        </Text>
        {(subtitle ?? recipeMeta(recipe)) ? (
          <Text variant="footnote" tone="secondary" numberOfLines={1}>
            {subtitle ?? recipeMeta(recipe)}
          </Text>
        ) : null}
      </View>
      {right}
    </Tap>
  );
}

const styles = StyleSheet.create({
  imageWrap: { aspectRatio: 1, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  badge: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  thumb: { width: 56, height: 56 },
  rowText: { flex: 1, gap: 2 },
});
