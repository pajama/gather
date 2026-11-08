import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { parseQuantity } from '@/core/recipe/quantity';
import { Button, IconButton, Tap, Text, tintColors, useTheme, type Tint } from '@/ui';

const UNITS = [
  { id: '', label: 'Item' },
  { id: 'tbsp', label: 'Tablespoon' },
  { id: 'tsp', label: 'Teaspoon' },
  { id: 'cup', label: 'Cup' },
  { id: 'g', label: 'Gram' },
  { id: 'kg', label: 'Kilogram' },
  { id: 'oz', label: 'Ounce' },
  { id: 'lb', label: 'Pound' },
  { id: 'ml', label: 'Millilitre' },
  { id: 'l', label: 'Litre' },
  { id: 'can', label: 'Can' },
  { id: 'bag', label: 'Bag' },
  { id: 'bunch', label: 'Bunch' },
  { id: 'package', label: 'Pack' },
];

const UNIT_TEXT: Record<string, [string, string]> = {
  tbsp: ['tbsp', 'tbsp'],
  tsp: ['tsp', 'tsp'],
  cup: ['cup', 'cups'],
  g: ['g', 'g'],
  kg: ['kg', 'kg'],
  oz: ['oz', 'oz'],
  lb: ['lb', 'lb'],
  ml: ['ml', 'ml'],
  l: ['l', 'l'],
  can: ['can', 'cans'],
  bag: ['bag', 'bags'],
  bunch: ['bunch', 'bunches'],
  package: ['pack', 'packs'],
};

/** Composes "2 cups tomatoes" from the keypad state. */
export function composeItem(amount: string, unit: string, name: string): string {
  const quantity = parseQuantity(amount.trim());
  const plural = quantity ? (quantity.max ?? quantity.value) > 1 : false;
  const unitText = unit ? UNIT_TEXT[unit]?.[plural ? 1 : 0] ?? unit : '';
  return [amount.trim(), unitText, name.trim()].filter(Boolean).join(' ');
}

function Key({ label, tint, onPress, wide }: { label: string; tint: Tint; onPress: () => void; wide?: boolean }) {
  const { colors, radius } = useTheme();
  const { fg, bg } = tintColors(colors, tint);
  return (
    <Tap haptic feedback="scale" onPress={onPress} style={[styles.key, { backgroundColor: bg, borderRadius: radius.md, flex: wide ? 2 : 1 }]} accessibilityLabel={label}>
      <Text variant="title3" weight="600" color={fg}>
        {label}
      </Text>
    </Tap>
  );
}

/**
 * Crouton's grocery entry panel: the item name in large type, unit chips,
 * fraction keys and a number pad for the amount.
 */
export function AddItemPanel({ onAdd, onClose }: { onAdd: (text: string) => void; onClose: () => void }) {
  const { colors, radius, space } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('');
  const preview = composeItem(amount, unit, name);

  const press = (key: string) => {
    if (key === 'delete') setAmount(amount.slice(0, -1));
    else setAmount(`${amount}${key}`);
  };

  const add = () => {
    if (!name.trim()) return;
    onAdd(preview);
    setName('');
    setAmount('');
    setUnit('');
  };

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xl + 6,
          padding: space.lg,
          gap: space.md,
          marginBottom: Platform.OS === 'web' ? space.md : insets.bottom ? space.sm : space.md,
          boxShadow: `0 -6px 30px ${colors.shadow}, 0 10px 30px ${colors.shadow}`,
        },
      ]}
    >
      <View style={styles.panelHeader}>
        <Button title="Done" variant="tinted" size="sm" onPress={onClose} />
        <IconButton icon="add" variant="tinted" tint="green" size={36} onPress={add} disabled={!name.trim()} accessibilityLabel="Add item" />
      </View>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Item name"
        placeholderTextColor={colors.textTertiary}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={add}
        style={[styles.nameInput, { color: colors.text }]}
        accessibilityLabel="Item name"
      />
      {amount || unit ? (
        <Text variant="subhead" tone="secondary" align="center">
          <Text variant="subhead" tone="accent">
            {composeItem(amount, unit, '') || ' '}
          </Text>{' '}
          {name.trim()}
        </Text>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {UNITS.map((u) => {
          const selected = u.id === unit;
          return (
            <Tap
              key={u.label}
              haptic
              onPress={() => setUnit(u.id)}
              style={[styles.chip, { borderRadius: radius.pill, backgroundColor: selected ? colors.accent : colors.accentSoft }]}
              accessibilityState={{ selected }}
            >
              <Text variant="subhead" rounded weight="700" color={selected ? colors.onAccent : colors.accent}>
                {u.label}
              </Text>
            </Tap>
          );
        })}
      </ScrollView>
      <View style={[styles.keyRow, { gap: space.sm }]}>
        {['¼', '⅓', '½', '⅔', '¾'].map((k) => (
          <Key key={k} label={k} tint="purple" onPress={() => press(k)} />
        ))}
      </View>
      {[
        ['1', '2', '3', '/'],
        ['4', '5', '6', '-'],
        ['7', '8', '9', '.'],
      ].map((row) => (
        <View key={row.join('')} style={[styles.keyRow, { gap: space.sm }]}>
          {row.map((k) => (
            <Key key={k} label={k} tint={/\d/.test(k) ? 'green' : 'yellow'} onPress={() => press(k)} />
          ))}
        </View>
      ))}
      <View style={[styles.keyRow, { gap: space.sm }]}>
        <Key label="0" tint="green" wide onPress={() => press('0')} />
        <Key label="delete" tint="red" wide onPress={() => press('delete')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { alignSelf: 'stretch' },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nameInput: { fontSize: 30, fontFamily: 'Nunito_800ExtraBold', textAlign: 'center', paddingVertical: 4, outlineStyle: 'none' } as never,
  chip: { paddingHorizontal: 14, height: 34, alignItems: 'center', justifyContent: 'center' },
  keyRow: { flexDirection: 'row' },
  key: { height: 46, alignItems: 'center', justifyContent: 'center' },
});
