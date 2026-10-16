import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageRouteKey } from '../public/scripts/case-page-route.js';

// Store casing, not page names: unlisted routes must not become a public directory.
// This is discovery hygiene, not access control; these pages are already public.
export function createPageRouteManifest(paths, redirects = {}) {
  const routes = Object.create(null);
  const seen = new Map();
  for (const path of paths) {
    const key = pageRouteKey(path);
    if (!key) throw new Error(`Invalid page route: ${path}`);
    if (seen.has(key) && seen.get(key) !== path) {
      throw new Error(`Case-insensitive page route collision: ${seen.get(key)} and ${path}`);
    }
    seen.set(key, path);
    const upper = [...key].flatMap((letter, index) => path[index] !== letter ? [index] : []);
    if ([...key].map((letter, index) => upper.includes(index) ? letter.toUpperCase() : letter).join('') !== path) {
      throw new Error(`Page route cannot be represented safely: ${path}`);
    }
    const target = redirects[path.replace(/\/$/, '')];
    if (target && (!pageRouteKey(target) || !target.startsWith('/') || target.startsWith('//'))) {
      throw new Error(`Redirect must be a same-origin page path: ${target}`);
    }
    routes[createHash('sha256').update(key).digest('hex')] = target ? { upper, target } : { upper };
  }
  return { version: 1, routes };
}

export async function writePageRouteManifest(directory, redirects = {}) {
  const pages = [];
  async function scan(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const file = join(folder, entry.name);
      if (entry.isDirectory()) await scan(file);
      else if (entry.isFile() && entry.name.endsWith('.html')) {
        const path = '/' + relative(directory, file).split(sep).join('/');
        if (path === '/404.html') continue;
        const html = await readFile(file, 'utf8');
        // Exclude verification tokens and deferred HTML fragments, include generated
        // content pages, static standalone documents, and Astro's redirect pages.
        if (!/^\s*<!doctype\s+html\s*>/i.test(html)) continue;
        pages.push(path.endsWith('/index.html') ? path.slice(0, -10) : path);
      }
    }
  }
  await scan(directory);
  const manifest = createPageRouteManifest(pages.sort(), redirects);
  await writeFile(join(directory, 'page-case-routes.json'), JSON.stringify(manifest));
  return pages.length;
}

export default function casePageRoutes(redirects) {
  return {
    name: 'case-insensitive-page-routes',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const count = await writePageRouteManifest(fileURLToPath(dir), redirects);
        logger.info(`Case-insensitive fallback prepared for ${count} page routes.`);
      },
    },
  };
}
