/**
 * RSS 2.0 and Atom parsing for recipe feeds, plus feed discovery from a
 * site's HTML. String-based (no DOMParser on React Native) and tolerant of
 * the CDATA, entities and media extensions food blogs use.
 */

import { cleanText, decodeEntities, resolveUrl } from './html';

export interface FeedItem {
  /** Stable key: guid, id or link. */
  id: string;
  title: string;
  link: string;
  published?: string;
  imageUrl?: string;
  summary?: string;
}

export interface ParsedFeed {
  title: string;
  siteUrl?: string;
  items: FeedItem[];
}

function unwrapCdata(text: string): string {
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

/** Inner text of the first <tag>…</tag> (namespaced tags allowed), CDATA unwrapped. */
function tagText(xml: string, tag: string): string | undefined {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</${escaped}>`, 'i').exec(xml);
  return m?.[1] !== undefined ? unwrapCdata(m[1]).trim() : undefined;
}

function attr(tagSource: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tagSource);
  return m?.[1] !== undefined ? decodeEntities(m[1]) : undefined;
}

function blocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi');
  const out: string[] = [];
  for (let m = re.exec(xml); m; m = re.exec(xml)) out.push(m[0]);
  return out;
}

function firstImage(item: string, base?: string): string | undefined {
  const candidates: (string | undefined)[] = [];
  for (const tag of ['media:content', 'media:thumbnail', 'enclosure']) {
    const re = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
    for (let m = re.exec(item); m; m = re.exec(item)) {
      const type = attr(m[0], 'type') ?? attr(m[0], 'medium') ?? '';
      if (tag === 'enclosure' && type && !type.startsWith('image')) continue;
      candidates.push(attr(m[0], 'url'));
    }
  }
  const html = decodeEntities(unwrapCdata(tagText(item, 'content:encoded') ?? tagText(item, 'content') ?? tagText(item, 'description') ?? ''));
  const img = /<img\b[^>]*\ssrc\s*=\s*["']([^"']+)["']/i.exec(html);
  if (img?.[1]) candidates.push(img[1]);
  const found = candidates.find((c) => c && /^(https?:)?\/\//.test(c));
  return found ? resolveUrl(found, base) : undefined;
}

export function parseFeed(xml: string, feedUrl?: string): ParsedFeed {
  const isAtom = /<feed\b[^>]*xmlns\s*=\s*["']http:\/\/www\.w3\.org\/2005\/Atom/i.test(xml) || (/<feed\b/i.test(xml) && !/<rss\b/i.test(xml));
  if (isAtom) {
    const head = xml.split(/<entry\b/i)[0] ?? '';
    const siteLink = /<link\b[^>]*rel\s*=\s*["']alternate["'][^>]*>/i.exec(head)?.[0] ?? /<link\b[^>]*>/i.exec(head)?.[0];
    return {
      title: cleanText(tagText(head, 'title') ?? '') || 'Feed',
      ...(siteLink && attr(siteLink, 'href') ? { siteUrl: resolveUrl(attr(siteLink, 'href')!, feedUrl) } : {}),
      items: blocks(xml, 'entry').map((entry) => {
        const linkTag = /<link\b[^>]*rel\s*=\s*["']alternate["'][^>]*>/i.exec(entry)?.[0] ?? /<link\b[^>]*>/i.exec(entry)?.[0] ?? '';
        const link = resolveUrl(attr(linkTag, 'href') ?? '', feedUrl);
        const summary = cleanText(decodeEntities(tagText(entry, 'summary') ?? ''));
        const published = tagText(entry, 'published') ?? tagText(entry, 'updated');
        const imageUrl = firstImage(entry, link);
        return {
          id: tagText(entry, 'id') ?? link,
          title: cleanText(decodeEntities(tagText(entry, 'title') ?? '')) || 'Untitled',
          link,
          ...(published ? { published } : {}),
          ...(imageUrl ? { imageUrl } : {}),
          ...(summary ? { summary: summary.slice(0, 280) } : {}),
        };
      }),
    };
  }
  const channel = tagText(xml, 'channel') ?? xml;
  const head = channel.split(/<item\b/i)[0] ?? '';
  const siteUrl = tagText(head, 'link');
  return {
    title: cleanText(decodeEntities(tagText(head, 'title') ?? '')) || 'Feed',
    ...(siteUrl ? { siteUrl: resolveUrl(siteUrl, feedUrl) } : {}),
    items: blocks(channel, 'item').map((item) => {
      const link = resolveUrl(decodeEntities(tagText(item, 'link') ?? ''), feedUrl);
      const summary = cleanText(decodeEntities(tagText(item, 'description') ?? ''));
      const published = tagText(item, 'pubDate') ?? tagText(item, 'dc:date');
      const imageUrl = firstImage(item, link);
      return {
        id: tagText(item, 'guid') ?? link,
        title: cleanText(decodeEntities(tagText(item, 'title') ?? '')) || 'Untitled',
        link,
        ...(published ? { published } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        ...(summary ? { summary: summary.slice(0, 280) } : {}),
      };
    }),
  };
}

export function looksLikeFeed(text: string): boolean {
  return /<(rss|feed|rdf:RDF)\b/i.test(text.slice(0, 2000));
}

/** Feed URLs a site advertises with <link rel="alternate" type="application/rss+xml">. */
export function discoverFeedUrls(html: string, pageUrl?: string): string[] {
  const urls: string[] = [];
  const re = /<link\b[^>]*>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const tag = m[0];
    const type = (attr(tag, 'type') ?? '').toLowerCase();
    const rel = (attr(tag, 'rel') ?? '').toLowerCase();
    const href = attr(tag, 'href');
    if (href && rel.includes('alternate') && /(rss|atom)\+xml/.test(type)) urls.push(resolveUrl(href, pageUrl));
  }
  // Comment feeds are rarely what anyone wants.
  return [...new Set(urls)].sort((a, b) => Number(/comments/i.test(a)) - Number(/comments/i.test(b)));
}
