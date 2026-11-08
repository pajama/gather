#!/usr/bin/env node
/**
 * Packs the web export into one self-contained HTML file: every script,
 * stylesheet, font and image inlined, nothing fetched. It runs from a file,
 * an email attachment or a sandboxed preview frame (no network, no storage:
 * Gather then keeps its data in memory for the session).
 *
 *   GATHER_SINGLE_FILE=1 EXPO_PUBLIC_SINGLE_FILE=1 npx expo export --platform web --output-dir dist-single
 *   node scripts/single-file.mjs dist-single gather.html
 */
import { Buffer } from 'node:buffer';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const DIST = process.argv[2] ?? 'dist-single';
const OUT = process.argv[3] ?? join(DIST, 'gather.html');
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ttf': 'font/ttf', '.otf': 'font/otf', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const file = join(dir, name);
    return statSync(file).isDirectory() ? walk(file) : [file];
  });
}

// "/assets/..." -> data: URL for every asset the bundle can reference.
const assets = new Map();
for (const file of walk(join(DIST, 'assets'))) {
  const type = MIME[extname(file).toLowerCase()];
  if (type) assets.set(`/${relative(DIST, file)}`, `data:${type};base64,${readFileSync(file).toString('base64')}`);
}
const inlineAssets = (text) => text.replace(/\/assets\/[^"'`)\s]+/g, (path) => assets.get(path) ?? path);

// Inline code must not end its own <script> element or open an HTML comment.
const scriptSafe = (code) => code.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

// Runs before the app: keep in-app navigation from touching the about:srcdoc URL, which cannot change.
const SHIM = `<script>(function(){try{if(location.protocol!=='about:'&&location.protocol!=='file:')return;var H=History.prototype,p=H.pushState,r=H.replaceState;H.pushState=function(s){try{return p.call(this,s,'')}catch(e){}};H.replaceState=function(s){try{return r.call(this,s,'')}catch(e){}}}catch(e){}})();</script>`;

let html = readFileSync(join(DIST, 'index.html'), 'utf8');
const scripts = [];
html = html.replace(/<script src="([^"]+)"[^>]*><\/script>/g, (_m, src) => {
  scripts.push(scriptSafe(inlineAssets(readFileSync(join(DIST, src), 'utf8'))));
  return '';
});
// Replacer functions, not strings: bundled code is full of "$&" and "$'" that String.replace would expand.
html = html.replace(/<link rel="stylesheet" href="([^"]+)"[^>]*>/g, (_m, href) => `<style>${inlineAssets(readFileSync(join(DIST, href), 'utf8'))}</style>`);
html = html.replace(/<link rel="icon" href="[^"]*"\s*\/?>/, () => '');
html = html.replace('<head>', () => `<head>\n${SHIM}`);
html = html.replace('</body>', () => `${scripts.map((code) => `<script>${code}</script>`).join('\n')}\n</body>`);

const leftovers = [...new Set(html.match(/\/assets\/[^"'`)\s]+\.(?:png|jpe?g|webp|ttf|otf)/g) ?? [])];
writeFileSync(OUT, html);
const mb = Buffer.byteLength(html) / 1048576;
console.log(`${OUT}: ${mb.toFixed(1)} MB, ${scripts.length} scripts, ${assets.size} assets inlined`);
if (leftovers.length) console.log(`not inlined: ${leftovers.slice(0, 5).join(', ')}`);
if (mb > 16) {
  console.error('Over 16 MB: too big for the artifact viewer.');
  process.exitCode = 1;
}
