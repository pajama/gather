import { discoverFeedUrls, looksLikeFeed, parseFeed } from '@/core/import/feed';
import type { Feed } from '@/core/model/types';

import type { Database } from '../database';
import { PageFetchError } from './fetch-page';
import { fetchPage } from './page-fetcher';

/**
 * Follows a feed given either its URL or a site URL that advertises one
 * (most blogs do via <link rel="alternate">).
 */
export async function followFeed(db: Database, input: string): Promise<Feed> {
  const page = await fetchPage(input);
  if (looksLikeFeed(page.html)) return db.feeds.store(page.url, parseFeed(page.html, page.url));
  const [feedUrl] = discoverFeedUrls(page.html, page.url);
  if (!feedUrl)
    throw new PageFetchError('No recipe feed found on that site. Try the address of its RSS feed.', 'http');
  const feedPage = await fetchPage(feedUrl);
  if (!looksLikeFeed(feedPage.html)) throw new PageFetchError('That link isn’t an RSS or Atom feed.', 'http');
  return db.feeds.store(feedUrl, parseFeed(feedPage.html, feedUrl));
}

export async function refreshFeed(db: Database, feed: Feed): Promise<void> {
  try {
    const page = await fetchPage(feed.url);
    db.feeds.store(feed.url, parseFeed(page.html, feed.url));
  } catch (error) {
    db.feeds.markError(feed.id, error instanceof Error ? error.message : 'Refresh failed');
  }
}

export async function refreshAllFeeds(db: Database): Promise<void> {
  await Promise.all(db.feeds.list().map((feed) => refreshFeed(db, feed)));
}
