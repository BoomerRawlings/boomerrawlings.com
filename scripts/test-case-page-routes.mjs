import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createPageRouteManifest, writePageRouteManifest } from './case-page-routes.mjs';
import { pageRouteKey, resolvePageCase, recoverPageCase } from '../public/scripts/case-page-route.js';

const manifest = createPageRouteManifest([
  '/', '/ACF/', '/ead/', '/BoomerKarma/Kemberton/', '/work/scads-2026/horizon/',
  '/documents/scads-2026/workflow.html', '/archive/',
], { '/archive': '/all/' });

test('mixed-case pages, directory forms, encoded letters and nested pages resolve to canonical spelling', async () => {
  for (const [pathname, canonical] of [
    ['/acf', '/ACF/'], ['/AcF/', '/ACF/'], ['/ACF', '/ACF/'], ['/acf/INDEX.HTML', '/ACF/'],
    ['/EAD', '/ead/'], ['/EaD/', '/ead/'], ['/%65%41D', '/ead/'],
    ['/BOOMERKARMA/kEmBeRtOn', '/BoomerKarma/Kemberton/'],
    ['/WORK/Scads-2026/HORIZON/', '/work/scads-2026/horizon/'],
    ['/DOCUMENTS/SCADS-2026/WORKFLOW.HTML', '/documents/scads-2026/workflow.html'],
    ['/INDEX.HTML', '/'], ['/ArChIvE', '/all/'],
  ]) {
    assert.equal(await resolvePageCase({ pathname, search: '?q=A%2FB&x=Mixed+Case', hash: '#compare=planet%2Cculture' }, manifest),
      canonical + '?q=A%2FB&x=Mixed+Case#compare=planet%2Cculture', pathname);
  }
});

test('canonical pages do not loop; unknown routes, assets and fragments do not redirect', async () => {
  for (const pathname of ['/', '/ACF/', '/ead/', '/BoomerKarma/Kemberton/', '/missing/',
    '/ACF/app.js', '/EAD/workspace.html', '/IMAGES/Portrait.JPG', '/ACF/missing/', '/404.html', '/404/']) {
    assert.equal(await resolvePageCase({ pathname, search: '?a=1', hash: '#x' }, manifest), null, pathname);
  }
});

test('rejects unsafe paths, malformed encoding and case collisions', async () => {
  for (const pathname of ['https://example.com/ACF/', '//example.com/ACF/', '/ACF\\', '/ACF//',
    '/ACF/../ead', '/%2fACF', '/%5cead', '/%00ead', '/%zz', '/ead?query', '/ead#hash', '/e ad']) {
    assert.equal(pageRouteKey(pathname), null, pathname);
    assert.equal(await resolvePageCase({ pathname }, manifest), null);
  }
  assert.throws(() => createPageRouteManifest(['/ACF/', '/acf/']), /collision/);
  assert.throws(() => createPageRouteManifest(['/ead/'], { '/ead': '//example.com/' }), /same-origin/);
  assert.throws(() => createPageRouteManifest(['/ead/'], { '/ead': 'https://example.com/' }), /same-origin/);
  assert.equal(await resolvePageCase({ pathname: '/EAD' }, { version: 2, routes: {} }), null);
  const altered = structuredClone(manifest);
  for (const value of Object.values(altered.routes)) value.target = '//example.com/';
  assert.equal(await resolvePageCase({ pathname: '/EAD' }, altered), null);
});

test('lookup contains no plaintext directory of unlisted pages', () => {
  const json = JSON.stringify(manifest);
  assert.ok(!/ead|ACF|BoomerKarma|Kemberton|horizon|workflow/i.test(json));
  assert.ok(Object.keys(manifest.routes).every(key => /^[a-f0-9]{64}$/.test(key)));
});

test('build scans generated and static full pages; excludes assets, fragments and404', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'page-case-test-'));
  try {
    for (const [path, html] of [
      ['index.html', '<!doctype html><html><head></head><body>Home</body></html>'],
      ['ACF/index.html', '<!doctype html><html><body>Atlas</body></html>'],
      ['ead/index.html', '<!doctype html><html><body>Unlisted</body></html>'],
      ['work/dynamic-slug/index.html', '<!doctype html><html><body>Generated</body></html>'],
      ['archive/index.html', '<!doctype html><title>Redirect</title><meta http-equiv="refresh" content="0;url=/all/">'],
      ['documents/example.html', '<!doctype html>\n<!-- license --><html><body>Static</body></html>'],
      ['ead/workspace.html', '<meta name="robots" content="noindex"><div>Fragment</div>'],
      ['verification.html', 'google-site-verification: token'],
      ['404.html', '<!doctype html><html><body>Not found</body></html>'],
    ]) {
      const file = join(directory, path);
      await mkdir(join(file, '..'), { recursive: true });
      await writeFile(file, html);
    }
    assert.equal(await writePageRouteManifest(directory, { '/archive': '/all/' }), 6);
    const built = JSON.parse(await readFile(join(directory, 'page-case-routes.json'), 'utf8'));
    assert.equal(await resolvePageCase({ pathname: '/WoRk/DYNAMIC-SLUG' }, built), '/work/dynamic-slug/');
    assert.equal(await resolvePageCase({ pathname: '/Documents/EXAMPLE.HTML' }, built), '/documents/example.html');
    assert.equal(await resolvePageCase({ pathname: '/EAD/WORKSPACE.HTML' }, built), null);
    assert.equal(await resolvePageCase({ pathname: '/VERIFICATION.HTML' }, built), null);
    assert.equal(await resolvePageCase({ pathname: '/404.HTML' }, built), null);
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'page-case-test-'));
    await rm(directory, { recursive: true, force: true });
  }
});

test('404 controller replaces only matched address and preserves a manual fallback', async () => {
  const status = { textContent: '' };
  const match = { hidden: true, href: '' };
  const document = { getElementById: id => id === 'route-status' ? status : match };
  const navigations = [];
  const location = { pathname: '/aCf', search: '?mode=compare', hash: '#compare=minds%2Cpower', replace: target => navigations.push(target) };
  const requests = [];
  assert.equal(await recoverPageCase({ document, location, fetch: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => manifest };
  } }), true);
  assert.deepEqual(navigations, ['/ACF/?mode=compare#compare=minds%2Cpower']);
  assert.equal(match.href, navigations[0]);
  assert.equal(match.hidden, false);
  assert.deepEqual(requests, [{ url: '/page-case-routes.json', options: { credentials: 'same-origin', cache: 'no-cache' } }]);
  for (const fetch of [async () => { throw new Error('offline'); }, async () => ({ ok: false }), async () => ({ ok: true, json: async () => manifest })]) {
    assert.equal(await recoverPageCase({ document, location: { ...location, pathname: '/missing' }, fetch }), false);
    assert.equal(status.textContent, 'This address does not match a page on this site.');
  }
  assert.equal(navigations.length, 1);
});

test('actual build includes route lookup and a safe GitHub Pages404 document', async () => {
  const built = JSON.parse(await readFile('dist/page-case-routes.json', 'utf8'));
  assert.equal(await resolvePageCase({ pathname: '/aCf', hash: '#compare=minds%2Cpower' }, built), '/ACF/#compare=minds%2Cpower');
  assert.equal(await resolvePageCase({ pathname: '/EaD' }, built), '/ead/');
  assert.equal(await resolvePageCase({ pathname: '/WORK/SCADS-2026/' }, built), '/work/scads-2026/');
  assert.equal(await resolvePageCase({ pathname: '/boomerkarma/kemberton/' }, built), '/BoomerKarma/Kemberton/');
  assert.equal(await resolvePageCase({ pathname: '/DOCUMENTS/SCADS-2026/WORKFLOW.HTML' }, built), '/documents/scads-2026/workflow.html');
  assert.equal(await resolvePageCase({ pathname: '/EaD/workspace.html' }, built), null);
  const html = await readFile('dist/404.html', 'utf8');
  assert.match(html, /noindex,nofollow,noarchive/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /src="\/scripts\/case-page-route.js"/);
  assert.match(html, /<noscript>/);
  assert.doesNotMatch(html, /http-equiv="refresh"/);
});
