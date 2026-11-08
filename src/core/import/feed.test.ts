import { describe, expect, it } from 'vitest';

import { discoverFeedUrls, looksLikeFeed, parseFeed } from './feed';

const RSS = `<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>Example Kitchen &amp; Co</title>
  <link>https://kitchen.example.com</link>
  <item>
    <title><![CDATA[Crispy Smashed Potatoes]]></title>
    <link>https://kitchen.example.com/smashed-potatoes/</link>
    <guid isPermaLink="false">post-123</guid>
    <pubDate>Fri, 06 Nov 2026 14:00:00 +0000</pubDate>
    <description><![CDATA[<p>The crunchiest potatoes you will ever make.</p>]]></description>
    <media:content url="https://cdn.example.com/potatoes.jpg" medium="image" />
  </item>
  <item>
    <title>Lemon Bars</title>
    <link>https://kitchen.example.com/lemon-bars/</link>
    <content:encoded><![CDATA[<img src="https://cdn.example.com/lemon.jpg"><p>Tart and sweet.</p>]]></content:encoded>
  </item>
</channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Eats</title>
  <link rel="alternate" href="https://atom.example.org/"/>
  <entry>
    <title>Miso Soup</title>
    <id>tag:atom.example.org,2026:1</id>
    <link rel="alternate" href="/miso-soup"/>
    <updated>2026-11-05T10:00:00Z</updated>
    <summary>Warming and quick.</summary>
  </entry>
</feed>`;

describe('feeds', () => {
  it('parses RSS with media and CDATA', () => {
    const feed = parseFeed(RSS, 'https://kitchen.example.com/feed/');
    expect(feed.title).toBe('Example Kitchen & Co');
    expect(feed.siteUrl).toBe('https://kitchen.example.com/');
    expect(feed.items).toHaveLength(2);
    expect(feed.items[0]).toMatchObject({
      id: 'post-123',
      title: 'Crispy Smashed Potatoes',
      link: 'https://kitchen.example.com/smashed-potatoes/',
      imageUrl: 'https://cdn.example.com/potatoes.jpg',
      summary: 'The crunchiest potatoes you will ever make.',
    });
    expect(feed.items[1]!.imageUrl).toBe('https://cdn.example.com/lemon.jpg');
  });

  it('parses Atom with relative links', () => {
    const feed = parseFeed(ATOM, 'https://atom.example.org/feed.xml');
    expect(feed.title).toBe('Atom Eats');
    expect(feed.items[0]).toMatchObject({
      title: 'Miso Soup',
      link: 'https://atom.example.org/miso-soup',
      published: '2026-11-05T10:00:00Z',
    });
  });

  it('discovers feeds advertised by a page', () => {
    const html = `<head>
      <link rel="alternate" type="application/rss+xml" title="Comments" href="/comments/feed/">
      <link rel="alternate" type="application/rss+xml" title="Posts" href="https://kitchen.example.com/feed/">
    </head>`;
    expect(discoverFeedUrls(html, 'https://kitchen.example.com/')).toEqual([
      'https://kitchen.example.com/feed/',
      'https://kitchen.example.com/comments/feed/',
    ]);
    expect(looksLikeFeed(RSS)).toBe(true);
    expect(looksLikeFeed(html)).toBe(false);
  });
});

describe('feed safety', () => {
  it('drops items whose links are not http(s)', () => {
    const feed = parseFeed(
      `<rss><channel><title>F</title><link>javascript:alert(1)</link><item><title>Bad</title><link>javascript:alert(1)</link></item><item><title>Good</title><link>https://example.com/r</link></item></channel></rss>`,
      'https://example.com/feed',
    );
    expect(feed.items.map((i) => i.title)).toEqual(['Good']);
    expect(feed.siteUrl).toBeUndefined();
  });
});
