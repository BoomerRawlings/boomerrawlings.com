import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../dist/0311/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/styles/roomie-branding.css', import.meta.url), 'utf8');
const source = await readFile(new URL('../src/pages/0311/index.astro', import.meta.url), 'utf8');
const meta = (name) => [...html.matchAll(/<meta\s+[^>]*>/g)]
  .find(([tag]) => tag.includes('="' + name + '"'))?.[0].match(/content="([^"]*)"/)?.[1];

test('0311 has dedicated large-image sharing metadata without indexing the page', () => {
  assert.equal(meta('og:title'), "Boomer's Better Booking");
  assert.equal(meta('twitter:title'), meta('og:title'));
  assert.equal(meta('og:url'), 'https://boomerrawlings.com/0311/');
  assert.equal(meta('og:image'), 'https://boomerrawlings.com/0311/social-preview-v1.png');
  assert.equal(meta('twitter:image'), meta('og:image'));
  assert.equal(meta('twitter:card'), 'summary_large_image');
  assert.equal(meta('og:image:type'), 'image/png');
  assert.equal(meta('og:image:width'), '1200');
  assert.equal(meta('og:image:height'), '630');
  assert.ok(meta('og:image:alt')?.includes('cream and gold on navy'));
  assert.equal(meta('robots'), 'noindex,nofollow,noarchive,noimageindex');
  assert.equal(meta('referrer'), 'no-referrer');
});

test('sharing image is a checked-in opaque 1200 by 630 PNG', async () => {
  const png = await readFile(new URL('../public/0311/social-preview-v1.png', import.meta.url));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  assert.equal(png[25], 2, 'Opaque RGB PNG, with no alpha channel');
  assert.ok(png.length < 300_000, 'Preview stays lightweight');
  const built = await readFile(new URL('../dist/0311/social-preview-v1.png', import.meta.url));
  assert.deepEqual(built, png);
});

test('branding stays scoped, preserves native booking controls and supports reduced motion', () => {
  assert.match(source, /import '..\/..\/styles\/roomie-branding.css'/);
  assert.match(source, /<script>import '..\/..\/scripts\/roomie-booking';<\/script>/);
  assert.match(source, /data-roomie-filter/);
  assert.match(source, /data-expand-roomies/);
  assert.match(source, /data-course-options/);
  assert.match(source, /class="tss-book" type="button" data-tss-book data-book-route=\{course.bookingUrl\}/);
  assert.match(css, /body\.roomie-shell/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /animation: none !important/);
  assert.doesNotMatch(css, /\.tss-book(?:[\s:.#{]|-inner)/);
  for (const color of ['#0f1d30', '#ffcd00', '#f7f2e6']) assert.ok(css.includes(color));
});
