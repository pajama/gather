import { useBottomTabBarHeight } from 'expo-router/tabs';
import { useMemo, useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AISLES, aisleById } from '@/core/grocery/aisles';
import type { GroceryItem } from '@/core/model/types';
import { parseIngredient, formatIngredient } from '@/core/recipe/ingredients';
import { useDb, useGroceryItems, useRecipes, useSettings } from '@/data/react';
import {
  Button,
  Checkbox,
  EmptyState,
  Field,
  haptic,
  IconButton,
  LargeHeader,
  ListRow,
  ListSection,
  Screen,
  Sheet,
  Tap,
  Text,
  useKeyboardHeight,
  useTheme,
} from '@/ui';

import { AddItemPanel } from './AddItemPanel';

type Grouping = 'none' | 'aisle' | 'recipe';

/** Crouton's Groceries: one card per item, amounts in the accent color, a keypad for adding. */
export function GroceriesScreen() {
  const db = useDb();
  const items = useGroceryItems();
  const recipes = useRecipes();
  const settings = useSettings();
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  const [grouping, setGrouping] = useState<Grouping>('none');
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<GroceryItem | null>(null);
  const keyboard = useKeyboardHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const open = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  const groups = useMemo(() => {
    if (grouping === 'none') return [{ key: 'all', title: '', items: open }];
    if (grouping === 'aisle') {
      const order = settings.aisleOrder;
      const byAisle = new Map<string, GroceryItem[]>();
      for (const item of open) byAisle.set(item.aisle, [...(byAisle.get(item.aisle) ?? []), item]);
      return [...byAisle.entries()]
        .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
        .map(([aisle, list]) => ({ key: aisle, title: aisleById(aisle).name, items: list }));
    }
    const byRecipe = new Map<string, GroceryItem[]>();
    for (const item of open) {
      const key = item.recipeIds[0] ?? 'other';
      byRecipe.set(key, [...(byRecipe.get(key) ?? []), item]);
    }
    return [...byRecipe.entries()]
      .sort((a, b) => (a[0] === 'other' ? 1 : b[0] === 'other' ? -1 : 0))
      .map(([key, list]) => ({
        key,
        title: key === 'other' ? 'Other items' : (recipes.find((r) => r.id === key)?.name ?? 'Recipe'),
        items: list,
      }));
  }, [grouping, open, recipes, settings.aisleOrder]);

  const share = async () => {
    const text = open.map((i) => `- ${i.text}`).join('\n');
    try {
      await Share.share(Platform.OS === 'web' ? { message: text, title: 'Groceries' } : { message: text });
    } catch {
      // Dismissed or unsupported.
    }
  };

  return (
    <View style={styles.fill}>
      <Screen
        header={
          <LargeHeader
            title="Groceries"
            subtitle={
              items.length
                ? `${open.length} to buy${checked.length ? ` · ${checked.length} done` : ''}`
                : undefined
            }
            right={
              <>
                <IconButton
                  icon="add"
                  variant="tinted"
                  onPress={() => setAdding(true)}
                  accessibilityLabel="Add an item"
                />
                <IconButton
                  icon="more"
                  variant="tinted"
                  onPress={() => setMenuOpen(true)}
                  accessibilityLabel="Grocery list options"
                />
              </>
            }
          />
        }
        contentStyle={{ paddingBottom: adding ? 520 : insets.bottom + 96 }}
      >
        {items.length === 0 ? (
          <EmptyState
            icon="basket"
            title="Your list is empty"
            message="Tap + to add an item, or open a recipe and tap the basket to add its ingredients."
            action={
              <Button title="Add an item" icon="add" variant="tinted" onPress={() => setAdding(true)} />
            }
          />
        ) : null}

        {open.length === 0 && items.length > 0 ? (
          <View style={[styles.allDone, { gap: space.sm, marginBottom: space.lg }]}>
            <Text variant="title3">All done!</Text>
            <Text variant="subhead" tone="secondary">
              Everything on the list is checked off.
            </Text>
          </View>
        ) : null}

        {groups.map((group) =>
          group.items.length ? (
            <View key={group.key} style={{ marginBottom: space.lg, gap: space.sm }}>
              {group.title ? (
                <Text variant="headline" tone="secondary" style={{ marginLeft: space.xs }}>
                  {group.title}
                </Text>
              ) : null}
              {group.items.map((item) => (
                <GroceryCard key={item.id} item={item} onEdit={() => setEditing(item)} />
              ))}
            </View>
          ) : null,
        )}

        {checked.length ? (
          <View style={{ gap: space.sm, marginBottom: space.lg }}>
            <View style={styles.checkedHeader}>
              <Text variant="headline" tone="secondary" style={{ marginLeft: space.xs }}>
                Checked
              </Text>
              <Tap onPress={() => db.groceries.clearChecked()} hitSlop={8}>
                <Text variant="subhead" tone="accent" weight="600">
                  Clear
                </Text>
              </Tap>
            </View>
            {checked.map((item) => (
              <GroceryCard key={item.id} item={item} onEdit={() => setEditing(item)} />
            ))}
          </View>
        ) : null}
      </Screen>

      {adding ? (
        <View
          style={[
            styles.panelWrap,
            { paddingHorizontal: space.md, bottom: Math.max(0, keyboard - tabBarHeight) },
          ]}
          pointerEvents="box-none"
        >
          <AddItemPanel
            onAdd={(text) => {
              db.groceries.addText(text);
              haptic('success');
            }}
            onClose={() => setAdding(false)}
          />
        </View>
      ) : null}

      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Groceries">
        <ListSection title="Group by">
          {(
            [
              ['none', 'Nothing'],
              ['aisle', 'Aisle'],
              ['recipe', 'Recipe'],
            ] as const
          ).map(([value, label]) => (
            <ListRow
              key={value}
              title={label}
              accessory={grouping === value ? 'check' : 'none'}
              onPress={() => {
                setGrouping(value);
                setMenuOpen(false);
              }}
            />
          ))}
        </ListSection>
        <ListSection>
          <ListRow
            icon="share"
            iconColor="#5E5CE6"
            title="Share list"
            onPress={() => {
              setMenuOpen(false);
              void share();
            }}
          />
          <ListRow
            icon="refresh"
            iconColor="#3D8EF0"
            title="Uncheck everything"
            onPress={() => {
              db.groceries.uncheckAll();
              setMenuOpen(false);
            }}
          />
          <ListRow
            icon="checkCircle"
            iconColor="#34C759"
            title="Clear checked items"
            onPress={() => {
              db.groceries.clearChecked();
              setMenuOpen(false);
            }}
          />
        </ListSection>
        <ListSection>
          <ListRow
            icon="trash"
            iconColor={colors.danger}
            title="Clear the whole list"
            destructive
            onPress={() => {
              db.groceries.clearAll();
              setMenuOpen(false);
            }}
          />
        </ListSection>
      </Sheet>

      <ItemSheet item={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

function GroceryCard({ item, onEdit }: { item: GroceryItem; onEdit: () => void }) {
  const db = useDb();
  const recipes = useRecipes();
  const { colors, radius, space } = useTheme();
  const formatted = useMemo(() => formatIngredient(parseIngredient(item.text)), [item.text]);
  const from = item.recipeIds
    .map((id) => recipes.find((r) => r.id === id)?.name)
    .filter(Boolean)
    .join(', ');
  return (
    <Tap
      feedback="none"
      onPress={() => {
        haptic();
        db.groceries.toggle(item.id);
      }}
      onLongPress={onEdit}
      delayLongPress={350}
      accessibilityHint="Long press to edit"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.checked }}
      accessibilityLabel={item.text}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          paddingHorizontal: space.md,
          gap: space.md,
          opacity: item.checked ? 0.55 : 1,
        },
      ]}
    >
      <Checkbox checked={item.checked} size={28} />
      <View style={styles.flex}>
        <Text variant="body" style={item.checked ? styles.strike : null} numberOfLines={2}>
          {formatted.amount ? <Text tone="accent">{formatted.amount} </Text> : null}
          {formatted.name}
        </Text>
        {from ? (
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {from}
          </Text>
        ) : null}
      </View>
    </Tap>
  );
}

function ItemSheet({ item, onClose }: { item: GroceryItem | null; onClose: () => void }) {
  const db = useDb();
  const { space } = useTheme();
  const [text, setText] = useState('');
  const [lastId, setLastId] = useState<string | null>(null);
  if (item && item.id !== lastId) {
    setLastId(item.id);
    setText(item.text);
  }
  if (!item) return null;
  return (
    <Sheet visible onClose={onClose} title="Edit item">
      <View style={{ gap: space.lg }}>
        <Field
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => {
            db.groceries.edit(item.id, text);
            onClose();
          }}
        />
        <ListSection title="Aisle">
          {AISLES.map((aisle) => (
            <ListRow
              key={aisle.id}
              title={aisle.name}
              accessory={item.aisle === aisle.id ? 'check' : 'none'}
              onPress={() => {
                db.groceries.setAisle(item.id, aisle.id);
                onClose();
              }}
            />
          ))}
        </ListSection>
        <View style={[styles.sheetActions, { gap: space.sm }]}>
          <Button
            title="Delete"
            variant="tinted"
            icon="trash"
            onPress={() => {
              db.groceries.remove(item.id);
              onClose();
            }}
            style={styles.flex}
          />
          <Button
            title="Save"
            onPress={() => {
              db.groceries.edit(item.id, text);
              onClose();
            }}
            style={styles.flex}
            disabled={!text.trim()}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  card: { flexDirection: 'row', alignItems: 'center', minHeight: 58, paddingVertical: 8 },
  strike: { textDecorationLine: 'line-through' },
  allDone: { alignItems: 'center', paddingVertical: 24 },
  checkedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  sheetActions: { flexDirection: 'row' },
  panelWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
});
