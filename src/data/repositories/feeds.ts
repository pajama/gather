import type { FeedItem, ParsedFeed } from '@/core/import/feed';
import { newId, now } from '@/core/model/recipe';
import type { Feed, ID } from '@/core/model/types';

import type { Collections } from '../database';

const MAX_ITEMS = 30;

export interface DiscoverItem extends FeedItem {
  feedId: ID;
  feedTitle: string;
}

export class FeedsRepository {
  constructor(private readonly c: Collections) {}

  list(): Feed[] {
    return [...this.c.feeds.all()].sort((a, b) => a.title.localeCompare(b.title));
  }

  get(id: ID): Feed | undefined {
    return this.c.feeds.get(id);
  }

  findByUrl(url: string): Feed | undefined {
    return this.c.feeds.all().find((f) => f.url === url);
  }

  /** Saves a freshly parsed feed, creating it or replacing its cached items. */
  store(url: string, parsed: ParsedFeed): Feed {
    const existing = this.findByUrl(url);
    const stamp = now();
    const feed: Feed = {
      id: existing?.id ?? newId(),
      createdAt: existing?.createdAt ?? stamp,
      updatedAt: stamp,
      url,
      title: parsed.title || existing?.title || url,
      ...(parsed.siteUrl ? { siteUrl: parsed.siteUrl } : {}),
      items: parsed.items.slice(0, MAX_ITEMS),
      lastFetchedAt: stamp,
    };
    this.c.feeds.upsert(feed);
    return feed;
  }

  markError(id: ID, error: string): void {
    this.c.feeds.update(id, (f) => ({ ...f, error, updatedAt: now() }));
  }

  remove(id: ID): void {
    this.c.feeds.remove(id);
  }

  /** Latest posts across all feeds, newest first. */
  items(): DiscoverItem[] {
    const all = this.c.feeds
      .all()
      .flatMap((feed) => feed.items.map((item) => ({ ...item, feedId: feed.id, feedTitle: feed.title })));
    const time = (item: FeedItem) => (item.published ? Date.parse(item.published) || 0 : 0);
    return all.sort((a, b) => time(b) - time(a));
  }
}
