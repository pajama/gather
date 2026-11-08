import { router, usePathname } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { inFolder } from '@/core/model/library';
import { useFolders, useRecipes } from '@/data/react';
import { useTagColor } from '@/features/library';
import { Icon, IconButton, SIDEBAR_WIDTH, Tap, Text, useTheme, type IconName } from '@/ui';

const LIBRARY: {
  route: string;
  href: '/plan' | '/' | '/groceries' | '/discover';
  label: string;
  icon: IconName;
  color: string;
}[] = [
  { route: 'plan', href: '/plan', label: 'Meal Plan', icon: 'calendar', color: '#FF3B30' },
  { route: '(recipes)', href: '/', label: 'Recipes', icon: 'recipes', color: '#34C759' },
  { route: 'groceries', href: '/groceries', label: 'Groceries', icon: 'basket', color: '#F5A623' },
  { route: 'discover', href: '/discover', label: 'Discover', icon: 'sparkles', color: '#A050E0' },
];

function Row({
  icon,
  iconColor,
  iconSize = 22,
  label,
  labelColor,
  detail,
  active,
  onPress,
}: {
  icon: IconName;
  iconColor: string;
  iconSize?: number;
  label: string;
  labelColor?: string;
  detail?: string;
  active?: boolean;
  onPress: () => void;
}) {
  const { colors, radius, space } = useTheme();
  return (
    <Tap
      onPress={onPress}
      accessibilityRole="link"
      accessibilityState={{ selected: !!active }}
      style={[
        styles.row,
        {
          borderRadius: radius.md,
          paddingHorizontal: space.sm,
          gap: space.md,
          backgroundColor: active ? colors.accentSoft : 'transparent',
        },
      ]}
    >
      <View style={styles.iconBox}>
        <Icon name={icon} size={iconSize} color={iconColor} />
      </View>
      <View style={styles.flex}>
        <Text variant="callout" weight={active ? '600' : '400'} color={labelColor} numberOfLines={1}>
          {label}
        </Text>
        {detail ? (
          <Text variant="caption" tone="secondary">
            {detail}
          </Text>
        ) : null}
      </View>
    </Tap>
  );
}

function SectionHeader({ title, open, onToggle }: { title: string; open: boolean; onToggle?: () => void }) {
  const { space } = useTheme();
  return (
    <Tap
      onPress={onToggle}
      style={[styles.sectionHeader, { marginTop: space.lg, paddingHorizontal: space.sm }]}
      accessibilityRole="button"
      accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${title}`}
    >
      <Text variant="footnote" tone="secondary" weight="600" style={styles.flex}>
        {title}
      </Text>
      {onToggle ? <Icon name={open ? 'chevronDown' : 'chevron'} size={16} tone="accent" /> : null}
    </Tap>
  );
}

const count = (n: number) => `${n} ${n === 1 ? 'recipe' : 'recipes'}`;

/**
 * The wide-screen sidebar, after Crouton's iPad and Mac apps: Library
 * (Meal Plan, Recipes, Groceries, Discover), Folders and Tags.
 */
export function Sidebar({ state, insets }: BottomTabBarProps) {
  const { colors, space } = useTheme();
  const pathname = usePathname();
  const recipes = useRecipes();
  const folders = useFolders();
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);
  const activeRoute = state.routes[state.index]?.name;

  const colorFor = useTagColor();
  const folderCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of folders) map.set(f.id, recipes.filter((r) => inFolder(r, f)).length);
    return map;
  }, [recipes, folders]);
  const tags = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of recipes)
      for (const t of r.tags) if (!map.has(t.toLowerCase())) map.set(t.toLowerCase(), t);
    return [...map.values()].sort((a, b) => a.localeCompare(b));
  }, [recipes]);

  const inCollection = pathname.startsWith('/collection/');
  return (
    <View
      style={[
        styles.sidebar,
        {
          width: SIDEBAR_WIDTH,
          backgroundColor: colors.sidebar,
          borderRightColor: colors.separator,
          paddingTop: insets.top,
        },
      ]}
    >
      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: insets.bottom + space.xl }}>
        <View style={[styles.header, { marginBottom: space.sm }]}>
          <Text variant="title1" style={[styles.flex, { marginLeft: space.sm }]}>
            Gather
          </Text>
          <IconButton
            icon="settings"
            variant={activeRoute === 'settings' ? 'tinted' : 'plain'}
            onPress={() => router.navigate('/settings')}
            accessibilityLabel="Settings"
          />
        </View>

        <SectionHeader title="Library" open />
        {LIBRARY.map((item) => (
          <Row
            key={item.route}
            icon={item.icon}
            iconColor={item.color}
            label={item.label}
            active={
              activeRoute === item.route &&
              !(item.route === '(recipes)' && (inCollection || pathname === '/collections'))
            }
            onPress={() => router.navigate(item.href)}
          />
        ))}

        <SectionHeader title="Folders" open={foldersOpen} onToggle={() => setFoldersOpen(!foldersOpen)} />
        {foldersOpen ? (
          <>
            <Row
              icon="grid3"
              iconColor={colors.accent}
              label="All Folders"
              active={pathname === '/collections'}
              onPress={() => router.navigate('/collections')}
            />
            <Row
              icon="heart"
              iconColor="#FF2D55"
              label="Favorites"
              active={pathname === '/collection/favorites'}
              onPress={() => router.navigate({ pathname: '/collection/[id]', params: { id: 'favorites' } })}
            />
            {folders.map((f) => (
              <Row
                key={f.id}
                icon={f.tags?.length ? 'sparkles' : 'folderFilled'}
                iconColor={colors.accent}
                label={f.name}
                detail={count(folderCounts.get(f.id) ?? 0)}
                active={pathname === `/collection/${f.id}`}
                onPress={() => router.navigate({ pathname: '/collection/[id]', params: { id: f.id } })}
              />
            ))}
          </>
        ) : null}

        {tags.length ? (
          <SectionHeader title="Tags" open={tagsOpen} onToggle={() => setTagsOpen(!tagsOpen)} />
        ) : null}
        {tagsOpen
          ? tags.map((t) => (
              <Row
                key={t}
                icon="ellipse"
                iconSize={14}
                iconColor={colorFor(t)}
                label={t}
                labelColor={colorFor(t)}
                active={decodeURIComponent(pathname) === `/collection/tag:${t}`}
                onPress={() =>
                  router.navigate({
                    pathname: '/collection/[id]',
                    params: { id: `tag:${encodeURIComponent(t)}` },
                  })
                }
              />
            ))
          : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: { height: '100%', borderRightWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 28, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingVertical: 6 },
  flex: { flex: 1 },
  iconBox: { width: 24, alignItems: 'center' },
});
