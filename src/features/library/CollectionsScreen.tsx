import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { inFolder } from '@/core/model/library';
import type { Folder } from '@/core/model/types';
import { useDb, useFolders, useRecipes, useSettings } from '@/data/react';
import { Icon, IconButton, LargeHeader, Screen, Sheet, Tap, Text, useTheme, type IconName } from '@/ui';

import { FolderSheet } from './FolderSheet';
import { TAG_COLORS, useTagColor } from './tagColors';

function CollectionRow({
  icon,
  iconColor,
  title,
  titleColor,
  subtitle,
  onPress,
  onLongPress,
  right,
  first,
}: {
  icon: IconName;
  iconColor?: string;
  title: string;
  titleColor?: string;
  subtitle?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  right?: React.ReactNode;
  first?: boolean;
}) {
  const { colors, space } = useTheme();
  return (
    <Tap
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.row, { paddingHorizontal: space.lg, gap: space.md, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: colors.separator }]}
      accessibilityLabel={title}
    >
      <Icon name={icon} size={24} color={iconColor ?? colors.accent} />
      <View style={styles.flex}>
        <Text variant="body" color={titleColor} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? <Icon name="chevron" size={18} tone="tertiary" />}
    </Tap>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, radius, space } = useTheme();
  return (
    <View style={{ marginBottom: space.xl }}>
      <Text variant="subhead" tone="secondary" style={{ marginBottom: space.sm, marginLeft: space.xs }}>
        {title}
      </Text>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

const count = (n: number) => `${n} ${n === 1 ? 'recipe' : 'recipes'}`;

/** Folders and tags, like Crouton's Collections list and iPad sidebar. */
export function CollectionsScreen() {
  const db = useDb();
  const recipes = useRecipes();
  const folders = useFolders();
  const settings = useSettings();
  const colorFor = useTagColor();
  const { colors, space } = useTheme();
  const [editing, setEditing] = useState(false);
  const [folderSheet, setFolderSheet] = useState<{ folder?: Folder } | null>(null);
  const [colorTag, setColorTag] = useState<string | null>(null);

  const folderCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of folders) map.set(f.id, recipes.filter((r) => inFolder(r, f)).length);
    return map;
  }, [recipes, folders]);
  const tags = useMemo(() => {
    const map = new Map<string, { label: string; n: number }>();
    for (const r of recipes)
      for (const t of r.tags) {
        const key = t.toLowerCase();
        const entry = map.get(key) ?? { label: t, n: 0 };
        entry.n++;
        map.set(key, entry);
      }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [recipes]);
  const favorites = recipes.filter((r) => r.favorite).length;

  return (
    <Screen
      header={
        <LargeHeader
          title="Collections"
          right={
            <>
              <IconButton icon={editing ? 'check' : 'edit'} variant="tinted" onPress={() => setEditing(!editing)} accessibilityLabel={editing ? 'Done editing' : 'Edit folders'} />
              <IconButton icon="add" variant="tinted" onPress={() => setFolderSheet({})} accessibilityLabel="New folder" />
            </>
          }
        />
      }
    >
      <Section title="Library">
        <CollectionRow first icon="recipes" title="All Recipes" subtitle={count(recipes.length)} onPress={() => router.navigate('/')} />
        <CollectionRow icon="heart" iconColor="#FF2D55" title="Favorites" subtitle={count(favorites)} onPress={() => router.push({ pathname: '/collection/[id]', params: { id: 'favorites' } })} />
      </Section>

      <Section title="Folders">
        {folders.map((f, i) => (
          <CollectionRow
            key={f.id}
            first={i === 0}
            icon={f.tags?.length ? 'sparkles' : 'folderFilled'}
            title={f.name}
            subtitle={`${count(folderCounts.get(f.id) ?? 0)}${f.tags?.length ? ` · tagged ${f.tags.join(f.tagMatch === 'all' ? ' + ' : ' or ')}` : ''}`}
            onPress={editing ? () => setFolderSheet({ folder: f }) : () => router.push({ pathname: '/collection/[id]', params: { id: f.id } })}
            onLongPress={() => setFolderSheet({ folder: f })}
            right={
              editing ? (
                <Tap onPress={() => db.folders.delete(f.id)} accessibilityLabel={`Delete ${f.name}`} hitSlop={8}>
                  <Icon name="trash" size={20} tone="danger" />
                </Tap>
              ) : undefined
            }
          />
        ))}
        <CollectionRow first={folders.length === 0} icon="add" title="New Folder" onPress={() => setFolderSheet({})} right={<View />} />
      </Section>

      {tags.length ? (
        <Section title="Tags">
          {tags.map((t, i) => (
            <CollectionRow
              key={t.label}
              first={i === 0}
              icon="ellipse"
              iconColor={colorFor(t.label)}
              title={t.label}
              titleColor={colorFor(t.label)}
              subtitle={count(t.n)}
              onPress={editing ? () => setColorTag(t.label) : () => router.push({ pathname: '/collection/[id]', params: { id: `tag:${encodeURIComponent(t.label)}` } })}
              onLongPress={() => setColorTag(t.label)}
            />
          ))}
        </Section>
      ) : null}

      <FolderSheet
        visible={!!folderSheet}
        {...(folderSheet?.folder ? { folder: folderSheet.folder } : {})}
        allTags={tags.map((t) => t.label)}
        onClose={() => setFolderSheet(null)}
        onCreated={(folder) => router.push({ pathname: '/collection/[id]', params: { id: folder.id } })}
      />

      <Sheet visible={!!colorTag} onClose={() => setColorTag(null)} title={colorTag ? `Color for “${colorTag}”` : ''}>
        <View style={[styles.swatches, { gap: space.md }]}>
          {TAG_COLORS.map((color) => {
            const selected = !!colorTag && colorFor(colorTag) === color;
            return (
              <Tap
                key={color}
                onPress={() => {
                  if (!colorTag) return;
                  db.updateSettings({ tagColors: { ...settings.tagColors, [colorTag.toLowerCase()]: color } });
                  setColorTag(null);
                }}
                accessibilityLabel={`Use ${color}`}
                accessibilityState={{ selected }}
                style={[styles.swatch, { backgroundColor: color, borderColor: selected ? colors.text : 'transparent' }]}
              >
                {selected ? <Icon name="check" size={20} color="#FFFFFF" /> : null}
              </Tap>
            );
          })}
        </View>
        <Text variant="footnote" tone="secondary" style={{ marginTop: space.lg }}>
          Tip: long-press a tag or folder to change it.
        </Text>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 58, paddingVertical: 8 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  swatch: { width: 52, height: 52, borderRadius: 26, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
