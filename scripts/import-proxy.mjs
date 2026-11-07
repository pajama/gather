#!/usr/bin/env node
/**
 * Tiny CORS proxy for importing recipes in the web build during development.
 *
 *   node scripts/import-proxy.mjs            # listens on :8787
 *   EXPO_PUBLIC_IMPORT_PROXY=http://localhost:8787 npm run web
 *
 * Only GET /?url=https://... is served, only http(s) targets are fetched,
 * and only HTML is returned.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8787);
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  const target = new URL(req.url ?? '/', 'http://localhost').searchParams.get('url');
  if (req.method !== 'GET' || !target || !/^https?:\/\//i.test(target)) {
    return res.writeHead(400, { 'Content-Type': 'text/plain' }).end('Expected GET /?url=https://...');
  }
  try {
    const upstream = await fetch(target, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.8' }, redirect: 'follow' });
    const type = upstream.headers.get('content-type') ?? '';
    if (!type.includes('html') && !type.includes('xml')) {
      return res.writeHead(415, { 'Content-Type': 'text/plain' }).end(`Not an HTML page (${type || 'unknown type'})`);
    }
    res.writeHead(upstream.status, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(await upstream.text());
  } catch (error) {
    res.writeHead(502, { 'Content-Type': 'text/plain' }).end(`Fetch failed: ${error instanceof Error ? error.message : error}`);
  }
}).listen(PORT, () => console.log(`Gather import proxy on http://localhost:${PORT}`));
