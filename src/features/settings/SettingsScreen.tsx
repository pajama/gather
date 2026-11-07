import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { MEAL_SLOTS, type MealSlot, type UnitPreference } from '@/core/model/types';
import type { Backup } from '@/data/database';
import { useDb, useRecipes, useSettings } from '@/data/react';
import { pickBackupFile, saveBackupFile } from '@/data/services/backup-file';
import { ACCENTS, Chip, haptic, Icon, LargeHeader, ListRow, ListSection, Screen, SegmentedControl, Tap, Text, useTheme } from '@/ui';

const SLOT_LABELS: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

function confirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`) ?? true) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Continue', style: 'destructive', onPress: onConfirm },
  ]);
}

export function SettingsScreen() {
  const db = useDb();
  const settings = useSettings();
  const recipes = useRecipes();
  const { colors, space, radius, scheme } = useTheme();
  const [status, setStatus] = useState<string | null>(null);

  const exportBackup = async () => {
    const backup = db.exportBackup();
    const stamp = new Date().toISOString().slice(0, 10);
    await saveBackupFile(`gather-backup-${stamp}.json`, JSON.stringify(backup, null, 2));
    setStatus(`Exported ${backup.recipes.length} recipes`);
  };

  const importBackup = async () => {
    const text = await pickBackupFile();
    if (!text) return;
    let backup: Backup;
    try {
      backup = JSON.parse(text) as Backup;
      if (backup.format !== 'gather-backup') throw new Error('format');
    } catch {
      setStatus('That file isn’t a Gather backup.');
      return;
    }
    confirm('Replace everything?', `Restoring replaces your library with ${backup.recipes.length} recipes from the backup.`, () => {
      db.restoreBackup(backup);
      setStatus(`Restored ${backup.recipes.length} recipes`);
    });
  };

  const toggleSlot = (slot: MealSlot) => {
    const has = settings.plannerSlots.includes(slot);
    if (has && settings.plannerSlots.length === 1) return;
    const next = has ? settings.plannerSlots.filter((s) => s !== slot) : MEAL_SLOTS.filter((s) => s === slot || settings.plannerSlots.includes(s));
    db.updateSettings({ plannerSlots: next });
  };

  return (
    <Screen header={<LargeHeader title="Settings" />}>
      <ListSection title="Accent color">
        <View style={[styles.swatches, { padding: space.lg, gap: space.md }]}>
          {ACCENTS.map((accent) => {
            const selected = accent.id === settings.accent;
            const color = scheme === 'dark' ? accent.dark : accent.light;
            return (
              <Tap
                key={accent.id}
                onPress={() => {
                  haptic();
                  db.updateSettings({ accent: accent.id });
                }}
                accessibilityLabel={accent.name}
                accessibilityState={{ selected }}
                style={styles.swatchWrap}
              >
                <View style={[styles.swatch, { backgroundColor: color, borderColor: selected ? colors.text : 'transparent' }]}>
                  {selected ? <Icon name="check" size={18} color={accent.onAccent} /> : null}
                </View>
                <Text variant="caption" tone={selected ? 'primary' : 'secondary'} numberOfLines={1}>
                  {accent.name}
                </Text>
              </Tap>
            );
          })}
        </View>
      </ListSection>

      <ListSection title="Appearance">
        <View style={{ padding: space.md }}>
          <SegmentedControl
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light', icon: 'sun' },
              { value: 'dark', label: 'Dark', icon: 'moon' },
            ]}
            value={settings.theme}
            onChange={(theme) => db.updateSettings({ theme })}
          />
        </View>
      </ListSection>

      <ListSection title="Cooking" footer="Converted amounts are rounded to friendly kitchen measures.">
        <View style={{ padding: space.md, gap: space.sm }}>
          <Text variant="subhead" tone="secondary">
            Show amounts in
          </Text>
          <SegmentedControl
            options={[
              { value: 'original', label: 'As written' },
              { value: 'us', label: 'US' },
              { value: 'metric', label: 'Metric' },
            ]}
            value={settings.units}
            onChange={(units) => db.updateSettings({ units: units as UnitPreference })}
          />
        </View>
        <ListRow
          icon="sunny"
          iconColor="#E89A14"
          title="Keep screen awake"
          subtitle="While a recipe or cook mode is open"
          accessory="switch"
          switchValue={settings.keepAwake}
          onSwitch={(keepAwake) => db.updateSettings({ keepAwake })}
        />
      </ListSection>

      <ListSection title="Planner">
        <View style={{ padding: space.md, gap: space.sm }}>
          <Text variant="subhead" tone="secondary">
            Meals to plan
          </Text>
          <View style={[styles.chips, { gap: space.sm }]}>
            {MEAL_SLOTS.map((slot) => (
              <Chip key={slot} label={SLOT_LABELS[slot]} selected={settings.plannerSlots.includes(slot)} onPress={() => toggleSlot(slot)} />
            ))}
          </View>
        </View>
      </ListSection>

      <ListSection title="Your data" footer={status ?? `${recipes.length} recipes stored on this device.`}>
        <ListRow icon="upload" iconColor="#5E8BD6" title="Export a backup" subtitle="Everything, as one file" onPress={() => void exportBackup()} />
        <ListRow icon="download" iconColor="#2F9E5B" title="Restore from backup" onPress={() => void importBackup()} />
      </ListSection>

      <View style={[styles.about, { gap: space.xs, borderRadius: radius.lg }]}>
        <Text variant="headline">Gather</Text>
        <Text variant="footnote" tone="secondary">
          Version {Constants.expoConfig?.version ?? '0.1.0'}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  swatches: { flexDirection: 'row', flexWrap: 'wrap' },
  swatchWrap: { alignItems: 'center', width: 64, gap: 6 },
  swatch: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  about: { alignItems: 'center', paddingVertical: 24 },
});
