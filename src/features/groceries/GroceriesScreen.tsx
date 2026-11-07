import { useMemo, useState } from 'react';
import { Platform, Share, StyleSheet, TextInput, View } from 'react-native';

import { AISLES, aisleById } from '@/core/grocery/aisles';
import type { GroceryItem } from '@/core/model/types';
import { useDb, useGroceryItems, useRecipes, useSettings } from '@/data/react';
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  haptic,
  Icon,
  IconButton,
  LargeHeader,
  ListRow,
  ListSection,
  Screen,
  SegmentedControl,
  Sheet,
  Tap,
  Text,
  useTheme,
  type IconName,
} from '@/ui';

type Grouping = 'aisle' | 'recipe';

export function GroceriesScreen() {
  const db = useDb();
  const items = useGroceryItems();
  const recipes = useRecipes();
  const settings = useSettings();
  const { colors, space, radius } = useTheme();
  const [draft, setDraft] = useState('');
  const [grouping, setGrouping] = useState<Grouping>('aisle');
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState<GroceryItem | null>(null);
  const [showChecked, setShowChecked] = useState(true);

  const open = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  const groups = useMemo(() => {
    if (grouping === 'aisle') {
      const order = settings.aisleOrder;
      const byAisle = new Map<string, GroceryItem[]>();
      for (const item of open) byAisle.set(item.aisle, [...(byAisle.get(item.aisle) ?? []), item]);
      return [...byAisle.entries()]
        .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
        .map(([aisle, list]) => ({ key: aisle, title: aisleById(aisle).name, icon: aisleById(aisle).icon as IconName | string, items: list }));
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
        icon: key === 'other' ? 'basket' : 'restaurant',
        items: list,
      }));
  }, [grouping, open, recipes, settings.aisleOrder]);

  const add = () => {
    if (!draft.trim()) return;
    for (const line of draft.split(/\n|,(?![^(]*\))/)) db.groceries.addText(line);
    setDraft('');
    haptic();
  };

  const share = async () => {
    const text = groups.map((g) => `${g.title}\n${g.items.map((i) => `- ${i.text}`).join('\n')}`).join('\n\n');
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
            subtitle={items.length ? `${open.length} to buy${checked.length ? ` · ${checked.length} in the cart` : ''}` : undefined}
            right={<IconButton icon="more" variant="fill" onPress={() => setMenuOpen(true)} accessibilityLabel="Grocery list actions" />}
          />
        }
      >
        <View style={[styles.addRow, { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: space.md, gap: space.sm, marginBottom: space.lg }]}>
          <Icon name="add" tone="accent" />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            placeholder="Add an item, like 2 lemons"
            placeholderTextColor={colors.textTertiary}
            returnKeyType="done"
            blurOnSubmit={false}
            style={[styles.addInput, { color: colors.text }]}
            accessibilityLabel="Add an item"
          />
          {draft.trim() ? (
            <Button title="Add" size="sm" onPress={add} />
          ) : null}
        </View>

        {items.length === 0 ? (
          <EmptyState
            icon="cart"
            title="Your list is empty"
            message="Add items above, or open a recipe and tap the cart to add its ingredients."
          />
        ) : (
          <>
            <SegmentedControl
              options={[
                { value: 'aisle', label: 'By aisle' },
                { value: 'recipe', label: 'By recipe' },
              ]}
              value={grouping}
              onChange={setGrouping}
              style={{ marginBottom: space.lg }}
            />
            {open.length === 0 ? (
              <Card style={[styles.allDone, { gap: space.md, marginBottom: space.lg }]}>
                <Icon name="checkCircle" size={28} tone="accent" />
                <View style={styles.flex}>
                  <Text variant="headline">All done!</Text>
                  <Text variant="footnote" tone="secondary">
                    Everything on the list is in the cart.
                  </Text>
                </View>
              </Card>
            ) : null}
            {groups.map((group) => (
              <View key={group.key} style={{ marginBottom: space.lg }}>
                <View style={[styles.groupHeader, { gap: space.sm, marginBottom: space.sm, paddingHorizontal: space.xs }]}>
                  <Text variant="headline">{group.title}</Text>
                  <Text variant="footnote" tone="tertiary">
                    {group.items.length}
                  </Text>
                </View>
                <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
                  {group.items.map((item, index) => (
                    <GroceryRow key={item.id} item={item} first={index === 0} onMore={() => setEditing(item)} />
                  ))}
                </View>
              </View>
            ))}
            {checked.length ? (
              <View style={{ marginBottom: space.lg }}>
                <View style={[styles.groupHeader, { marginBottom: space.sm, paddingHorizontal: space.xs }]}>
                  <Tap onPress={() => setShowChecked(!showChecked)} style={[styles.groupHeader, styles.flex, { gap: space.sm }]}>
                    <Text variant="headline" tone="secondary">
                      In the cart
                    </Text>
                    <Icon name={showChecked ? 'chevronDown' : 'chevron'} size={16} tone="tertiary" />
                  </Tap>
                  <Tap onPress={() => db.groceries.clearChecked()} hitSlop={8}>
                    <Text variant="subhead" tone="accent" weight="600">
                      Clear
                    </Text>
                  </Tap>
                </View>
                {showChecked ? (
                  <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
                    {checked.map((item, index) => (
                      <GroceryRow key={item.id} item={item} first={index === 0} onMore={() => setEditing(item)} />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        )}
      </Screen>

      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Groceries">
        <ListSection>
          <ListRow icon="share" title="Share list" onPress={() => { setMenuOpen(false); void share(); }} />
          <ListRow icon="refresh" iconColor="#5E8BD6" title="Uncheck everything" onPress={() => { db.groceries.uncheckAll(); setMenuOpen(false); }} />
          <ListRow icon="checkCircle" iconColor="#2F9E5B" title="Clear checked items" onPress={() => { db.groceries.clearChecked(); setMenuOpen(false); }} />
        </ListSection>
        <ListSection>
          <ListRow icon="trash" iconColor={colors.danger} title="Clear the whole list" destructive onPress={() => { db.groceries.clearAll(); setMenuOpen(false); }} />
        </ListSection>
      </Sheet>

      <ItemSheet item={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

function GroceryRow({ item, first, onMore }: { item: GroceryItem; first: boolean; onMore: () => void }) {
  const db = useDb();
  const recipes = useRecipes();
  const { colors, space } = useTheme();
  const from = item.recipeIds
    .map((id) => recipes.find((r) => r.id === id)?.name)
    .filter(Boolean)
    .join(', ');
  return (
    <View style={[styles.itemRow, { paddingHorizontal: space.md, gap: space.md, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: colors.separator }]}>
      <Tap
        feedback="none"
        style={[styles.itemMain, { gap: space.md }]}
        onPress={() => {
          haptic();
          db.groceries.toggle(item.id);
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.checked }}
        accessibilityLabel={item.text}
      >
        <Checkbox checked={item.checked} />
        <View style={styles.flex}>
          <Text variant="body" tone={item.checked ? 'tertiary' : 'primary'} style={item.checked ? styles.strike : null}>
            {item.text}
          </Text>
          {from ? (
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {from}
            </Text>
          ) : null}
        </View>
      </Tap>
      <IconButton icon="more" size={30} onPress={onMore} accessibilityLabel={`More for ${item.text}`} />
    </View>
  );
}

function ItemSheet({ item, onClose }: { item: GroceryItem | null; onClose: () => void }) {
  const db = useDb();
  const { colors, space } = useTheme();
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
        <Field value={text} onChangeText={setText} onSubmitEditing={() => { db.groceries.edit(item.id, text); onClose(); }} />
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
          <Button title="Delete" variant="tinted" icon="trash" onPress={() => { db.groceries.remove(item.id); onClose(); }} style={[styles.flex, { backgroundColor: colors.fill }]} />
          <Button title="Save" onPress={() => { db.groceries.edit(item.id, text); onClose(); }} style={styles.flex} disabled={!text.trim()} />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  addInput: { flex: 1, fontSize: 17, height: 52, outlineStyle: 'none' } as never,
  groupHeader: { flexDirection: 'row', alignItems: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center', minHeight: 54 },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  strike: { textDecorationLine: 'line-through' },
  allDone: { flexDirection: 'row', alignItems: 'center' },
  sheetActions: { flexDirection: 'row' },
});
