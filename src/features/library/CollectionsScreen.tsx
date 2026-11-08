import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useDb, useFolders, useRecipes } from '@/data/react';
import { Button, Field, Icon, IconButton, LargeHeader, Screen, Sheet, Tap, Text, useTheme, type IconName } from '@/ui';

/** Tag dot colors, picked deterministically from the tag name. */
const TAG_COLORS = ['#A050E0', '#3D8EF0', '#34C759', '#F5A623', '#FF2D55', '#20A889', '#5E5CE6', '#FF9500'];

export function tagColor(tag: string): string {
  let hash = 0;
  for (const ch of tag.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length]!;
}

function CollectionRow({
  icon,
  iconColor,
  title,
  titleColor,
  subtitle,
  onPress,
  right,
  first,
}: {
  icon: IconName;
  iconColor?: string;
  title: string;
  titleColor?: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  first?: boolean;
}) {
  const { colors, space } = useTheme();
  return (
    <Tap
      onPress={onPress}
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
  const { space } = useTheme();
  const [editing, setEditing] = useState(false);
  const [newFolder, setNewFolder] = useState(false);
  const [name, setName] = useState('');

  const folderCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of recipes) for (const f of r.folderIds) map.set(f, (map.get(f) ?? 0) + 1);
    return map;
  }, [recipes]);
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

  const create = () => {
    if (!name.trim()) return;
    const folder = db.folders.create(name);
    setName('');
    setNewFolder(false);
    router.push({ pathname: '/collection/[id]', params: { id: folder.id } });
  };

  return (
    <Screen
      header={
        <LargeHeader
          title="Collections"
          right={
            <>
              <IconButton icon={editing ? 'check' : 'edit'} variant="tinted" onPress={() => setEditing(!editing)} accessibilityLabel={editing ? 'Done editing' : 'Edit folders'} />
              <IconButton icon="add" variant="tinted" onPress={() => setNewFolder(true)} accessibilityLabel="New folder" />
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
            icon="folderFilled"
            title={f.name}
            subtitle={count(folderCounts.get(f.id) ?? 0)}
            onPress={editing ? undefined : () => router.push({ pathname: '/collection/[id]', params: { id: f.id } })}
            right={
              editing ? (
                <Tap onPress={() => db.folders.delete(f.id)} accessibilityLabel={`Delete ${f.name}`} hitSlop={8}>
                  <Icon name="trash" size={20} tone="danger" />
                </Tap>
              ) : undefined
            }
          />
        ))}
        <CollectionRow first={folders.length === 0} icon="add" title="New Folder" onPress={() => setNewFolder(true)} right={<View />} />
      </Section>

      {tags.length ? (
        <Section title="Tags">
          {tags.map((t, i) => (
            <CollectionRow
              key={t.label}
              first={i === 0}
              icon="ellipse"
              iconColor={tagColor(t.label)}
              title={t.label}
              titleColor={tagColor(t.label)}
              subtitle={count(t.n)}
              onPress={() => router.push({ pathname: '/collection/[id]', params: { id: `tag:${encodeURIComponent(t.label)}` } })}
            />
          ))}
        </Section>
      ) : null}

      <Sheet visible={newFolder} onClose={() => setNewFolder(false)} title="New folder">
        <View style={{ gap: space.lg }}>
          <Field value={name} onChangeText={setName} placeholder="Folder name" autoFocus onSubmitEditing={create} returnKeyType="done" />
          <Button title="Create folder" onPress={create} disabled={!name.trim()} full />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 58, paddingVertical: 8 },
  flex: { flex: 1 },
});
