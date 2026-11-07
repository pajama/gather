/**
 * Shared recipe rendering: ingredient lines (scaled and converted) and step
 * text with tappable timers and ingredient callouts. Used by the recipe
 * screen and step-by-step cook mode.
 */

import { Fragment, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { allIngredients } from '@/core/model/recipe';
import type { Ingredient, Recipe, UnitPreference } from '@/core/model/types';
import { findDurations, formatDuration } from '@/core/recipe/durations';
import { formatIngredient, parseIngredient, type FormattedIngredient } from '@/core/recipe/ingredients';
import { findIngredientMentions, segmentText } from '@/core/recipe/mentions';
import { Checkbox, Tap, Text, useTheme, type TextProps } from '@/ui';

export interface IngredientView {
  ingredient: Ingredient;
  formatted: FormattedIngredient;
  parsedName: string;
}

/** Parses and formats every ingredient once per scale/unit change. */
export function useIngredientViews(recipe: Recipe | undefined, scale: number, units: UnitPreference): Map<string, IngredientView> {
  return useMemo(() => {
    const map = new Map<string, IngredientView>();
    if (!recipe) return map;
    for (const ingredient of allIngredients(recipe)) {
      const parsed = parseIngredient(ingredient.text);
      map.set(ingredient.id, {
        ingredient,
        formatted: formatIngredient(parsed, { scale, system: units }),
        parsedName: parsed.name,
      });
    }
    return map;
  }, [recipe, scale, units]);
}

export function IngredientLine({
  view,
  checked,
  onToggle,
  size = 'body',
}: {
  view: IngredientView;
  checked?: boolean;
  onToggle?: () => void;
  size?: 'body' | 'large';
}) {
  const { colors, space } = useTheme();
  const { formatted } = view;
  const variant: TextProps['variant'] = size === 'large' ? 'title3' : 'body';
  const content = (
    <View style={[styles.ingredient, { gap: space.md, opacity: checked ? 0.45 : 1 }]}>
      {onToggle ? <Checkbox checked={!!checked} size={22} /> : <View style={[styles.dot, { backgroundColor: colors.accent }]} />}
      <Text variant={variant} style={[styles.flex, checked ? styles.strike : null]}>
        {formatted.amount ? (
          <Text variant={variant} weight="700" tone="accent">
            {formatted.amount}{' '}
          </Text>
        ) : null}
        {formatted.name}
        {formatted.note ? (
          <Text variant={variant} tone="secondary">
            , {formatted.note}
          </Text>
        ) : null}
      </Text>
    </View>
  );
  if (!onToggle) return content;
  return (
    <Tap onPress={onToggle} feedback="none" accessibilityRole="checkbox" accessibilityState={{ checked: !!checked }}>
      {content}
    </Tap>
  );
}

/**
 * Step text with durations as tappable timer links and ingredient mentions
 * showing the scaled amount ("the flour (2 cups)").
 */
export function StepText({
  text,
  recipe,
  views,
  onStartTimer,
  variant = 'body',
  showAmounts = true,
}: {
  text: string;
  recipe: Recipe;
  views: Map<string, IngredientView>;
  onStartTimer?: (seconds: number, label: string) => void;
  variant?: TextProps['variant'];
  showAmounts?: boolean;
}) {
  const { colors } = useTheme();
  const segments = useMemo(() => {
    const targets = [...views.values()].map((v) => ({ id: v.ingredient.id, name: v.parsedName }));
    const mentions = findIngredientMentions(text, targets);
    const durations = findDurations(text);
    const marks = [
      ...durations,
      // A duration and an ingredient never overlap; drop mentions inside durations just in case.
      ...mentions.filter((m) => !durations.some((d) => m.start < d.end && d.start < m.end)),
    ];
    return segmentText(text, marks);
  }, [text, views]);

  return (
    <Text variant={variant}>
      {segments.map((segment, index) => {
        if (segment.kind === 'text') return <Fragment key={index}>{segment.text}</Fragment>;
        if (segment.kind === 'duration') {
          return (
            <Text
              key={index}
              variant={variant}
              weight="700"
              tone="accent"
              accessibilityRole="button"
              accessibilityHint="Starts a timer"
              onPress={onStartTimer ? () => onStartTimer(segment.maxSeconds ?? segment.seconds, `${recipe.name}: ${formatDuration(segment.maxSeconds ?? segment.seconds)}`) : undefined}
              style={styles.durationLink}
            >
              ⏱ {segment.text}
            </Text>
          );
        }
        const view = views.get(segment.ingredientId);
        const amount = showAmounts ? view?.formatted.amount : undefined;
        return (
          <Text key={index} variant={variant} weight="600" color={colors.text}>
            {segment.text}
            {amount ? (
              <Text variant={variant} weight="600" tone="accent">
                {' '}
                ({amount})
              </Text>
            ) : null}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  ingredient: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 7 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 10, marginHorizontal: 8 },
  flex: { flex: 1 },
  strike: { textDecorationLine: 'line-through' },
  durationLink: { textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
});
