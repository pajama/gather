/**
 * Downloads a web page for recipe import. Devices fetch directly; browsers
 * block cross-site reads, so the web build goes through an import proxy
 * when one is configured (see scripts/import-proxy.mjs).
 */

export class PageFetchError extends Error {
  constructor(
    message: string,
    readonly reason: 'blocked' | 'http' | 'network' | 'invalid-url',
  ) {
    super(message);
  }
}

export interface FetchedPage {
  html: string;
  url: string;
}

const BROWSER_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
};

export function normalizeUrl(input: string): string {
  const text = input.trim();
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    throw new PageFetchError('That doesn’t look like a web address.', 'invalid-url');
  }
}

export async function fetchDirect(url: string, init: RequestInit = {}): Promise<FetchedPage> {
  let response: Response;
  try {
    response = await fetch(url, { headers: BROWSER_HEADERS, ...init });
  } catch {
    throw new PageFetchError('Couldn’t reach that site. Check the link and your connection.', 'network');
  }
  if (!response.ok) throw new PageFetchError(`The site answered with an error (${response.status}).`, 'http');
  return { html: await response.text(), url: response.url || url };
}
