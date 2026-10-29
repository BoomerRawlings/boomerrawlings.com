import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { validateRelease, hamming } from '../src/validation.js';
import { imageList } from '../src/index.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url)), BASE = 'https://boomerrawlings.com/subs/api/v1';
const tokens = Object.fromEntries(['owner', 'collector', 'verifier', 'reader'].map(role => [role, `synthetic-test-only-${role}-credential-0123456789`]));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function crc(bytes) { let c = 0xffffffff; for (const byte of bytes) { c ^= byte; for (let n = 0; n < 8; n++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; }
function png(width, height, seed = 1) {
  const chunk = (type, data) => { const name = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4); length.writeUInt32BE(data.length); checksum.writeUInt32BE(crc(Buffer.concat([name, data]))); return Buffer.concat([length, name, data, checksum]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const pixels = Buffer.alloc((width * 3 + 1) * height); for (let y = 0; y < height; y++) for (let x = 1; x <= width * 3; x++) pixels[y * (width * 3 + 1) + x] = (x * 17 + y * 31 + seed) % 256;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
let mf, db, bucket;
async function call(path, { role, method = 'GET', data, headers = {}, raw } = {}) {
  const h = { ...headers }; if (role) h.Authorization = `Bearer ${tokens[role]}`;
  if (data !== undefined) h['Content-Type'] = 'application/json';
  return mf.dispatchFetch(`${BASE}${path}`, { method, headers: h, body: raw ?? (data === undefined ? undefined : JSON.stringify(data)) });
}
async function expect(response, status) { const data = await response.json(); assert.equal(response.status, status, JSON.stringify(data)); return data; }
const klass = id => ({ id, name: `Test ${id}`, aliases: [], variants: [], origin_countries: ['Example'], operators: ['Example'], service: { status: 'commissioned', as_of: '2026-10-27', evidence: ['https://example.org/navy'] }, historical_types: [], pilot: true });
async function addClass(id = 'class-a') { return expect(await call(`/classes/${id}`, { method: 'PUT', role: 'owner', data: klass(id) }), 201); }
function metadata(id, bytes, overrides = {}) {
  return { id, class_id: 'class-a', domain: 'camera', source: { page_url: `https://example.org/photo/${id}`, original_url: `https://example.org/full/${id}.png`, author: 'Example', retrieved_at: '2026-10-27' }, rights: { tier: 'commercial', license: 'CC0-1.0', evidence_url: 'https://example.org/license', download_allowed: true, training_allowed: true, redistribution_allowed: true, attribution: 'Example / CC0' }, quality: { original_width: 1600, original_height: 1000, subject_length_px: 600, sharpness_ok: true, original_resolution: true, not_upscaled: true }, target_bbox: [100, 100, 600, 300], sha256: sha(bytes), pixel_sha256: sha(`pixels-${id}`), phash: sha(id).slice(0, 16), duplicate_group: `dup-${id}`, event_group: `event-${id}`, ...overrides };
}
async function setupImage(id = 'image-a', overrides = {}, seed = 1) {
  const original = png(1600, 1000, seed), data = metadata(id, original, overrides);
  let record = await expect(await call(`/images/${id}`, { method: 'PUT', role: 'collector', data }), 201);
  for (const [kind, bytes] of [['original', original], ['crop', png(600, 300, seed)], ['preview', png(360, 225, seed)]]) {
    const uploaded = await expect(await call(`/images/${id}/assets/${kind}`, { method: 'PUT', role: 'owner', raw: bytes, headers: { 'Content-Type': 'image/png', 'Content-Length': String(bytes.length), 'X-Content-SHA256': sha(bytes) } }), 201); record.revision = uploaded.revision;
  }
  return record;
}
async function accept(id, revision, extra = {}, role = 'verifier') { return call(`/images/${id}/verify`, { method: 'POST', role, headers: { 'If-Match': String(revision) }, data: { verification: { collector: 'collection-agent', verified_by: 'verification-agent', verified_at: '2026-10-27T12:00:00Z', decision: 'accept', class_evidence: ['https://example.org/identified-photo'] }, ...extra } }); }

before(async () => {
  mf = new Miniflare(convertV4MiniflareOptions({ modules: ['index.js', 'validation.js', 'releases.js', 'image-header.js', 'openapi.js'].map(name => ({ type: 'ESModule', path: `${ROOT}src/${name}` })), modulesRoot: ROOT, compatibilityDate: '2026-10-27', compatibilityFlags: ['nodejs_compat'], d1Databases: ['DB'], r2Buckets: ['ASSETS'], bindings: { OWNER_TOKEN: tokens.owner, COLLECTOR_TOKEN: tokens.collector, VERIFIER_TOKEN: tokens.verifier, READER_TOKEN: tokens.reader, ALLOWED_ORIGINS: 'https://boomerrawlings.com' } }));
  const bindings = await mf.getBindings(); db = bindings.DB; bucket = bindings.ASSETS;
  for (const filename of (await readdir(`${ROOT}migrations`)).filter(name => name.endsWith('.sql')).sort()) for (const sql of (await readFile(`${ROOT}migrations/${filename}`, 'utf8')).split(';').filter(x => x.trim())) await db.prepare(sql).run();
});
after(async () => { await mf?.dispose(); });
beforeEach(async () => { for (const table of ['activity', 'audits', 'release_files', 'release_images', 'releases', 'assets', 'images', 'jobs', 'budgets', 'classes', 'object_inventory']) await db.prepare(`DELETE FROM ${table}`).run(); });

test('anonymous reads never reveal pending/restricted media; scoped writes and hostile origins rejected', async () => {
  await addClass();
  await expect(await call('/classes/blocked', { method: 'PUT', data: klass('blocked') }), 401);
  await expect(await call('/classes/blocked', { method: 'PUT', role: 'collector', data: klass('blocked') }), 403);
  await expect(await call('/session', { role: 'owner', headers: { Origin: 'https://attacker.example' } }), 403);
  await expect(await call('/session', { headers: { Authorization: 'Bearer wrong' } }), 401);
  const record = await setupImage('private-a', { rights: { ...metadata('private-a', Buffer.from('x')).rights, redistribution_allowed: false } });
  assert.equal((await expect(await call('/images'), 200)).total, 0);
  await expect(await call('/images/private-a'), 404);
  await expect(await call('/images/private-a/assets/original'), 404);
  await expect(await accept('private-a', record.revision, {}, 'collector'), 403);
  await expect(await accept('private-a', record.revision), 200);
  await expect(await call('/images/private-a'), 404);
  const original = await call('/images/private-a/assets/original', { role: 'reader' }); assert.equal(original.status, 200); assert.equal(original.headers.get('Cache-Control'), 'no-store'); assert.match(original.headers.get('X-Robots-Tag'), /noindex/); await original.arrayBuffer();
  await expect(await call('/images/private-a', { role: 'reader', method: 'PATCH', headers: { 'If-Match': '5' }, data: { changes: { status: 'rejected' }, reason: 'not authorized' } }), 403);
});

test('native header, checksum and quality checks reject thumbnail substitutions and fabricated originals', async () => {
  await addClass(); const thumb = png(120, 80), data = metadata('thumbnail', thumb);
  await expect(await call('/images/thumbnail', { role: 'collector', method: 'PUT', data }), 201);
  const failure = await expect(await call('/images/thumbnail/assets/original', { role: 'owner', method: 'PUT', raw: thumb, headers: { 'Content-Type': 'image/png', 'Content-Length': String(thumb.length), 'X-Content-SHA256': sha(thumb) } }), 422); assert.equal(failure.error.code, 'dimension_mismatch');
  const html = Buffer.from('<html>Access denied</html>'); await expect(await call('/images/bad', { role: 'collector', method: 'PUT', data: metadata('bad', html) }), 201);
  await expect(await call('/images/bad/assets/original', { role: 'owner', method: 'PUT', raw: html, headers: { 'Content-Type': 'image/png', 'Content-Length': String(html.length), 'X-Content-SHA256': sha(html) } }), 422);
  const small = await setupImage('small-subject', { quality: { ...data.quality, subject_length_px: 200 } });
  assert.equal((await expect(await accept(small.id, small.revision), 422)).error.code, 'quality_failed');
  const upscaled = await setupImage('upscaled', { quality: { ...data.quality, not_upscaled: false } }, 2); await expect(await accept(upscaled.id, upscaled.revision), 422);
  const nonclear = await setupImage('no-rights', { rights: { ...data.rights, training_allowed: false } }, 3); await expect(await accept(nonclear.id, nonclear.revision), 422);
});

test('acceptance, exact/near dedup, independent verification, revision conflicts and crop invalidation', async () => {
  await addClass(); const a = await setupImage();
  await expect(await accept(a.id, a.revision, { verification: { collector: ' same ', verified_by: 'SAME', verified_at: '2026-10-27', decision: 'accept', class_evidence: ['https://example.org/proof'] } }), 422);
  const accepted = await expect(await accept(a.id, a.revision), 200); assert.equal(accepted.status, 'accepted');
  const stats = await expect(await call('/stats'), 200); assert.equal(stats.approved_camera, 1);
  const bytes = await call(`/images/${a.id}/assets/original`, { headers: { Range: 'bytes=0-7' } }); assert.equal(bytes.status, 206); assert.equal((await bytes.arrayBuffer()).byteLength, 8);
  const duplicate = await setupImage('duplicate', {}, 1); assert.equal((await expect(await accept(duplicate.id, duplicate.revision), 409)).error.code, 'duplicate_image');
  const near = await setupImage('near', { phash: a.phash }, 4); assert.equal((await expect(await accept(near.id, near.revision), 409)).error.code, 'near_duplicate_review');
  await expect(await call(`/images/${a.id}`, { role: 'owner', method: 'PATCH', headers: { 'If-Match': String(a.revision) }, data: { changes: { target_bbox: [100, 100, 500, 200] }, reason: 'crop correction' } }), 409);
  const edited = await expect(await call(`/images/${a.id}`, { role: 'owner', method: 'PATCH', headers: { 'If-Match': String(accepted.revision) }, data: { changes: { target_bbox: [100, 100, 500, 200] }, reason: 'crop correction' } }), 200); assert.equal(edited.status, 'candidate'); assert.equal(edited.assets.crop, undefined);
  const retained = await db.prepare("SELECT COUNT(*) n FROM object_inventory WHERE object_key=?").bind(accepted.assets.crop.key).first(); assert.equal(retained.n, 1, 'orphaned crop remains budget accounted');
  await expect(await call(`/images/${a.id}/assets/original`), 404); assert.equal((await expect(await call('/stats'), 200)).approved_camera, 0);
});

test('job accounting is atomic, bounded, idempotent on identical assets, and projected costs pause collection', async () => {
  await addClass(); await expect(await call('/jobs', { role: 'collector', method: 'POST', data: { id: 'job-one', max_requests: 1, max_bytes: 1000000 } }), 201);
  const bytes = png(1600, 1000); await expect(await call('/images/job-image', { role: 'collector', method: 'PUT', data: metadata('job-image', bytes) }), 201);
  const request = { role: 'collector', method: 'PUT', raw: bytes, headers: { 'Content-Type': 'image/png', 'Content-Length': String(bytes.length), 'X-Content-SHA256': sha(bytes), 'X-Job-Id': 'job-one' } };
  await expect(await call('/images/job-image/assets/original', request), 201); await expect(await call('/images/job-image/assets/original', request), 200);
  assert.equal((await expect(await call('/images/job-image', { role: 'owner' }), 200)).collection_job_id, 'job-one');
  await expect(await call('/jobs/job-one', { role: 'collector', method: 'PATCH', data: { requests_delta: 1 } }), 429);
  const job = (await expect(await call('/jobs', { role: 'reader' }), 200)).items[0]; assert.equal(job.used_requests, 1); assert.equal(job.used_bytes, bytes.length);
  await expect(await call('/budget', { role: 'owner', method: 'PUT', data: { month: new Date().toISOString().slice(0, 7), external_spend_usd: 36, projected_other_usd: 0 } }), 200);
  await expect(await call('/jobs', { role: 'collector', method: 'POST', data: { id: 'blocked' } }), 429);
});

test('concurrent jobs cannot reserve the same monthly headroom; API schema publishes usable metadata contract', async () => {
  const results = await Promise.all(['budget-one', 'budget-two'].map(id => call('/jobs', { role: 'collector', method: 'POST', data: { id, max_requests: 10, max_bytes: 1000000, estimated_cost_usd: 30 } })));
  assert.deepEqual(results.map(r => r.status).sort(), [201, 429]); await Promise.all(results.map(r => r.arrayBuffer()));
  assert.equal((await expect(await call('/jobs', { role: 'owner' }), 200)).total, 1);
  const schema = await expect(await call('/openapi.json'), 200); assert.equal(schema.openapi, '3.1.0'); assert.ok(schema.components.schemas.Image.properties.pixel_sha256); assert.ok(schema.paths['/images/{id}/assets/{kind}'].put); assert.ok(schema.paths['/releases/{id}/files/{filename}'].get);
  const refs = JSON.stringify(schema).matchAll(/"\$ref":"#\/components\/schemas\/([^\"]+)"/g); for (const [, name] of refs) assert.ok(schema.components.schemas[name], `Undefined schema ${name}`);
});

async function seedReleaseImages() {
  await addClass('class-a'); await addClass('class-b'); const imageBytes = png(1600, 1000); const key = 'test/synthetic-original'; await bucket.put(key, imageBytes);
  const items = [];
  for (const c of ['a', 'b']) for (let n = 0; n < 100; n++) {
    const id = `${c}-${String(n).padStart(3, '0')}`, data = metadata(id, imageBytes, { class_id: `class-${c}`, collection_job_id: `batch-${c}`, status: 'accepted', sha256: sha(id), pixel_sha256: sha(`pixels-${id}`), hull: `hull-${c}-${n % 5}`, viewpoint: ['port', 'starboard', 'bow'][n % 3] });
    await db.prepare('INSERT INTO images(id,class_id,domain,status,rights_tier,public_delivery,sha256,pixel_sha256,phash,duplicate_group,event_group,data,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, data.class_id, data.domain, 'accepted', 'commercial', 1, data.sha256, data.pixel_sha256, data.phash, data.duplicate_group, data.event_group, JSON.stringify(data), '2026-10-27').run();
    for (const kind of ['original', 'crop', 'preview']) await db.prepare('INSERT INTO assets(image_id,kind,object_key,sha256,bytes,content_type) VALUES(?,?,?,?,?,?)').bind(id, kind, key, sha(imageBytes), imageBytes.length, 'image/png').run();
    items.push({ image_id: id, split: n < 80 ? 'train' : n < 90 ? 'validation' : 'test' });
  }
  return items;
}
test('balanced releases are immutable, stream checksummed manifests, sample audits, and retract affected assets on failure', async () => {
  const items = await seedReleaseImages();
  await expect(await call('/releases', { role: 'collector', method: 'POST', data: { id: 'not-allowed', domain: 'camera', rights_tier: 'commercial', items } }), 403);
  const release = await expect(await call('/releases', { role: 'verifier', method: 'POST', data: { id: 'pilot-r1', domain: 'camera', rights_tier: 'commercial', items } }), 201);
  assert.equal(release.image_count, 200); assert.equal(release.audit_sample.length, 40); assert.equal(release.status, 'provisional');
  const response = await call('/releases/pilot-r1/files/images.jsonl'); assert.equal(response.status, 200); const contents = await response.text(); assert.equal(sha(contents), response.headers.get('X-Content-SHA256'));
  const manifest = contents.trim().split('\n').map(JSON.parse); assert.equal(manifest.length, 200); assert.match(manifest[0].file_name, /^crops\//); assert.equal(manifest[0].label, manifest[0].class_id); assert.match(manifest[0].assets.original.download_url, /^\/subs\/api\/v1\/images/);
  await expect(await call('/releases', { role: 'verifier', method: 'POST', data: { id: 'pilot-r1', domain: 'camera', rights_tier: 'commercial', items } }), 409);
  const audit = await expect(await call('/releases/pilot-r1/audits', { role: 'owner', method: 'POST', data: { image_id: 'a-000', result: 'fail', reason: 'Misidentified class in review.' } }), 201); assert.equal(audit.status, 'withdrawn');
  await expect(await call('/releases/pilot-r1/files/images.jsonl'), 410); await expect(await call('/images/a-000/assets/original'), 404);
  await expect(await call('/images/a-099/assets/original'), 404); assert.equal((await db.prepare("SELECT COUNT(*) n FROM images WHERE status='quarantined'").first()).n, 100, 'whole failed collection batch quarantined');
  assert.equal((await expect(await call('/releases'), 200)).items[0].status, 'withdrawn');
});

test('source URLs carrying credentials cannot enter the collection', async () => {
  await addClass(); const data = metadata('url-secret', png(1600, 1000)); data.rights.evidence_url = 'https://example.org/photo?token=secret';
  await expect(await call('/images/url-secret', { role: 'collector', method: 'PUT', data }), 400);
});

async function seedListingImages() {
  await addClass();
  await expect(await call('/classes/class-b', { method: 'PUT', role: 'owner', data: { ...klass('class-b'), name: 'Other Navy Design', origin_countries: ['Other'] } }), 201);
  const fixtures = [
    ['public-a', 'accepted', true, '2026-10-28', { variant: 'alpha', operator_country: 'Canada', event_group: 'event-a', duplicate_group: 'group-a' }],
    ['public-b', 'accepted', true, '2026-10-28', { variant: null, operator_country: null }],
    ['public-c', 'accepted', true, '2026-10-27', { class_id: 'class-b', domain: 'satellite' }],
    ['restricted', 'accepted', false, '2026-10-29', {}],
    ['held', 'held', true, '2026-10-30', {}],
    ['pending', 'candidate', true, '2026-10-31', {}],
  ];
  for (const [id, status, publicDelivery, updated, extra] of fixtures) {
    const data = metadata(id, Buffer.from(id), { ...extra, status });
    data.rights.redistribution_allowed = publicDelivery;
    if (id === 'public-c') data.rights.tier = 'research';
    await db.prepare('INSERT INTO images(id,class_id,domain,status,rights_tier,public_delivery,duplicate_group,event_group,data,revision,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id, data.class_id, data.domain, status, data.rights.tier, +publicDelivery, data.duplicate_group ?? null, data.event_group ?? null, JSON.stringify(data), 7, updated).run();
    await db.prepare('INSERT INTO assets(image_id,kind,object_key,sha256,bytes,content_type) VALUES(?,?,?,?,?,?)').bind(id, 'original', `test/${id}`, sha(id), 123, 'image/jpeg').run();
  }
}

test('bounded image IDs preserve privacy, missing-ID behavior and complete record fields', async () => {
  await seedListingImages();
  const ids = 'pending,restricted,public-c,missing,public-b,held,public-a,public-a';
  const publicPage = await expect(await call(`/images?ids=${ids}`), 200);
  assert.equal(publicPage.total, 3);
  assert.deepEqual(publicPage.items.map(row => row.id), ['public-a', 'public-b', 'public-c']);
  for (const row of publicPage.items) assert.deepEqual(row, await expect(await call(`/images/${row.id}`), 200));
  for (const role of ['owner', 'collector', 'verifier', 'reader']) {
    const page = await expect(await call(`/images?ids=${ids}`, { role }), 200);
    assert.equal(page.total, 6);
    assert.deepEqual(page.items.map(row => row.id), ['pending', 'held', 'restricted', 'public-a', 'public-b', 'public-c']);
  }
  for (const query of ['ids=restricted,pending,held', `ids=${ids}&status=candidate`, `ids=${ids}&status=held`]) {
    const page = await expect(await call(`/images?${query}`), 200);
    assert.equal(page.total, 0); assert.deepEqual(page.items, []);
  }
});

test('image IDs reject malformed or unbounded input and compose with paging and existing filters', async () => {
  await seedListingImages();
  for (const ids of ['', ',', 'public-a,', ',public-a', 'public-a,,public-b', 'UPPER', 'has space', 'a/b', 'x'.repeat(97), Array(51).fill('public-a').join(',')]) {
    await expect(await call(`/images?ids=${encodeURIComponent(ids)}`), 400);
  }
  await expect(await call('/images?ids=public-a&ids=public-b'), 400);
  const missing = Array.from({ length: 50 }, (_, index) => `missing-${index}`).join(',');
  assert.equal((await expect(await call(`/images?ids=${missing}`), 200)).total, 0);
  const paged = await expect(await call('/images?ids=public-c,public-b,public-a&limit=1&offset=1'), 200);
  assert.equal(paged.total, 3); assert.equal(paged.limit, 1); assert.equal(paged.offset, 1); assert.deepEqual(paged.items.map(row => row.id), ['public-b']);
  const ids = 'public-a,public-b,public-c';
  const cases = [
    ['class_id=class-a&variant=alpha&operator_country=Canada&event_group=event-a&duplicate_group=group-a', ['public-a']],
    ['variant=__unknown__&operator_country=__unknown__&class_id=class-a', ['public-b']],
    ['status=accepted&domain=satellite&rights_tier=research', ['public-c']],
    ['q=Other%20Navy%20Design&origin_country=Other', ['public-c']],
    ['q=Test%20class-a&origin_country=Example', ['public-a', 'public-b']],
    ['q=Other%20Navy%20Design&origin_country=Example', []],
  ];
  for (const [filters, expected] of cases) {
    const page = await expect(await call(`/images?ids=${ids}&${filters}`), 200);
    assert.deepEqual(page.items.map(row => row.id), expected); assert.equal(page.total, expected.length);
  }
  const schema = await expect(await call('/openapi.json'), 200), parameter = schema.paths['/images'].get.parameters.find(item => item.name === 'ids');
  assert.equal(parameter.explode, false); assert.equal(parameter.schema.maxItems, 50); assert.equal(parameter.schema.minItems, 1);
});

test('image list query plans use ordering and ID indexes without unnecessary class joins', async () => {
  await seedListingImages();
  async function queriesFor(role, query) {
    const queries = [];
    const env = { DB: { prepare(sql) { return { bind(...args) { queries.push({ sql, args }); return db.prepare(sql).bind(...args); } }; } } };
    await expect(await imageList(env, role, new URLSearchParams(query)), 200);
    for (const query of queries) query.plan = (await db.prepare(`EXPLAIN QUERY PLAN ${query.sql}`).bind(...query.args).all()).results.map(row => row.detail).join('\n');
    return queries;
  }
  for (const [role, index] of [['reader', 'images_updated'], ['public', 'images_public_updated']]) {
    const queries = await queriesFor(role, 'limit=1');
    assert.equal(queries.length, 2);
    assert.ok(queries.every(query => !query.sql.includes('JOIN classes')));
    assert.match(queries[1].plan, new RegExp(index)); assert.doesNotMatch(queries[1].plan, /TEMP B-TREE/);
  }
  for (const role of ['reader', 'public']) {
    const targeted = await queriesFor(role, 'ids=public-a,missing&limit=50');
    for (const query of targeted) assert.match(query.plan, /sqlite_autoindex_images_1 \(id=\?\)/);
  }
  const filtered = await queriesFor('public', 'q=Other&origin_country=Other');
  assert.ok(filtered.every(query => query.sql.includes('JOIN classes')));
});

test('release validator rejects leakage, insufficient samples and duplicate groups; satellite has independent domain', () => {
  const record = n => ({ id: `img-${n}`, class_id: n < 100 ? 'a' : 'b', domain: 'camera', status: 'accepted', rights: { tier: 'commercial', training_allowed: true }, duplicate_group: `d${n}`, event_group: `e${n}`, split: n % 10 ? 'train' : 'test' });
  const valid = Array.from({ length: 200 }, (_, n) => record(n)); assert.equal(validateRelease(valid, 'camera', 'commercial').size, 2);
  valid[1].event_group = valid[0].event_group; assert.throws(() => validateRelease(valid, 'camera', 'commercial'), /splits/); valid[1].event_group = 'e1';
  valid[1].duplicate_group = valid[0].duplicate_group; assert.throws(() => validateRelease(valid, 'camera', 'commercial'), /Duplicate/);
  assert.throws(() => validateRelease([record(0), record(100)], 'camera', 'commercial'), /100/);
  assert.equal(validateRelease([record(0), record(100)].map(r => ({ ...r, domain: 'satellite' })), 'satellite', 'commercial').size, 2);
  assert.equal(hamming('0000000000000000', '0000000000000001'), 1);
});
