import { fetchDirect, normalizeUrl, PageFetchError, type FetchedPage } from './fetch-page';

const CONFIGURED_PROXY = process.env.EXPO_PUBLIC_IMPORT_PROXY;
/** `npm run proxy` listens here; used automatically when Gather itself runs on localhost. */
const LOCAL_PROXY = 'http://localhost:8787/';

function viaProxy(proxy: string, url: string): string {
  return `${proxy}${proxy.includes('?') ? '&' : '?'}url=${encodeURIComponent(url)}`;
}

function onLocalhost(): boolean {
  const host = typeof window === 'undefined' ? '' : window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

/**
 * Browsers only let a page read other sites that opt in (CORS), which most
 * recipe sites do not. Requests go through EXPO_PUBLIC_IMPORT_PROXY when it
 * is set, or through the development proxy (`npm run proxy`) when Gather runs
 * on localhost and that proxy answers. Otherwise a direct fetch is attempted
 * and a blocked read is reported so the user can paste the text instead.
 */
export async function fetchPage(input: string): Promise<FetchedPage> {
  const url = normalizeUrl(input);
  if (CONFIGURED_PROXY) {
    const page = await fetchDirect(viaProxy(CONFIGURED_PROXY, url), { headers: {} });
    return { html: page.html, url };
  }
  if (onLocalhost()) {
    try {
      const page = await fetchDirect(viaProxy(LOCAL_PROXY, url), { headers: {} });
      return { html: page.html, url };
    } catch (error) {
      // An HTTP error came from the site through the proxy: report it. A network error means no proxy is running.
      if (error instanceof PageFetchError && error.reason === 'http') throw error;
    }
  }
  try {
    return await fetchDirect(url, { headers: {}, mode: 'cors' });
  } catch (error) {
    if (error instanceof PageFetchError && error.reason === 'network') {
      throw new PageFetchError(
        onLocalhost()
          ? 'Your browser blocked reading that site. Start the import helper with “npm run proxy” and try again, or copy the recipe text and use Paste text.'
          : 'Your browser blocked reading that site. Copy the recipe text and use Paste text, or open Gather on your phone to import it.',
        'blocked',
      );
    }
    throw error;
  }
}
