import { fetchDirect, normalizeUrl, type FetchedPage } from './fetch-page';

/** Devices have no cross-origin restrictions: fetch the page directly. */
export async function fetchRecipePage(input: string): Promise<FetchedPage> {
  return fetchDirect(normalizeUrl(input));
}
