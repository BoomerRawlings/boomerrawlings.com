// Local integration fixture only. Never deploy or seed this synthetic data remotely.
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { deflateSync } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function png(width, height, seed) {
  const crc = bytes => { let c = 0xffffffff; for (const byte of bytes) { c ^= byte; for (let n = 0; n < 8; n++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; };
  const chunk = (name, bytes) => { const type = Buffer.from(name), length = Buffer.alloc(4), checksum = Buffer.alloc(4); length.writeUInt32BE(bytes.length); checksum.writeUInt32BE(crc(Buffer.concat([type, bytes]))); return Buffer.concat([length, type, bytes, checksum]); };
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const pixels = Buffer.alloc((width * 3 + 1) * height); for (let y = 0; y < height; y++) for (let x = 1; x <= width * 3; x++) pixels[y * (width * 3 + 1) + x] = (x * 17 + y * 31 + seed) % 256;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
const tokens = Object.fromEntries(['owner', 'collector', 'verifier', 'reader'].map(role => [role, randomBytes(32).toString('hex')]));
const mf = new Miniflare(convertV4MiniflareOptions({ host: '127.0.0.1', port: 8788, modules: ['index.js', 'validation.js', 'releases.js', 'image-header.js', 'openapi.js'].map(name => ({ type: 'ESModule', path: `${root}src/${name}` })), modulesRoot: root, compatibilityDate: '2026-10-27', compatibilityFlags: ['nodejs_compat'], d1Databases: ['DB'], r2Buckets: ['ASSETS'], bindings: { OWNER_TOKEN: tokens.owner, COLLECTOR_TOKEN: tokens.collector, VERIFIER_TOKEN: tokens.verifier, READER_TOKEN: tokens.reader, ALLOWED_ORIGINS: 'http://127.0.0.1:4321,http://localhost:4321,http://127.0.0.1:4322,http://localhost:4322,http://127.0.0.1:8788' } }));
const db = await mf.getD1Database('DB'), bucket = await mf.getR2Bucket('ASSETS');
for (const filename of (await readdir(`${root}migrations`)).filter(name => name.endsWith('.sql')).sort()) for (const sql of (await readFile(`${root}migrations/${filename}`, 'utf8')).split(';').filter(s => s.trim())) await db.prepare(sql).run();
const items = [];
for (const className of ['alpha', 'beta']) {
  const klass = { id: `proof-${className}`, name: `TEST ONLY ${className}`, aliases: [], variants: [], origin_countries: ['Synthetic fixture'], operators: ['Synthetic fixture'], service: { status: 'commissioned', as_of: '2026-10-27', evidence: ['https://example.org/synthetic-test-fixture'] }, historical_types: [], pilot: true };
  await db.prepare('INSERT INTO classes(id,name,data) VALUES(?,?,?)').bind(klass.id, klass.name, JSON.stringify(klass)).run();
  for (let n = 0; n < 100; n++) {
    const id = `${className}-${String(n).padStart(3, '0')}`, seed = n + (className === 'beta' ? 100 : 0), original = png(1600, 1000, seed), crop = png(600, 300, seed + 8), preview = png(360, 225, seed);
    const record = { id, class_id: klass.id, domain: 'camera', status: 'accepted', source: { page_url: `https://example.org/test/${id}`, original_url: `https://example.org/test/${id}.png`, author: 'Synthetic test generator', retrieved_at: '2026-10-27' }, rights: { tier: 'commercial', license: 'CC0-1.0', evidence_url: 'https://example.org/test-only', attribution: 'Synthetic integration fixture — never real submarine evidence', download_allowed: true, training_allowed: true, redistribution_allowed: true }, quality: { original_width: 1600, original_height: 1000, subject_length_px: 600, sharpness_ok: true, original_resolution: true, not_upscaled: true }, target_bbox: [100, 100, 600, 300], sha256: hash(original), pixel_sha256: hash(`synthetic-decoded-${id}`), phash: hash(id).slice(0, 16), duplicate_group: `dup-${id}`, event_group: `event-${id}`, hull: `synthetic-${className}-${n % 5}`, viewpoint: ['port', 'starboard', 'bow'][n % 3], verification: { collector: 'fixture-generator', verified_by: 'integration-test', verified_at: '2026-10-27T00:00:00Z', class_evidence: ['https://example.org/synthetic-test-fixture'], decision: 'accept' } };
    await db.prepare('INSERT INTO images(id,class_id,domain,status,rights_tier,public_delivery,sha256,pixel_sha256,phash,duplicate_group,event_group,data,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, klass.id, 'camera', 'accepted', 'commercial', 1, record.sha256, record.pixel_sha256, record.phash, record.duplicate_group, record.event_group, JSON.stringify(record), '2026-10-27').run();
    for (const [kind, bytes] of [['original', original], ['crop', crop], ['preview', preview]]) { const sha = hash(bytes), key = `fixtures/${kind}/${sha}`; await bucket.put(key, bytes, { sha256: sha, httpMetadata: { contentType: 'image/png' } }); await db.prepare('INSERT INTO assets(image_id,kind,object_key,sha256,bytes,content_type) VALUES(?,?,?,?,?,?)').bind(id, kind, key, sha, bytes.length, 'image/png').run(); }
    items.push({ image_id: id, split: n < 80 ? 'train' : n < 90 ? 'validation' : 'test' });
  }
}
const response = await mf.dispatchFetch('http://127.0.0.1:8788/subs/api/v1/releases', { method: 'POST', headers: { Authorization: `Bearer ${tokens.verifier}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'fixture-r1', domain: 'camera', rights_tier: 'commercial', items, change_history: 'Synthetic integration test only. Never publish as real photo evidence.' }) });
if (response.status !== 201) { console.error(await response.text()); await mf.dispose(); process.exit(1); }
await response.arrayBuffer(); await mkdir(`${root}.wrangler`, { recursive: true }); await writeFile(`${root}.wrangler/fixture-credentials.json`, JSON.stringify({ base_url: 'http://127.0.0.1:8788/subs/api/v1', release_id: 'fixture-r1', ...tokens }));
console.log('READY http://127.0.0.1:8788/subs/api/v1 — synthetic fixture-r1, 200 records; credentials in ignored .wrangler/fixture-credentials.json');
let stopping = false; async function stop() { if (stopping) return; stopping = true; await mf.dispose(); process.exit(0); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
await new Promise(() => {});
