import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hostLabel } from '@/core/import/html';
import { LIBRARY_SORTS, queryLibrary, type LibrarySort } from '@/core/model/library';
import type { Recipe } from '@/core/model/types';
import { useDb, useFolders, useRecipes } from '@/data/react';
import { RecipeDetail } from '@/features/recipe';
import { Button, EmptyState, Icon, IconButton, LargeHeader, ListRow, ListSection, SearchField, Sheet, Text, useTheme } from '@/ui';

import { RecipeCard, RecipeRow } from './RecipeCard';

/**
 * A collection of recipes: All Recipes (the tab's landing page), Favorites,
 * a folder, or a tag (`/collection/tag:Dinner`).
 */
export function LibraryScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const scopeParam = params.id ?? 'all';
  const db = useDb();
  const recipes = useRecipes();
  const folders = useFolders();
  const { colors, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [text, setText] = useState('');
  const [sort, setSort] = useState<LibrarySort>('recent');
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const dismissedUrls = useRef(new Set<string>());

  const tag = scopeParam.startsWith('tag:') ? decodeURIComponent(scopeParam.slice(4)) : undefined;
  const folder = folders.find((f) => f.id === scopeParam);
  const title = tag ?? folder?.name ?? (scopeParam === 'favorites' ? 'Favorites' : 'All Recipes');

  // Wide windows (iPad landscape, desktop browsers) show the list beside the open recipe.
  const split = width >= 1100;
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const listWidth = split ? 420 : width;
  const contentWidth = Math.min(listWidth, 1100);
  const gutter = width >= 720 ? 24 : 16;
  const columns = split ? 1 : contentWidth >= 900 ? 3 : contentWidth >= 600 ? 2 : 1;
  const gap = 16;
  const cardWidth = Math.floor((contentWidth - gutter * 2 - gap * (columns - 1)) / columns);

  const results = useMemo(
    () =>
      queryLibrary(recipes, {
        text,
        ...(tag ? { tag } : scopeParam !== 'all' ? { scope: scopeParam === 'favorites' ? 'favorites' : scopeParam } : {}),
        sort,
      }),
    [recipes, text, tag, scopeParam, sort],
  );
  const selected = split ? (results.find((r) => r.id === selectedId) ?? results[0]) : undefined;

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

  const header = (
    <View style={{ gap: space.md, marginBottom: space.lg }}>
      <LargeHeader
        title={title}
        back={{ label: 'Collections', onPress: () => (router.canGoBack() ? router.back() : router.replace('/collections')) }}
        right={
          <>
            <IconButton icon="add" variant="tinted" onPress={() => setAddOpen(true)} accessibilityLabel="Add recipe" />
            <IconButton icon="more" variant="tinted" onPress={() => setMenuOpen(true)} accessibilityLabel="Sort and options" />
          </>
        }
      />
      {clipboardUrl ? (
        <View style={[styles.banner, { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.md }]}>
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
      <SearchField value={text} onChangeText={setText} placeholder="Recipes, Ingredients" />
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
    ) : text ? (
      <EmptyState icon="search" title="No matches" message="Try a different word, or search for an ingredient." />
    ) : (
      <EmptyState icon="folder" title="Nothing here yet" message="Add recipes to this collection from a recipe’s menu." />
    );

  const list = (
    <FlatList
      key={columns}
      style={split ? { width: listWidth, flexGrow: 0, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.separator } : undefined}
      data={results}
      keyExtractor={(r: Recipe) => r.id}
      numColumns={columns}
      renderItem={({ item }) =>
        split ? (
          <View style={{ backgroundColor: item.id === selected?.id ? colors.accentSoft : 'transparent', borderRadius: radius.lg, paddingHorizontal: space.sm }}>
            <RecipeRow recipe={item} onPress={() => setSelectedId(item.id)} />
          </View>
        ) : (
          <View style={columns === 1 ? { marginBottom: gap } : null}>
            <RecipeCard recipe={item} width={cardWidth} from={title} />
          </View>
        )
      }
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      columnWrapperStyle={columns > 1 ? { gap, marginBottom: gap } : undefined}
      contentContainerStyle={{
        paddingTop: insets.top + space.xs,
        paddingHorizontal: gutter,
        paddingBottom: insets.bottom + 110,
        width: contentWidth,
        alignSelf: 'center',
      }}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    />
  );

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      {split ? (
        <View style={styles.split}>
          {list}
          <View style={styles.fill}>{selected ? <RecipeDetail key={selected.id} recipe={selected} embedded /> : null}</View>
        </View>
      ) : (
        list
      )}

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
            iconColor="#5E5CE6"
            title="Paste text"
            subtitle="From a note, an email or a message"
            onPress={() => {
              setAddOpen(false);
              router.push({ pathname: '/import', params: { mode: 'text' } });
            }}
          />
          <ListRow
            icon="download"
            iconColor="#F5A623"
            title="From a file"
            subtitle="Paprika export, Gather file or saved page"
            onPress={() => {
              setAddOpen(false);
              router.push({ pathname: '/import', params: { mode: 'file' } });
            }}
          />
          <ListRow
            icon="edit"
            iconColor="#34C759"
            title="Write it yourself"
            subtitle="Start from a blank recipe"
            onPress={() => {
              setAddOpen(false);
              router.push('/recipe/new');
            }}
          />
        </ListSection>
      </Sheet>

      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Sort by">
        <ListSection>
          {LIBRARY_SORTS.map((option) => (
            <ListRow
              key={option.value}
              title={option.label}
              accessory={sort === option.value ? 'check' : 'none'}
              onPress={() => {
                setSort(option.value);
                setMenuOpen(false);
              }}
            />
          ))}
        </ListSection>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  banner: { flexDirection: 'row', alignItems: 'center' },
  split: { flex: 1, flexDirection: 'row' },
});
