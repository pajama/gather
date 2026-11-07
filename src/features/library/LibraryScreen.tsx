import { useFocusEffect, router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hostLabel } from '@/core/import/html';
import { LIBRARY_SORTS, queryLibrary, type LibrarySort } from '@/core/model/library';
import type { Recipe } from '@/core/model/types';
import { useDb, useFolders, useRecipes } from '@/data/react';
import {
  Button,
  Chip,
  CONTENT_MAX_WIDTH,
  EmptyState,
  Field,
  Icon,
  IconButton,
  LargeHeader,
  ListRow,
  ListSection,
  SearchField,
  Sheet,
  Tap,
  Text,
  useTheme,
} from '@/ui';

import { RecipeCard } from './RecipeCard';

type Scope = 'all' | 'favorites' | string;

export function LibraryScreen() {
  const db = useDb();
  const recipes = useRecipes();
  const folders = useFolders();
  const { colors, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [text, setText] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [sort, setSort] = useState<LibrarySort>('recent');
  const [addOpen, setAddOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [folderSheet, setFolderSheet] = useState<{ mode: 'new' } | { mode: 'manage' } | null>(null);
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const dismissedUrls = useRef(new Set<string>());

  const contentWidth = Math.min(width, CONTENT_MAX_WIDTH);
  const gutter = width >= 720 ? 24 : 16;
  const columns = contentWidth >= 700 ? 4 : contentWidth >= 520 ? 3 : 2;
  const gap = 14;
  const cardWidth = Math.floor((contentWidth - gutter * 2 - gap * (columns - 1)) / columns);

  const results = useMemo(
    () => queryLibrary(recipes, { text, scope: scope === 'all' ? undefined : scope, sort }),
    [recipes, text, scope, sort],
  );

  // Offer to import a recipe URL found on the clipboard (native only; the web needs a user gesture).
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') return;
      let cancelled = false;
      (async () => {
        try {
          if (!(await Clipboard.hasUrlAsync?.())) return;
          const value = (await Clipboard.getStringAsync()).trim();
          if (!cancelled && /^https?:\/\//.test(value) && !dismissedUrls.current.has(value)) {
            const known = db.recipes.all().some((r) => r.sourceUrl === value);
            if (!known) setClipboardUrl(value);
          }
        } catch {
          // Clipboard access can be refused; the banner is a convenience.
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [db]),
  );

  const scopeTitle =
    scope === 'all' ? 'All Recipes' : scope === 'favorites' ? 'Favorites' : (folders.find((f) => f.id === scope)?.name ?? 'Recipes');

  const header = (
    <View style={{ gap: space.md, marginBottom: space.lg }}>
      <LargeHeader
        title="Recipes"
        right={
          <>
            <IconButton icon="sort" variant="fill" onPress={() => setSortOpen(true)} accessibilityLabel="Sort recipes" />
            <IconButton icon="add" variant="filled" onPress={() => setAddOpen(true)} accessibilityLabel="Add recipe" />
          </>
        }
      />
      {clipboardUrl ? (
        <View style={[styles.banner, { backgroundColor: colors.accentSoft, borderRadius: radius.lg, padding: space.md, gap: space.md }]}>
          <Icon name="clipboard" tone="accent" />
          <View style={{ flex: 1 }}>
            <Text variant="headline">Import from {hostLabel(clipboardUrl) ?? 'link'}?</Text>
            <Text variant="footnote" tone="secondary" numberOfLines={1}>
              {clipboardUrl}
            </Text>
          </View>
          <Button
            title="Import"
            size="sm"
            onPress={() => {
              const url = clipboardUrl;
              dismissedUrls.current.add(url);
              setClipboardUrl(null);
              router.push({ pathname: '/import', params: { url } });
            }}
          />
          <IconButton
            icon="close"
            size={28}
            onPress={() => {
              dismissedUrls.current.add(clipboardUrl);
              setClipboardUrl(null);
            }}
            accessibilityLabel="Dismiss"
          />
        </View>
      ) : null}
      <SearchField value={text} onChangeText={setText} placeholder="Search recipes and ingredients" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} style={{ marginHorizontal: -gutter }}>
        <View style={{ width: gutter - space.sm }} />
        <Chip label="All" selected={scope === 'all'} onPress={() => setScope('all')} />
        <Chip label="Favorites" icon="heartOutline" selected={scope === 'favorites'} onPress={() => setScope('favorites')} />
        {folders.map((f) => (
          <Chip key={f.id} label={f.name} icon="folder" selected={scope === f.id} onPress={() => setScope(f.id)} />
        ))}
        <Chip label="Folders" icon="edit" onPress={() => setFolderSheet({ mode: 'manage' })} />
        <View style={{ width: gutter - space.sm }} />
      </ScrollView>
      <View style={styles.scopeRow}>
        <Text variant="title3">{scopeTitle}</Text>
        <Text variant="subhead" tone="secondary">
          {results.length} {results.length === 1 ? 'recipe' : 'recipes'}
        </Text>
      </View>
    </View>
  );

  const empty =
    recipes.length === 0 ? (
      <EmptyState
        icon="book"
        title="Your recipe box is empty"
        message="Save recipes from websites, paste them from anywhere, or write down family favorites."
        action={<Button title="Add a recipe" icon="add" onPress={() => setAddOpen(true)} />}
      />
    ) : (
      <EmptyState icon="search" title="No matches" message="Try a different word, or search for an ingredient." />
    );

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <FlatList
        key={columns}
        data={results}
        keyExtractor={(r: Recipe) => r.id}
        numColumns={columns}
        renderItem={({ item }) => <RecipeCard recipe={item} width={cardWidth} />}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        columnWrapperStyle={columns > 1 ? { gap, marginBottom: space.xl } : undefined}
        contentContainerStyle={{
          paddingTop: insets.top + space.sm,
          paddingHorizontal: gutter,
          paddingBottom: insets.bottom + 110,
          width: contentWidth,
          alignSelf: 'center',
        }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      />

      <Sheet visible={addOpen} onClose={() => setAddOpen(false)} title="Add a recipe">
        <ListSection>
          <ListRow
            icon="globe"
            title="From a website"
            subtitle="Paste a link and Gather pulls out the recipe"
            onPress={() => {
              setAddOpen(false);
              router.push({ pathname: '/import', params: { mode: 'url' } });
            }}
          />
          <ListRow
            icon="text"
            iconColor="#5E8BD6"
            title="Paste text"
            subtitle="From a note, an email or a message"
            onPress={() => {
              setAddOpen(false);
              router.push({ pathname: '/import', params: { mode: 'text' } });
            }}
          />
          <ListRow
            icon="edit"
            iconColor="#8A9A5B"
            title="Write it yourself"
            subtitle="Start from a blank recipe"
            onPress={() => {
              setAddOpen(false);
              router.push('/recipe/new');
            }}
          />
        </ListSection>
      </Sheet>

      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)} title="Sort by">
        <ListSection>
          {LIBRARY_SORTS.map((option) => (
            <ListRow
              key={option.value}
              title={option.label}
              accessory={sort === option.value ? 'check' : 'none'}
              onPress={() => {
                setSort(option.value);
                setSortOpen(false);
              }}
            />
          ))}
        </ListSection>
      </Sheet>

      <FoldersSheet
        state={folderSheet}
        onClose={() => setFolderSheet(null)}
        onNew={() => setFolderSheet({ mode: 'new' })}
        onCreated={(id) => {
          setFolderSheet(null);
          setScope(id);
        }}
        onDeleted={(id) => {
          if (scope === id) setScope('all');
        }}
      />
    </View>
  );
}

function FoldersSheet({
  state,
  onClose,
  onNew,
  onCreated,
  onDeleted,
}: {
  state: { mode: 'new' } | { mode: 'manage' } | null;
  onClose: () => void;
  onNew: () => void;
  onCreated: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const db = useDb();
  const folders = useFolders();
  const recipes = useRecipes();
  const { space } = useTheme();
  const [name, setName] = useState('');
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of recipes) for (const f of r.folderIds) map.set(f, (map.get(f) ?? 0) + 1);
    return map;
  }, [recipes]);

  if (state?.mode === 'new') {
    const create = () => {
      const folder = db.folders.create(name);
      setName('');
      onCreated(folder.id);
    };
    return (
      <Sheet visible onClose={onClose} title="New folder">
        <View style={{ gap: space.lg }}>
          <Field value={name} onChangeText={setName} placeholder="Folder name" autoFocus onSubmitEditing={create} returnKeyType="done" />
          <Button title="Create folder" onPress={create} disabled={!name.trim()} full />
        </View>
      </Sheet>
    );
  }

  return (
    <Sheet visible={state?.mode === 'manage'} onClose={onClose} title="Folders">
      <ListSection footer="A recipe can live in as many folders as you like. Deleting a folder keeps its recipes.">
        {folders.map((f) => (
          <ListRow
            key={f.id}
            icon="folderFilled"
            title={f.name}
            value={String(counts.get(f.id) ?? 0)}
            accessory="none"
            right={
              <Tap
                onPress={() => {
                  db.folders.delete(f.id);
                  onDeleted(f.id);
                }}
                accessibilityLabel={`Delete ${f.name}`}
                hitSlop={8}
              >
                <Icon name="trash" size={20} tone="danger" />
              </Tap>
            }
          />
        ))}
        <ListRow icon="add" title="New folder" onPress={onNew} />
      </ListSection>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  banner: { flexDirection: 'row', alignItems: 'center' },
  scopeRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 },
});
