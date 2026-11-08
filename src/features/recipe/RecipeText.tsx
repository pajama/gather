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
import { convertTemperatures } from '@/core/recipe/temperature';
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

/** "1 cup unsalted butter, softened" with the amount in the accent color (Crouton's ingredient line). */
export function IngredientLine({
  view,
  checked,
  onToggle,
  size = 'body',
  showCheckbox = false,
}: {
  view: IngredientView;
  checked?: boolean;
  onToggle?: () => void;
  size?: 'body' | 'large';
  /** Show an explicit checkbox (cook mode ingredient list); otherwise tapping strikes the line through. */
  showCheckbox?: boolean;
}) {
  const { space } = useTheme();
  const { formatted } = view;
  const variant: TextProps['variant'] = size === 'large' ? 'title3' : 'body';
  const content = (
    <View style={[styles.ingredient, { gap: space.md, opacity: checked ? 0.4 : 1 }]}>
      {showCheckbox ? <Checkbox checked={!!checked} size={22} /> : null}
      <Text variant={variant} style={[styles.flex, checked ? styles.strike : null]}>
        {formatted.amount ? (
          <Text variant={variant} tone="accent">
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
 * Step text with durations (amber, tap to start a timer) and ingredient
 * mentions (accent, tap to see the amount), as in Crouton's step views.
 */
export function StepText({
  text,
  recipe,
  views,
  onStartTimer,
  onIngredientPress,
  variant = 'body',
  units = 'original',
}: {
  text: string;
  recipe: Recipe;
  views: Map<string, IngredientView>;
  onStartTimer?: (seconds: number, label: string) => void;
  onIngredientPress?: (view: IngredientView) => void;
  variant?: TextProps['variant'];
  /** Temperatures in the step are shown in these units. */
  units?: UnitPreference;
}) {
  const segments = useMemo(() => {
    const shown = convertTemperatures(text, units);
    const targets = [...views.values()].map((v) => ({ id: v.ingredient.id, name: v.parsedName }));
    const mentions = findIngredientMentions(shown, targets);
    const durations = findDurations(shown);
    const marks = [...durations, ...mentions.filter((m) => !durations.some((d) => m.start < d.end && d.start < m.end))];
    return segmentText(shown, marks);
  }, [text, views, units]);

  return (
    <Text variant={variant}>
      {segments.map((segment, index) => {
        if (segment.kind === 'text') return <Fragment key={index}>{segment.text}</Fragment>;
        if (segment.kind === 'duration') {
          const seconds = segment.maxSeconds ?? segment.seconds;
          return (
            <Text
              key={index}
              variant={variant}
              tone="timer"
              accessibilityRole="button"
              accessibilityHint="Starts a timer"
              onPress={onStartTimer ? () => onStartTimer(seconds, `${recipe.name}: ${formatDuration(seconds)}`) : undefined}
            >
              {segment.text}
            </Text>
          );
        }
        const view = views.get(segment.ingredientId);
        return (
          <Text
            key={index}
            variant={variant}
            tone="accent"
            accessibilityRole={onIngredientPress ? 'button' : undefined}
            onPress={onIngredientPress && view ? () => onIngredientPress(view) : undefined}
          >
            {segment.text}
          </Text>
        );
      })}
    </Text>
  );
}

/** The bubble Crouton shows when you tap an ingredient inside a step: "1 tsp chilli powder". */
export function IngredientCallout({ view }: { view: IngredientView }) {
  const { colors, radius, space } = useTheme();
  return (
    <View
      style={[
        styles.callout,
        { backgroundColor: colors.surfaceRaised, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, boxShadow: `0 4px 18px ${colors.shadow}, 0 1px 3px ${colors.shadow}` },
      ]}
    >
      <Text variant="body">
        {view.formatted.amount ? <Text tone="accent">{view.formatted.amount} </Text> : null}
        {view.formatted.name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ingredient: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  flex: { flex: 1 },
  strike: { textDecorationLine: 'line-through' },
  callout: { alignSelf: 'flex-start' },
});
