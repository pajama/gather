import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';

import { hostLabel } from '@/core/import/html';
import { useDb, useFeeds } from '@/data/react';
import { PageFetchError } from '@/data/services/fetch-page';
import { followFeed, refreshAllFeeds } from '@/data/services/feeds';
import {
  Button,
  Card,
  Chip,
  CONTENT_MAX_WIDTH,
  EmptyState,
  Field,
  Icon,
  IconButton,
  LargeHeader,
  ListRow,
  ListSection,
  Photo,
  Screen,
  Sheet,
  Tap,
  Text,
  useTheme,
} from '@/ui';

/** A few well-known food blogs to get started; any RSS/Atom feed or blog address works. */
const SUGGESTIONS = [
  { title: 'Smitten Kitchen', url: 'https://smittenkitchen.com/feed/' },
  { title: 'Budget Bytes', url: 'https://www.budgetbytes.com/feed/' },
  { title: 'Cookie and Kate', url: 'https://cookieandkate.com/feed/' },
  { title: 'Minimalist Baker', url: 'https://minimalistbaker.com/feed/' },
];

function ago(iso: string | undefined): string {
  if (!iso) return '';
  const time = Date.parse(iso);
  if (!time) return '';
  const days = Math.floor((Date.now() - time) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function DiscoverScreen() {
  const db = useDb();
  const feeds = useFeeds();
  const { colors, space, radius } = useTheme();
  const { width } = useWindowDimensions();
  const [scope, setScope] = useState<string | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const items = useMemo(() => db.feeds.items().filter((i) => !scope || i.feedId === scope), [db, feeds, scope]); // eslint-disable-line react-hooks/exhaustive-deps
  const columns = Math.min(width, CONTENT_MAX_WIDTH) >= 620 ? 2 : 1;

  const refresh = async () => {
    setRefreshing(true);
    await refreshAllFeeds(db);
    setRefreshing(false);
  };

  return (
    <View style={styles.fill}>
      <Screen
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.accent} />}
        header={
          <LargeHeader
            title="Discover"
            subtitle={feeds.length ? `New from ${feeds.length} ${feeds.length === 1 ? 'feed' : 'feeds'}` : undefined}
            right={
              <>
                {feeds.length ? <IconButton icon="refresh" variant="tinted" onPress={() => void refresh()} accessibilityLabel="Refresh feeds" /> : null}
                <IconButton icon="add" variant="tinted" onPress={() => setManageOpen(true)} accessibilityLabel="Manage feeds" />
              </>
            }
          />
        }
      >
        {feeds.length === 0 ? (
          <View style={{ gap: space.lg }}>
            <EmptyState
              icon="globe"
              title="Follow your favorite food blogs"
              message="New recipes from the sites you love show up here, ready to save in a tap."
              action={<Button title="Add a feed" icon="add" onPress={() => setManageOpen(true)} />}
            />
          </View>
        ) : (
          <>
            <View style={[styles.chips, { gap: space.sm, marginBottom: space.lg }]}>
              <Chip label="All" selected={!scope} onPress={() => setScope(undefined)} />
              {feeds.map((f) => (
                <Chip key={f.id} label={f.title} selected={scope === f.id} onPress={() => setScope(f.id)} />
              ))}
            </View>
            {items.length === 0 ? <EmptyState icon="refresh" title="Nothing new yet" message="Pull down to refresh your feeds." /> : null}
            <View style={[styles.grid, { gap: space.lg }]}>
              {items.map((item) => (
                <Card
                  key={`${item.feedId}:${item.id}`}
                  padded={false}
                  style={{ width: columns === 2 ? '48.5%' : '100%' }}
                  onPress={() => router.push({ pathname: '/import', params: { url: item.link } })}
                >
                  {item.imageUrl ? <Photo uri={item.imageUrl} style={{ aspectRatio: 16 / 10, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }} /> : null}
                  <View style={{ padding: space.lg, gap: space.xs }}>
                    <Text variant="caption" tone="accent" weight="700">
                      {item.feedTitle.toUpperCase()}
                      {ago(item.published) ? <Text variant="caption" tone="tertiary">{`  ·  ${ago(item.published)}`}</Text> : null}
                    </Text>
                    <Text variant="headline" numberOfLines={2}>
                      {item.title}
                    </Text>
                    {item.summary ? (
                      <Text variant="footnote" tone="secondary" numberOfLines={2}>
                        {item.summary}
                      </Text>
                    ) : null}
                    <View style={[styles.itemActions, { gap: space.md, marginTop: space.sm }]}>
                      <Text variant="subhead" tone="accent" weight="600">
                        Save recipe
                      </Text>
                      <Tap onPress={() => void WebBrowser.openBrowserAsync(item.link)} hitSlop={8}>
                        <Text variant="subhead" tone="secondary">
                          Read on {hostLabel(item.link) ?? 'site'}
                        </Text>
                      </Tap>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          </>
        )}
      </Screen>
      <ManageFeedsSheet visible={manageOpen} onClose={() => setManageOpen(false)} />
    </View>
  );
}

function ManageFeedsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const db = useDb();
  const feeds = useFeeds();
  const { colors, space } = useTheme();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const follow = async (target: string) => {
    if (!target.trim()) return;
    setBusy(target);
    setError(null);
    try {
      await followFeed(db, target);
      setUrl('');
    } catch (e) {
      setError(e instanceof PageFetchError ? e.message : 'Couldn’t follow that feed.');
    } finally {
      setBusy(null);
    }
  };

  const followed = new Set(feeds.map((f) => f.url));
  return (
    <Sheet visible={visible} onClose={onClose} title="Feeds">
      <View style={{ gap: space.md, marginBottom: space.xl }}>
        <View style={[styles.addRow, { gap: space.sm }]}>
          <Field
            value={url}
            onChangeText={setUrl}
            placeholder="Blog or feed address"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onSubmitEditing={() => void follow(url)}
            style={styles.flex}
          />
          <Button title="Follow" onPress={() => void follow(url)} loading={busy === url && !!url} disabled={!url.trim()} />
        </View>
        {error ? (
          <Text variant="footnote" tone="danger">
            {error}
          </Text>
        ) : (
          <Text variant="footnote" tone="secondary">
            Paste a blog’s address; Gather finds its feed.
          </Text>
        )}
      </View>
      {feeds.length ? (
        <ListSection title="Following">
          {feeds.map((feed) => (
            <ListRow
              key={feed.id}
              icon="globe"
              title={feed.title}
              subtitle={feed.error ?? `${feed.items.length} posts · ${hostLabel(feed.siteUrl ?? feed.url) ?? ''}`}
              accessory="none"
              right={
                <Tap onPress={() => db.feeds.remove(feed.id)} accessibilityLabel={`Unfollow ${feed.title}`} hitSlop={8}>
                  <Icon name="trash" size={20} tone="danger" />
                </Tap>
              }
            />
          ))}
        </ListSection>
      ) : null}
      <ListSection title="Suggestions">
        {SUGGESTIONS.filter((s) => !followed.has(s.url)).map((s) => (
          <ListRow
            key={s.url}
            icon="bookmark"
            iconColor={colors.success}
            title={s.title}
            subtitle={hostLabel(s.url)}
            accessory="none"
            right={<Button title={busy === s.url ? 'Adding…' : 'Follow'} size="sm" variant="tinted" onPress={() => void follow(s.url)} disabled={!!busy} />}
          />
        ))}
      </ListSection>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  itemActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addRow: { flexDirection: 'row', alignItems: 'flex-end' },
});
