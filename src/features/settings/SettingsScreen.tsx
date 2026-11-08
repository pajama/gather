import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { crumbArchive } from '@/core/import/crumb';
import { newId, recipeToDraft } from '@/core/model/recipe';
import { MEAL_SLOTS, type MealSlot, type UnitPreference } from '@/core/model/types';
import { BackupError } from '@/data/database';
import { useDb, useRecipes, useSettings } from '@/data/react';
import { pickBackupFile, saveBackupFile } from '@/data/services/backup-file';
import { shareBinaryFile } from '@/data/services/pick-file';
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
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    let live = true;
    db.canUndoRestore()
      .then((value) => live && setCanUndo(value))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [db]);

  const exportBackup = async () => {
    const backup = db.exportBackup();
    const stamp = new Date().toISOString().slice(0, 10);
    await saveBackupFile(`gather-backup-${stamp}.json`, JSON.stringify(backup, null, 2));
    setStatus(`Exported ${backup.recipes.length} recipes`);
  };

  const importBackup = async () => {
    const text = await pickBackupFile();
    if (!text) return;
    let parsed: unknown;
    let count = 0;
    try {
      parsed = JSON.parse(text);
      count = Array.isArray((parsed as { recipes?: unknown }).recipes) ? (parsed as { recipes: unknown[] }).recipes.length : 0;
      if ((parsed as { format?: unknown }).format !== 'gather-backup') throw new BackupError('That file isn’t a Gather backup.');
    } catch (error) {
      setStatus(error instanceof BackupError ? error.message : 'That file isn’t a Gather backup.');
      return;
    }
    confirm(
      'Replace everything?',
      `Restoring replaces your library with ${count} recipes from the backup. Your current library is kept, so you can undo this.`,
      () => {
        db.restoreBackup(parsed)
          .then((result) => {
            setStatus(`Restored ${result.recipes} recipes`);
            setCanUndo(true);
          })
          .catch((error: unknown) => {
            setStatus(error instanceof BackupError ? error.message : `Restore failed, so nothing was changed. (${String(error)})`);
          });
      },
    );
  };

  const undoRestore = () => {
    confirm('Undo the restore?', 'Your library goes back to how it was before the last restore.', () => {
      db.undoRestore()
        .then((result) => {
          setStatus(`Put back ${result.recipes} recipes from before the restore`);
          setCanUndo(false);
        })
        .catch((error: unknown) => setStatus(`Couldn’t undo the restore. (${String(error)})`));
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
        {canUndo ? <ListRow icon="undo" iconColor="#8E8E93" title="Undo last restore" subtitle="Put back the library from before it" onPress={undoRestore} /> : null}
      </ListSection>

      <ListSection title="Other apps" footer="Crouton opens .crumb files, so recipes can move between the two apps in either direction.">
        <ListRow
          icon="download"
          iconColor="#F5A623"
          title="Import recipes"
          subtitle="From Crouton, Paprika or a Gather file"
          onPress={() => router.push({ pathname: '/import', params: { mode: 'file' } })}
        />
        <ListRow
          icon="upload"
          iconColor="#5E5CE6"
          title="Export for Crouton"
          subtitle="Every recipe as a .crumb file, in one zip"
          onPress={() => {
            const zip = crumbArchive(recipes.map(recipeToDraft), () => newId().toUpperCase());
            void shareBinaryFile('Gather recipes.zip', zip);
            setStatus(`Exported ${recipes.length} recipes for Crouton`);
          }}
        />
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
