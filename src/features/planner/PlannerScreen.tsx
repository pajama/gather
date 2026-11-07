import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { queryLibrary } from '@/core/model/library';
import { coverImage } from '@/core/model/recipe';
import type { DayKey, MealPlanEntry, MealSlot } from '@/core/model/types';
import { addDays, dayKey, daysFrom, relativeDayName, shortDate, weekRangeLabel } from '@/core/planner/planner';
import { useDb, useFolders, usePlanEntries, useRecipes, useSettings } from '@/data/react';
import { RecipeRow } from '@/features/library/RecipeCard';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  haptic,
  Icon,
  IconButton,
  LargeHeader,
  Photo,
  Screen,
  SearchField,
  SegmentedControl,
  Sheet,
  Tap,
  Text,
  useTheme,
} from '@/ui';

const SLOT_LABELS: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
const SLOT_ORDER: Record<MealSlot, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };

export function PlannerScreen() {
  const db = useDb();
  const { colors, space, radius } = useTheme();
  const today = dayKey(new Date());
  const [anchor, setAnchor] = useState(today);
  const days = useMemo(() => daysFrom(anchor, 7), [anchor]);
  const entries = usePlanEntries(days);
  const [pickerDay, setPickerDay] = useState<DayKey | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2400);
  };

  const plannedRecipes = entries.filter((e) => e.recipeId).length;

  return (
    <View style={styles.fill}>
      <Screen
        header={
          <LargeHeader
            title="Plan"
            subtitle={anchor === today ? `This week · ${weekRangeLabel(days)}` : weekRangeLabel(days)}
            right={
              <>
                <IconButton icon="back" variant="fill" onPress={() => setAnchor(addDays(anchor, -7))} accessibilityLabel="Previous week" />
                <IconButton icon="chevron" variant="fill" onPress={() => setAnchor(addDays(anchor, 7))} accessibilityLabel="Next week" />
              </>
            }
          />
        }
      >
        <View style={[styles.actions, { gap: space.sm, marginBottom: space.lg }]}>
          <Button
            title="Fill dinners"
            icon="sparkles"
            variant="tinted"
            size="sm"
            onPress={() => {
              const added = db.planner.autofill(days.filter((d) => d >= today), 'dinner');
              haptic('success');
              showToast(added.length ? `Planned ${added.length} ${added.length === 1 ? 'dinner' : 'dinners'}` : 'Every dinner is already planned');
            }}
          />
          <Button
            title="Shop for these meals"
            icon="cart"
            variant="tinted"
            size="sm"
            disabled={plannedRecipes === 0}
            onPress={() => {
              let count = 0;
              for (const entry of entries) {
                if (!entry.recipeId) continue;
                const recipe = db.recipes.get(entry.recipeId);
                const scale = recipe?.servings && entry.servings ? entry.servings / recipe.servings : 1;
                count += db.groceries.addRecipe(entry.recipeId, { scale });
              }
              haptic('success');
              showToast(`Added ${count} items to groceries`);
            }}
          />
          {anchor !== today ? <Button title="Today" variant="plain" size="sm" onPress={() => setAnchor(today)} /> : null}
        </View>

        <View style={{ gap: space.md }}>
          {days.map((day) => (
            <DayCard key={day} day={day} today={today} entries={entries.filter((e) => e.day === day)} onAdd={() => setPickerDay(day)} />
          ))}
        </View>
      </Screen>

      {toast ? (
        <View pointerEvents="none" style={[styles.toastWrap, { bottom: 132 }]}>
          <View style={[styles.toast, { backgroundColor: colors.text, borderRadius: radius.pill }]}>
            <Icon name="checkCircle" size={18} color={colors.background} />
            <Text variant="subhead" weight="600" color={colors.background}>
              {toast}
            </Text>
          </View>
        </View>
      ) : null}

      <RecipePicker
        day={pickerDay}
        onClose={() => setPickerDay(null)}
        onPick={(slot, recipeId) => {
          if (pickerDay) db.planner.add(pickerDay, slot, { recipeId });
          haptic('success');
          setPickerDay(null);
        }}
        onNote={(slot, title) => {
          if (pickerDay) db.planner.add(pickerDay, slot, { title });
          setPickerDay(null);
        }}
      />
    </View>
  );
}

function DayCard({ day, today, entries, onAdd }: { day: DayKey; today: DayKey; entries: MealPlanEntry[]; onAdd: () => void }) {
  const db = useDb();
  const { colors, space, radius } = useTheme();
  const isToday = day === today;
  const isPast = day < today;
  const slots = [...new Set(entries.map((e) => e.slot))].sort((a, b) => SLOT_ORDER[a] - SLOT_ORDER[b]);
  return (
    <Card style={{ gap: space.sm, opacity: isPast ? 0.65 : 1 }}>
      <View style={styles.dayHeader}>
        <View style={[styles.dateBadge, { backgroundColor: isToday ? colors.accent : colors.fill, borderRadius: radius.md }]}>
          <Text variant="caption" weight="700" color={isToday ? colors.onAccent : colors.textSecondary}>
            {shortDate(day).split(' ')[0]!.toUpperCase()}
          </Text>
          <Text variant="title3" color={isToday ? colors.onAccent : colors.text}>
            {shortDate(day).split(' ')[1]}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text variant="title3" tone={isToday ? 'accent' : 'primary'}>
            {relativeDayName(day, today)}
          </Text>
          {entries.length === 0 ? (
            <Text variant="footnote" tone="tertiary">
              Nothing planned
            </Text>
          ) : (
            <Text variant="footnote" tone="secondary">
              {entries.length} {entries.length === 1 ? 'meal' : 'meals'}
            </Text>
          )}
        </View>
        <IconButton icon="add" variant="tinted" size={34} onPress={onAdd} accessibilityLabel={`Plan a meal for ${relativeDayName(day, today)}`} />
      </View>
      {slots.map((slot) => (
        <View key={slot} style={{ gap: space.xs }}>
          <Text variant="overline" tone="tertiary" style={{ marginTop: space.xs }}>
            {SLOT_LABELS[slot]}
          </Text>
          {entries
            .filter((e) => e.slot === slot)
            .map((entry) => {
              const recipe = db.recipes.get(entry.recipeId);
              return (
                <View key={entry.id} style={[styles.entry, { gap: space.md, backgroundColor: colors.fill, borderRadius: radius.md, padding: space.sm }]}>
                  <Tap
                    style={[styles.entryMain, { gap: space.md }]}
                    onPress={recipe ? () => router.push(`/recipe/${recipe.id}`) : undefined}
                    accessibilityLabel={recipe?.name ?? entry.title ?? 'Planned meal'}
                  >
                    {recipe ? (
                      <Photo uri={coverImage(recipe)} style={[styles.entryThumb, { borderRadius: radius.sm }]} />
                    ) : (
                      <View style={[styles.entryThumb, styles.center, { borderRadius: radius.sm, backgroundColor: colors.accentSoft }]}>
                        <Icon name="notes" size={20} tone="accent" />
                      </View>
                    )}
                    <Text variant="headline" numberOfLines={2} style={styles.flex}>
                      {recipe?.name ?? entry.title ?? 'Deleted recipe'}
                    </Text>
                  </Tap>
                  <IconButton icon="close" size={28} onPress={() => db.planner.remove(entry.id)} accessibilityLabel="Remove from plan" />
                </View>
              );
            })}
        </View>
      ))}
    </Card>
  );
}

function defaultSlotFor(slots: MealSlot[]): MealSlot {
  return slots.includes('dinner') ? 'dinner' : (slots[0] ?? 'dinner');
}

function RecipePicker({
  day,
  onClose,
  onPick,
  onNote,
}: {
  day: DayKey | null;
  onClose: () => void;
  onPick: (slot: MealSlot, recipeId: string) => void;
  onNote: (slot: MealSlot, title: string) => void;
}) {
  const recipes = useRecipes();
  const folders = useFolders();
  const settings = useSettings();
  const { space } = useTheme();
  const [text, setText] = useState('');
  const [scope, setScope] = useState<string | undefined>(undefined);
  const [note, setNote] = useState('');
  const [slot, setSlot] = useState<MealSlot>(defaultSlotFor(settings.plannerSlots));
  const results = useMemo(() => queryLibrary(recipes, { text, ...(scope ? { scope } : {}), sort: 'name' }), [recipes, text, scope]);
  const today = dayKey(new Date());

  return (
    <Sheet visible={!!day} onClose={onClose} title={day ? `${relativeDayName(day, today)}, ${shortDate(day)}` : ''}>
      <View style={{ gap: space.md }}>
        <SegmentedControl options={settings.plannerSlots.map((s) => ({ value: s, label: SLOT_LABELS[s] }))} value={slot} onChange={setSlot} />
        <SearchField value={text} onChangeText={setText} placeholder="Search recipes" />
        <View style={[styles.chips, { gap: space.sm }]}>
          <Chip label="All" selected={!scope} onPress={() => setScope(undefined)} />
          <Chip label="Favorites" selected={scope === 'favorites'} onPress={() => setScope('favorites')} />
          {folders.map((f) => (
            <Chip key={f.id} label={f.name} selected={scope === f.id} onPress={() => setScope(f.id)} />
          ))}
        </View>
        {results.length === 0 ? <EmptyState icon="search" title="No recipes" /> : null}
        {results.map((recipe) => (
          <RecipeRow key={recipe.id} recipe={recipe} onPress={() => onPick(slot, recipe.id)} right={<Icon name="add" tone="accent" />} />
        ))}
        <View style={[styles.noteRow, { gap: space.sm, marginTop: space.md }]}>
          <Field value={note} onChangeText={setNote} placeholder="Or a note: Leftovers, Takeout…" style={styles.flex} />
          <Button
            title="Add"
            variant="tinted"
            disabled={!note.trim()}
            onPress={() => {
              onNote(slot, note.trim());
              setNote('');
            }}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateBadge: { width: 48, height: 52, alignItems: 'center', justifyContent: 'center' },
  entry: { flexDirection: 'row', alignItems: 'center' },
  entryMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  entryThumb: { width: 48, height: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  noteRow: { flexDirection: 'row', alignItems: 'flex-end' },
  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
});
