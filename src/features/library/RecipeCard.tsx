import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { coverImage, totalSeconds } from '@/core/model/recipe';
import type { Recipe } from '@/core/model/types';
import { formatDuration } from '@/core/recipe/durations';
import { formatNumber } from '@/core/recipe/quantity';
import { Icon, Photo, Tap, Text, useTheme } from '@/ui';

export function recipeMeta(recipe: Recipe): string {
  const parts: string[] = [];
  const total = totalSeconds(recipe);
  if (total) parts.push(formatDuration(total));
  if (recipe.sourceName) parts.push(recipe.sourceName);
  return parts.join(' · ');
}

/** Crouton's recipe card: the photo fills the card, the name sits on it, and a frosted pill shows servings and time. */
export const RecipeCard = memo(function RecipeCard({
  recipe,
  width,
  height,
  onPress,
  onLongPress,
  from,
}: {
  recipe: Recipe;
  width: number;
  height?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Back-link label on the recipe screen ("All Recipes"). */
  from?: string;
}) {
  const { colors, radius, space } = useTheme();
  const total = totalSeconds(recipe);
  const cardHeight = height ?? Math.round(Math.min(width * 0.62, 260));
  return (
    <Tap
      feedback="scale"
      onPress={onPress ?? (() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id, ...(from ? { from } : {}) } }))}
      onLongPress={onLongPress}
      accessibilityLabel={recipe.name}
      style={[styles.card, { width, height: cardHeight, borderRadius: radius.xl, backgroundColor: colors.imagePlaceholder, boxShadow: `0 4px 14px ${colors.shadow}` }]}
    >
      <Photo uri={coverImage(recipe)} style={[StyleSheet.absoluteFill, { borderRadius: radius.xl }]} />
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.12)', 'transparent']}
        locations={[0, 0.35, 0.6]}
        style={[StyleSheet.absoluteFill, { borderRadius: radius.xl }]}
      />
      <Text variant="title3" tone="onImage" numberOfLines={2} style={[styles.title, { padding: space.md, paddingRight: space.xl }]}>
        {recipe.name}
      </Text>
      {recipe.servings || total ? (
        <View style={[styles.pill, { left: space.sm, bottom: space.sm, borderRadius: radius.pill }]}>
          {recipe.servings ? (
            <View style={styles.pillItem}>
              <Icon name="people" size={15} color="rgba(40,40,45,0.75)" />
              <Text variant="subhead" rounded weight="700" color="rgba(30,30,35,0.85)">
                {formatNumber(recipe.servings)}
              </Text>
            </View>
          ) : null}
          {total ? (
            <View style={styles.pillItem}>
              <Icon name="time" size={15} color="rgba(40,40,45,0.75)" />
              <Text variant="subhead" rounded weight="700" color="rgba(30,30,35,0.85)">
                {formatDuration(total)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {recipe.favorite ? (
        <View style={[styles.favorite, { right: space.sm, bottom: space.sm }]}>
          <Icon name="heart" size={15} color="#FFFFFF" />
        </View>
      ) : null}
    </Tap>
  );
});

/** Compact row: thumbnail and name (meal plan, pickers, wide-screen list). */
export function RecipeRow({
  recipe,
  onPress,
  right,
  subtitle,
  from,
}: {
  recipe: Recipe;
  onPress?: () => void;
  right?: ReactNode;
  subtitle?: string;
  from?: string;
}) {
  const { radius, space } = useTheme();
  return (
    <Tap
      onPress={onPress ?? (() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id, ...(from ? { from } : {}) } }))}
      style={[styles.row, { gap: space.md }]}
      accessibilityLabel={recipe.name}
    >
      <Photo uri={coverImage(recipe)} style={[styles.thumb, { borderRadius: radius.sm }]} />
      <View style={styles.rowText}>
        <Text variant="headline" weight="600" numberOfLines={1}>
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
  card: { overflow: 'hidden' },
  title: { textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  pill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.78)',
    backdropFilter: 'blur(10px)',
  } as never,
  pillItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  favorite: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  thumb: { width: 52, height: 52 },
  rowText: { flex: 1, gap: 2 },
});
