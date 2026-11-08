import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStorageHealth } from '@/data/react';
import { Button, Icon, IconButton, Text, useTheme } from '@/ui';

const SINGLE_FILE_PREVIEW = process.env.EXPO_PUBLIC_SINGLE_FILE === '1';

/**
 * Tells the person when their changes are not being saved: a browser without
 * storage, or a write that failed. Dismissable; a new failure shows it again.
 */
export function StorageBanner({ bottomOffset = 96 }: { bottomOffset?: number }) {
  const health = useStorageHealth();
  const { colors, radius, space } = useTheme();
  const insets = useSafeAreaInsets();
  const [dismissed, setDismissed] = useState<{ memory: boolean; failures: number }>({ memory: false, failures: 0 });

  const showMemory = !health.persistent && !dismissed.memory;
  const showFailure = health.failures > dismissed.failures;
  if (!showMemory && !showFailure) return null;

  const message = showFailure
    ? `Gather couldn’t save your last change (${health.lastError ?? 'storage error'}). Export a backup in Settings to be safe.`
    : SINGLE_FILE_PREVIEW
      ? 'This preview doesn’t save: changes last until you close it.'
      : 'This browser isn’t letting Gather save, so changes last until you close the page. Export a backup in Settings to keep them.';

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + bottomOffset, paddingHorizontal: space.md }]}>
      <View
        accessibilityRole="alert"
        style={[styles.banner, { backgroundColor: showFailure ? colors.danger : colors.text, borderRadius: radius.lg, padding: space.md, gap: space.md }]}
      >
        <Icon name={showFailure ? 'alert' : 'info'} size={20} color={colors.background} />
        <Text variant="footnote" color={colors.background} style={styles.flex}>
          {message}
        </Text>
        <IconButton
          icon="close"
          size={28}
          style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
          onPress={() => setDismissed({ memory: true, failures: health.failures })}
          accessibilityLabel="Dismiss"
        />
      </View>
    </View>
  );
}

/** Shown instead of the app when storage cannot be opened at all. */
export function StorageErrorScreen({ error, retry }: { error: unknown; retry: () => void }) {
  const { colors, space } = useTheme();
  return (
    <View style={[styles.fill, styles.center, { backgroundColor: colors.background, padding: space.xxl, gap: space.lg }]}>
      <Icon name="alert" size={40} tone="danger" />
      <Text variant="title2" align="center">
        Gather couldn’t open your recipes
      </Text>
      <Text variant="body" tone="secondary" align="center">
        Your recipes are stored on this device, and the storage didn’t open. Nothing has been deleted. Try again; if it keeps happening,
        restart the device.
      </Text>
      <Text variant="footnote" tone="tertiary" align="center">
        {error instanceof Error ? error.message : String(error)}
      </Text>
      <Button title="Try again" onPress={retry} />
    </View>
  );
}

/** Route-level error boundary: a broken screen shows this instead of unmounting the app. */
export function ScreenError({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  const { colors, space } = useTheme();
  return (
    <View style={[styles.fill, styles.center, { backgroundColor: colors.background, padding: space.xxl, gap: space.lg }]}>
      <Icon name="alert" size={40} tone="danger" />
      <Text variant="title2" align="center">
        Something went wrong on this screen
      </Text>
      <Text variant="footnote" tone="tertiary" align="center">
        {error.message}
      </Text>
      <Button title="Try again" onPress={() => void retry()} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 900 },
  banner: { flexDirection: 'row', alignItems: 'center', maxWidth: 560, width: '100%' },
});
