import { fetchDirect, normalizeUrl, PageFetchError, type FetchedPage } from './fetch-page';

const PROXY = process.env.EXPO_PUBLIC_IMPORT_PROXY;

/**
 * Browsers only let a page read other sites that opt in (CORS), which most
 * recipe sites do not. With EXPO_PUBLIC_IMPORT_PROXY set, requests go through
 * that proxy; otherwise a direct fetch is attempted and a blocked read is
 * reported so the user can paste the text instead.
 */
export async function fetchRecipePage(input: string): Promise<FetchedPage> {
  const url = normalizeUrl(input);
  if (PROXY) {
    const page = await fetchDirect(`${PROXY}${PROXY.includes('?') ? '&' : '?'}url=${encodeURIComponent(url)}`, { headers: {} });
    return { html: page.html, url };
  }
  try {
    return await fetchDirect(url, { headers: {}, mode: 'cors' });
  } catch (error) {
    if (error instanceof PageFetchError && error.reason === 'network') {
      throw new PageFetchError(
        'Your browser blocked reading that site. Copy the recipe text and use Paste text, or set EXPO_PUBLIC_IMPORT_PROXY.',
        'blocked',
      );
    }
    throw error;
  }
}
