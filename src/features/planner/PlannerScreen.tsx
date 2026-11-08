import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { queryLibrary } from '@/core/model/library';
import { coverImage } from '@/core/model/recipe';
import type { DayKey, MealPlanEntry, MealSlot } from '@/core/model/types';
import { addDays, dayKey, daysFrom, parseDayKey, shortDate } from '@/core/planner/planner';
import { useDb, useFolders, usePlanEntries, useRecipes, useSettings } from '@/data/react';
import { RecipeRow } from '@/features/library';
import {
  Button,
  Chip,
  EmptyState,
  Field,
  haptic,
  Icon,
  IconButton,
  LargeHeader,
  ListRow,
  ListSection,
  Photo,
  Screen,
  SearchField,
  SegmentedControl,
  Sheet,
  Tap,
  Text,
  useTheme,
} from '@/ui';

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};
const SLOT_ORDER: Record<MealSlot, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Crouton's Meal Plan: a card per day with a header band, + and … buttons, and the planned recipes. */
export function PlannerScreen() {
  const db = useDb();
  const { colors, space, radius } = useTheme();
  const today = dayKey(new Date());
  const [start, setStart] = useState(today);
  const [length, setLength] = useState(14);
  const days = useMemo(() => daysFrom(start, length), [start, length]);
  const entries = usePlanEntries(days);
  const [pickerDay, setPickerDay] = useState<DayKey | null>(null);
  const [menuDay, setMenuDay] = useState<DayKey | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2400);
  };

  const shop = (list: MealPlanEntry[]) => {
    let count = 0;
    for (const entry of list) {
      if (!entry.recipeId) continue;
      const recipe = db.recipes.get(entry.recipeId);
      const scale = recipe?.servings && entry.servings ? entry.servings / recipe.servings : 1;
      count += db.groceries.addRecipe(entry.recipeId, { scale });
    }
    haptic('success');
    showToast(count ? `Added ${count} items to Groceries` : 'Nothing to add');
  };

  return (
    <View style={styles.fill}>
      <Screen
        header={
          <LargeHeader
            title="Meal Plan"
            right={
              <IconButton
                icon="more"
                variant="tinted"
                onPress={() => setMenuOpen(true)}
                accessibilityLabel="Meal plan options"
              />
            }
          />
        }
      >
        {start !== today ? (
          <Button
            title="Back to today"
            variant="tinted"
            size="sm"
            onPress={() => setStart(today)}
            style={{ alignSelf: 'flex-start', marginBottom: space.md }}
          />
        ) : null}
        <View style={{ gap: space.md }}>
          {days.map((day) => (
            <DayCard
              key={day}
              day={day}
              today={today}
              entries={entries.filter((e) => e.day === day)}
              onAdd={() => setPickerDay(day)}
              onMenu={() => setMenuDay(day)}
            />
          ))}
        </View>
        <Button
          title="Show more days"
          variant="tinted"
          onPress={() => setLength(length + 7)}
          style={{ marginTop: space.lg, alignSelf: 'center' }}
        />
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

      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Meal Plan">
        <ListSection>
          <ListRow
            icon="sparkles"
            iconColor="#5E5CE6"
            title="Plan dinners for me"
            subtitle="Fills empty days from your dinner recipes"
            onPress={() => {
              setMenuOpen(false);
              const added = db.planner.autofill(
                days.slice(0, 7).filter((d) => d >= today),
                'dinner',
              );
              haptic('success');
              showToast(
                added.length
                  ? `Planned ${added.length} ${added.length === 1 ? 'dinner' : 'dinners'}`
                  : 'Every dinner is already planned',
              );
            }}
          />
          <ListRow
            icon="basket"
            iconColor="#F5A623"
            title="Add this week to Groceries"
            onPress={() => {
              setMenuOpen(false);
              shop(entries.filter((e) => e.day < addDays(start, 7)));
            }}
          />
          <ListRow
            icon="back"
            iconColor="#8E8E93"
            title="Show the past week"
            onPress={() => {
              setMenuOpen(false);
              setStart(addDays(start, -7));
              setLength(length + 7);
            }}
          />
        </ListSection>
      </Sheet>

      <DaySheet
        day={menuDay}
        today={today}
        entries={menuDay ? entries.filter((e) => e.day === menuDay) : []}
        onClose={() => setMenuDay(null)}
        onShop={(list) => {
          setMenuDay(null);
          shop(list);
        }}
      />

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

function dayName(day: DayKey, today: DayKey): string {
  if (day === today) return 'Today';
  if (day === addDays(today, 1)) return 'Tomorrow';
  return WEEKDAYS[parseDayKey(day).getDay()]!;
}

function DayCard({
  day,
  today,
  entries,
  onAdd,
  onMenu,
}: {
  day: DayKey;
  today: DayKey;
  entries: MealPlanEntry[];
  onAdd: () => void;
  onMenu: () => void;
}) {
  const db = useDb();
  const { colors, space, radius } = useTheme();
  const sorted = [...entries].sort(
    (a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot] || a.sortIndex - b.sortIndex,
  );
  const showSlots = new Set(entries.map((e) => e.slot)).size > 1 || entries.some((e) => e.slot !== 'dinner');
  return (
    <View
      style={[
        styles.dayCard,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: space.xs,
          opacity: day < today ? 0.6 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.dayHeader,
          {
            backgroundColor: colors.fill,
            borderRadius: radius.lg,
            paddingLeft: space.md,
            paddingRight: space.sm,
            gap: space.sm,
          },
        ]}
      >
        <Text variant="title3" weight="600" style={styles.flex} numberOfLines={1}>
          <Text variant="title3" weight="600" tone={day === today ? 'accent' : 'primary'}>
            {dayName(day, today)}
          </Text>{' '}
          <Text variant="title3" weight="600" tone="tertiary">
            {shortDate(day)}
          </Text>
        </Text>
        <IconButton
          icon="add"
          variant="tinted"
          tint="green"
          size={34}
          onPress={onAdd}
          accessibilityLabel={`Plan a meal for ${dayName(day, today)}`}
        />
        <IconButton
          icon="more"
          variant="tinted"
          size={34}
          onPress={onMenu}
          accessibilityLabel={`Options for ${dayName(day, today)}`}
        />
      </View>
      {sorted.length ? (
        <View style={{ paddingHorizontal: space.md, paddingVertical: space.sm }}>
          {sorted.map((entry) => {
            const recipe = db.recipes.get(entry.recipeId);
            return (
              <Tap
                key={entry.id}
                style={[styles.entry, { gap: space.md }]}
                onPress={
                  recipe
                    ? () =>
                        router.push({
                          pathname: '/recipe/[id]',
                          params: { id: recipe.id, from: 'Meal Plan' },
                        })
                    : undefined
                }
                accessibilityLabel={recipe?.name ?? entry.title ?? 'Planned meal'}
              >
                {recipe ? (
                  <Photo uri={coverImage(recipe)} style={[styles.entryThumb, { borderRadius: radius.sm }]} />
                ) : (
                  <View
                    style={[
                      styles.entryThumb,
                      styles.center,
                      { borderRadius: radius.sm, backgroundColor: colors.fill },
                    ]}
                  >
                    <Icon name="notes" size={18} tone="secondary" />
                  </View>
                )}
                <View style={styles.flex}>
                  <Text variant="body" numberOfLines={1}>
                    {recipe?.name ?? entry.title ?? 'Deleted recipe'}
                  </Text>
                  {showSlots ? (
                    <Text variant="caption" tone="tertiary">
                      {SLOT_LABELS[entry.slot]}
                    </Text>
                  ) : null}
                </View>
              </Tap>
            );
          })}
        </View>
      ) : (
        <View style={{ height: space.sm }} />
      )}
    </View>
  );
}

function DaySheet({
  day,
  today,
  entries,
  onClose,
  onShop,
}: {
  day: DayKey | null;
  today: DayKey;
  entries: MealPlanEntry[];
  onClose: () => void;
  onShop: (entries: MealPlanEntry[]) => void;
}) {
  const db = useDb();
  const { colors } = useTheme();
  if (!day) return null;
  return (
    <Sheet visible onClose={onClose} title={`${dayName(day, today)}, ${shortDate(day)}`}>
      {entries.length ? (
        <ListSection title="Planned">
          {entries.map((entry) => {
            const recipe = db.recipes.get(entry.recipeId);
            return (
              <ListRow
                key={entry.id}
                title={recipe?.name ?? entry.title ?? 'Deleted recipe'}
                subtitle={SLOT_LABELS[entry.slot]}
                accessory="none"
                right={
                  <View style={styles.rowActions}>
                    <Tap
                      onPress={() => db.planner.move(entry.id, addDays(day, 1))}
                      accessibilityLabel="Move to the next day"
                      hitSlop={8}
                    >
                      <Icon name="arrowRight" size={20} tone="accent" />
                    </Tap>
                    <Tap
                      onPress={() => db.planner.remove(entry.id)}
                      accessibilityLabel="Remove from plan"
                      hitSlop={8}
                    >
                      <Icon name="trash" size={20} tone="danger" />
                    </Tap>
                  </View>
                }
              />
            );
          })}
        </ListSection>
      ) : null}
      <ListSection>
        <ListRow icon="basket" iconColor="#F5A623" title="Add to Groceries" onPress={() => onShop(entries)} />
        {entries.length ? (
          <ListRow
            icon="trash"
            iconColor={colors.danger}
            title="Clear this day"
            destructive
            onPress={() => {
              db.planner.clearDays([day]);
              onClose();
            }}
          />
        ) : null}
      </ListSection>
    </Sheet>
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
  // Pass the folder itself so smart folders (recipes collected by tag) list their recipes here too.
  const folder = scope && scope !== 'favorites' ? folders.find((f) => f.id === scope) : undefined;
  const results = useMemo(
    () =>
      queryLibrary(recipes, {
        text,
        ...(folder ? { folder } : scope === 'favorites' ? { scope: 'favorites' as const } : {}),
        sort: 'name',
      }),
    [recipes, text, folder, scope],
  );
  const today = dayKey(new Date());

  return (
    <Sheet visible={!!day} onClose={onClose} title={day ? `${dayName(day, today)}, ${shortDate(day)}` : ''}>
      <View style={{ gap: space.md }}>
        <SegmentedControl
          options={settings.plannerSlots.map((s) => ({ value: s, label: SLOT_LABELS[s] }))}
          value={slot}
          onChange={setSlot}
        />
        <SearchField value={text} onChangeText={setText} placeholder="Recipes, Ingredients" />
        <View style={[styles.chips, { gap: space.sm }]}>
          <Chip label="All" selected={!scope} onPress={() => setScope(undefined)} />
          <Chip label="Favorites" selected={scope === 'favorites'} onPress={() => setScope('favorites')} />
          {folders.map((f) => (
            <Chip key={f.id} label={f.name} selected={scope === f.id} onPress={() => setScope(f.id)} />
          ))}
        </View>
        {results.length === 0 ? <EmptyState icon="search" title="No recipes" /> : null}
        {results.map((recipe) => (
          <RecipeRow
            key={recipe.id}
            recipe={recipe}
            onPress={() => onPick(slot, recipe.id)}
            right={<Icon name="add" tone="accent" />}
          />
        ))}
        <View style={[styles.noteRow, { gap: space.sm, marginTop: space.md }]}>
          <Field
            value={note}
            onChangeText={setNote}
            placeholder="Or a note: Leftovers, Takeout…"
            style={styles.flex}
          />
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
  dayCard: { overflow: 'hidden' },
  dayHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  entry: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  entryThumb: { width: 40, height: 40 },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  noteRow: { flexDirection: 'row', alignItems: 'flex-end' },
  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
});
