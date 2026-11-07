import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { allIngredients } from '@/core/model/recipe';
import type { MealSlot, Recipe } from '@/core/model/types';
import { formatIngredient, parseIngredient } from '@/core/recipe/ingredients';
import { addDays, dayKey, relativeDayName, shortDate } from '@/core/planner/planner';
import { useDb, useSettings } from '@/data/react';
import { Button, Checkbox, haptic, SegmentedControl, Sheet, Tap, Text, useTheme } from '@/ui';

const SLOT_LABELS: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

export function AddToPlanSheet({ recipe, visible, onClose }: { recipe: Recipe; visible: boolean; onClose: () => void }) {
  const db = useDb();
  const settings = useSettings();
  const { colors, radius, space } = useTheme();
  const defaultSlot: MealSlot = recipe.tags.some((t) => /breakfast|brunch/i.test(t)) ? 'breakfast' : recipe.tags.some((t) => /lunch/i.test(t)) ? 'lunch' : 'dinner';
  const [slot, setSlot] = useState<MealSlot>(defaultSlot);
  const today = dayKey(new Date());
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const slots = settings.plannerSlots.includes(slot) ? settings.plannerSlots : [...settings.plannerSlots, slot];

  return (
    <Sheet visible={visible} onClose={onClose} title="Add to plan">
      <SegmentedControl
        options={slots.map((s) => ({ value: s, label: SLOT_LABELS[s] }))}
        value={slot}
        onChange={setSlot}
        style={{ marginBottom: space.lg }}
      />
      <View style={{ gap: space.sm }}>
        {days.map((day) => {
          const planned = db.planner.entriesFor([day]).filter((e) => e.slot === slot);
          return (
            <Tap
              key={day}
              feedback="scale"
              onPress={() => {
                db.planner.add(day, slot, { recipeId: recipe.id });
                haptic('success');
                onClose();
              }}
              style={[styles.dayRow, { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md }]}
              accessibilityLabel={`${relativeDayName(day, today)} ${shortDate(day)}`}
            >
              <View style={{ flex: 1 }}>
                <Text variant="headline">{relativeDayName(day, today)}</Text>
                <Text variant="footnote" tone="secondary" numberOfLines={1}>
                  {planned.length
                    ? planned.map((e) => db.recipes.get(e.recipeId)?.name ?? e.title ?? 'Planned').join(', ')
                    : shortDate(day)}
                </Text>
              </View>
              <Text variant="subhead" tone="accent" weight="600">
                Add
              </Text>
            </Tap>
          );
        })}
      </View>
    </Sheet>
  );
}

export function AddToGroceriesSheet({
  recipe,
  scale,
  visible,
  onClose,
}: {
  recipe: Recipe;
  scale: number;
  visible: boolean;
  onClose: () => void;
}) {
  const db = useDb();
  const { space } = useTheme();
  const ingredients = allIngredients(recipe).filter((i) => i.text.trim());
  const [selected, setSelected] = useState<Set<string>>(() => new Set(ingredients.map((i) => i.id)));
  const allSelected = selected.size === ingredients.length;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Add to groceries"
      headerRight={
        <Tap onPress={() => setSelected(allSelected ? new Set() : new Set(ingredients.map((i) => i.id)))} hitSlop={8}>
          <Text variant="subhead" tone="accent" weight="600">
            {allSelected ? 'None' : 'All'}
          </Text>
        </Tap>
      }
      footer={
        <Button
          title={selected.size ? `Add ${selected.size} ${selected.size === 1 ? 'item' : 'items'}` : 'Select items'}
          icon="cart"
          disabled={selected.size === 0}
          full
          onPress={() => {
            db.groceries.addRecipe(recipe.id, { scale, ingredientIds: [...selected] });
            haptic('success');
            onClose();
          }}
        />
      }
    >
      <ScrollView>
        {ingredients.map((ingredient) => {
          const checked = selected.has(ingredient.id);
          const formatted = formatIngredient(parseIngredient(ingredient.text), { scale });
          return (
            <Tap
              key={ingredient.id}
              feedback="none"
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              onPress={() => {
                const next = new Set(selected);
                if (checked) next.delete(ingredient.id);
                else next.add(ingredient.id);
                setSelected(next);
              }}
              style={[styles.ingredientRow, { gap: space.md }]}
            >
              <Checkbox checked={checked} />
              <Text variant="body" style={{ flex: 1 }}>
                {formatted.amount ? (
                  <Text variant="body" weight="700" tone="accent">
                    {formatted.amount}{' '}
                  </Text>
                ) : null}
                {formatted.name}
              </Text>
            </Tap>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  dayRow: { flexDirection: 'row', alignItems: 'center' },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
});
