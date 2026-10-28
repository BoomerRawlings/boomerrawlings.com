import { createHash } from 'node:crypto';
import { BASE, Problem, requireValue, identifier, text, validateRelease } from './validation.js';
import { body, rows, first, allowed, json, activity, streamAsset } from './index.js';

const encode = new TextEncoder(), date = () => new Date().toISOString();
const FILES = ['classes.json', 'images.jsonl', 'README.md', 'ATTRIBUTION.json', 'coverage.json', 'CHANGELOG.md', 'checksums.json'];
function extension(type) { return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/tiff': 'tif' }[type] ?? 'bin'; }
function exported(row, split) {
  const record = { ...JSON.parse(row.data), id: row.id, status: row.status, revision: row.revision, split, label: row.class_id }, assets = JSON.parse(row.asset_data);
  for (const [kind, asset] of Object.entries(assets)) { asset.file_name = `${kind === 'original' ? 'originals' : kind === 'crop' ? 'crops' : 'previews'}/${row.id}.${extension(asset.content_type)}`; asset.download_url = `${BASE}/images/${row.id}/assets/${kind}`; delete asset.key; }
  record.assets = assets; record.file_name = assets.crop.file_name; return record;
}
async function saveText(env, releaseId, filename, content, contentType = 'application/json; charset=utf-8') {
  const bytes = encode.encode(content), sha = createHash('sha256').update(bytes).digest('hex'), key = `releases/${releaseId}/${filename}`;
  await env.DB.prepare("INSERT OR IGNORE INTO object_inventory(object_key,bytes,sha256,state,created_at) VALUES(?,?,?,'reserved',?)").bind(key, bytes.length, sha, date()).run();
  await env.ASSETS.put(key, bytes, { sha256: sha, httpMetadata: { contentType } });
  await env.DB.prepare("UPDATE object_inventory SET state='stored' WHERE object_key=?").bind(key).run();
  await env.DB.prepare('INSERT INTO release_files(release_id,filename,object_key,sha256,bytes,content_type) VALUES(?,?,?,?,?,?)').bind(releaseId, filename, key, sha, bytes.length, contentType).run();
  return { filename, sha256: sha, bytes: bytes.length };
}
async function saveManifest(env, releaseId) {
  const length = (await first(env, 'SELECT COALESCE(SUM(length(CAST(snapshot AS BLOB))+1),0) bytes FROM release_images WHERE release_id=?', [releaseId])).bytes;
  const stream = new FixedLengthStream(length), writer = stream.writable.getWriter(), digest = createHash('sha256');
  const key = `releases/${releaseId}/images.jsonl`;
  await env.DB.prepare("INSERT OR IGNORE INTO object_inventory(object_key,bytes,state,created_at) VALUES(?,?,'reserved',?)").bind(key, length, date()).run();
  const pumping = (async () => {
    let last = '';
    try {
      while (true) {
        const records = await rows(env, 'SELECT image_id,snapshot FROM release_images WHERE release_id=? AND image_id>? ORDER BY image_id LIMIT 500', [releaseId, last]);
        if (!records.length) break;
        for (const record of records) { const bytes = encode.encode(`${record.snapshot}\n`); digest.update(bytes); await writer.write(bytes); }
        last = records.at(-1).image_id;
      }
      await writer.close();
    } catch (error) { await writer.abort(error); throw error; }
  })();
  const putting = env.ASSETS.put(key, stream.readable, { httpMetadata: { contentType: 'application/x-ndjson' } });
  await Promise.all([pumping, putting]);
  const sha = digest.digest('hex');
  await env.DB.prepare("UPDATE object_inventory SET state='stored',sha256=? WHERE object_key=?").bind(sha, key).run();
  await env.DB.prepare('INSERT INTO release_files(release_id,filename,object_key,sha256,bytes,content_type) VALUES(?,?,?,?,?,?)').bind(releaseId, 'images.jsonl', key, sha, length, 'application/x-ndjson').run();
  return { filename: 'images.jsonl', sha256: sha, bytes: length };
}
function auditSample(records) {
  const buckets = new Map();
  for (const record of records) {
    const key = record.class_id; if (!buckets.has(key)) buckets.set(key, new Map());
    const strata = buckets.get(key), stratum = `${new URL(record.source.page_url).hostname}|${record.viewpoint ?? 'unknown'}`;
    if (!strata.has(stratum)) strata.set(stratum, []);
    strata.get(stratum).push({ image_id: record.id, class_id: key, source: record.source.page_url, viewpoint: record.viewpoint ?? null, rank: createHash('sha256').update(record.id).digest('hex') });
  }
  const sample = [];
  for (const strata of buckets.values()) {
    const queues = [...strata.values()]; queues.forEach(queue => queue.sort((a, b) => a.rank.localeCompare(b.rank)));
    let taken = 0;
    while (taken < 20 && queues.some(queue => queue.length)) for (const queue of queues) if (queue.length && taken < 20) { const item = queue.shift(); delete item.rank; sample.push(item); taken++; }
  }
  return sample;
}
export async function createRelease(request, env, role) {
  allowed(role, ['owner', 'verifier']); const input = await body(request, 8 * 1024 * 1024), id = identifier(input.id);
  requireValue(['camera', 'satellite'].includes(input.domain), 'Invalid domain.'); requireValue(['commercial', 'research'].includes(input.rights_tier), 'Invalid rights tier.');
  requireValue(Array.isArray(input.items) && input.items.length >= 2 && input.items.length <= 50000, 'Release items required (maximum 50000).');
  requireValue(!await first(env, 'SELECT id FROM releases WHERE id=?', [id]), 'Release ID already exists; immutable releases cannot be overwritten.', 'conflict', 409);
  const splitMap = new Map(); for (const item of input.items) { identifier(item.image_id); requireValue(!splitMap.has(item.image_id), 'Repeated image in release.', 'duplicate_image', 422); requireValue(['train', 'validation', 'test'].includes(item.split), 'Invalid split.'); splitMap.set(item.image_id, item.split); }
  const stub = { id, domain: input.domain, rights_tier: input.rights_tier, status: 'publishing', created_at: date(), files: FILES, change_history: String(input.change_history ?? 'Initial collection release.').slice(0, 4000) };
  const inserted = await env.DB.prepare('INSERT OR IGNORE INTO releases(id,domain,rights_tier,status,public_delivery,data,created_at) VALUES(?,?,?,?,0,?,?)').bind(id, input.domain, input.rights_tier, 'publishing', JSON.stringify(stub), stub.created_at).run();
  requireValue(inserted.meta.changes === 1, 'Release ID already exists.', 'conflict', 409);
  try {
    // Bounded record chunks; only compact sampling/counting metadata stays in memory.
    const ids = [...splitMap.keys()], light = [], attribution = new Map(); let publicDelivery = true;
    for (let offset = 0; offset < ids.length; offset += 200) {
      const chunk = ids.slice(offset, offset + 200), records = await rows(env, "SELECT i.*,json_extract(c.data,'$.service.status') class_status, (SELECT json_group_object(a.kind,json_object('key',a.object_key,'sha256',a.sha256,'bytes',a.bytes,'content_type',a.content_type)) FROM assets a WHERE a.image_id=i.id) asset_data FROM images i JOIN classes c ON c.id=i.class_id WHERE i.id IN (SELECT value FROM json_each(?))", [JSON.stringify(chunk)]);
      requireValue(records.length === chunk.length, 'Release references missing images.', 'missing_image', 422);
      const snapshots = [];
      for (const row of records) {
        requireValue(row.class_status === 'commissioned', 'Class is no longer eligible in the current snapshot.', 'ineligible_class', 422);
        const record = exported(row, splitMap.get(row.id));
        requireValue(record.status === 'accepted' && record.domain === input.domain && record.rights.tier === input.rights_tier && record.rights.training_allowed, 'Release image is ineligible.', 'ineligible', 422);
        publicDelivery &&= record.rights.redistribution_allowed;
        light.push({ id: record.id, class_id: record.class_id, domain: record.domain, status: record.status, rights: { tier: record.rights.tier, training_allowed: true }, duplicate_group: record.duplicate_group, event_group: record.event_group, split: record.split, hull: record.hull, source: { page_url: record.source.page_url }, viewpoint: record.viewpoint });
        attribution.set(record.id, { image_id: record.id, source: record.source.page_url, license: record.rights.license, evidence_url: record.rights.evidence_url, attribution: record.rights.attribution });
        snapshots.push({ image_id: record.id, class_id: record.class_id, split: record.split, snapshot: JSON.stringify(record) });
      }
      const serialized = JSON.stringify(snapshots); requireValue(encode.encode(serialized).length < 1900000, 'Image metadata too large for a release batch.', 'metadata_too_large', 422);
      await env.DB.prepare("INSERT INTO release_images(release_id,image_id,class_id,split,snapshot) SELECT ?,json_extract(value,'$.image_id'),json_extract(value,'$.class_id'),json_extract(value,'$.split'),json_extract(value,'$.snapshot') FROM json_each(?)").bind(id, serialized).run();
    }
    const counts = validateRelease(light, input.domain, input.rights_tier), classes = (await rows(env, 'SELECT data FROM classes WHERE id IN (SELECT DISTINCT class_id FROM release_images WHERE release_id=?) ORDER BY id', [id])).map(row => JSON.parse(row.data));
    const eligible = await rows(env, "SELECT i.class_id,COUNT(*) count FROM images i JOIN classes c ON c.id=i.class_id WHERE i.status='accepted' AND i.domain=? AND i.rights_tier=? AND json_extract(c.data,'$.service.status')='commissioned' GROUP BY i.class_id HAVING COUNT(*)>=?", [input.domain, input.rights_tier, input.domain === 'camera' ? 100 : 1]);
    const target = Math.min(input.domain === 'camera' ? 400 : Number.MAX_SAFE_INTEGER, ...eligible.map(row => row.count));
    requireValue(eligible.length === counts.size && eligible.every(row => counts.get(row.class_id) === target), 'Release must include every eligible class at the smallest available count (camera cap400).', 'coverage_mismatch', 422);
    const splitCounts = {}, hulls = new Map(); for (const record of light) { splitCounts[record.class_id] ??= { train: 0, validation: 0, test: 0 }; splitCounts[record.class_id][record.split]++; if (record.hull) { const hullKey = `${record.class_id}:${record.hull}`; if (!hulls.has(hullKey)) hulls.set(hullKey, new Set()); hulls.get(hullKey).add(record.split); } }
    requireValue(light.some(record => record.split === 'train'), 'A training partition is required.', 'invalid_split', 422);
    const warnings = []; for (const [classId, count] of counts) for (const [split, fraction] of Object.entries({ train: 0.8, validation: 0.1, test: 0.1 })) if (splitCounts[classId][split] === 0 || Math.abs(splitCounts[classId][split] / count - fraction) > 0.1) warnings.push(`${classId}: ${split} has ${splitCounts[classId][split]}/${count}; target ${fraction * 100}%.`);
    const coverage = { classes: [...counts].map(([class_id, count]) => ({ class_id, count, goal: input.domain === 'camera' ? 400 : null, deficit: input.domain === 'camera' ? Math.max(0, 400 - count) : null, splits: splitCounts[class_id] })), warnings, hull_overlap: [...hulls].filter(([, splits]) => splits.size > 1).map(([hull, splits]) => ({ hull, splits: [...splits] })), split_target: { train: 0.8, validation: 0.1, test: 0.1 }, split_note: 'Event and duplicate groups are kept together; counts may differ from target fractions.' };
    const meta = { ...stub, status: 'provisional', public: publicDelivery, image_count: light.length, class_count: counts.size, per_class_count: [...counts.values()][0], audit_sample: auditSample(light), audit_status: 'pending', snapshot_date: classes.map(record => record.service.as_of).sort().at(-1), coverage };
    const manifestFiles = [];
    manifestFiles.push(await saveText(env, id, 'classes.json', JSON.stringify(classes, null, 2)));
    manifestFiles.push(await saveManifest(env, id));
    manifestFiles.push(await saveText(env, id, 'ATTRIBUTION.json', JSON.stringify([...attribution.values()], null, 2)));
    manifestFiles.push(await saveText(env, id, 'coverage.json', JSON.stringify(coverage, null, 2)));
    manifestFiles.push(await saveText(env, id, 'CHANGELOG.md', `# ${id}\n\n${stub.change_history}\n`, 'text/markdown; charset=utf-8'));
    manifestFiles.push(await saveText(env, id, 'README.md', `# SUBS ${id}\n\nProvisional ${input.domain} image dataset for submarine class recognition. ${light.length} originals, ${counts.size} classes, ${meta.per_class_count} per class.\n\nFleet snapshot: ${meta.snapshot_date}. Rights tier: ${input.rights_tier}. Per-image licenses and attribution in ATTRIBUTION.json and images.jsonl govern use; the tier is not a replacement license. Public delivery: ${publicDelivery}.\n\nOriginals are unchanged; crops/previews are derivatives of the same photograph and never additional examples. Labels are source-supported and independently verified by agents, pending owner sample audit. Unknown metadata remains unknown. No accuracy claim or trained model is supplied. Camera minima:1200px image long edge and400px subject. Satellite minima:200 native subject pixels and0.5m/pixel or finer.\n\nDownload images.jsonl and classes.json, then use assets.original/ crop download_url and sha256 to fetch files under their relative file_name. Default file_name is the target crop; label is class_id. Relative download URLs resolve against https://boomerrawlings.com. Restricted releases require a scoped bearer token. Standard Python loader: tools/subs. Pass only pixels and labels into classification training; provenance is audit metadata.\n\nTrain/validation/test target80/10/10, grouped by capture event and duplicate group. Inspect coverage.json for actual counts and hull overlap. Website thumbnails must never be used as training originals. Historical and current configurations can coexist, tagged where known.\n\nAudits happen after provisional publication. Check release status before downloading; withdrawn releases must not be used. Corrections produce a new version. Other classes and collection shortfalls remain outside this balanced subset.\n`, 'text/markdown; charset=utf-8'));
    await saveText(env, id, 'checksums.json', JSON.stringify({ algorithm: 'sha256', files: manifestFiles }, null, 2));
    // Do not publish a snapshot if a concurrent correction invalidated any source row.
    const invalid = await first(env, "SELECT COUNT(*) n FROM release_images r JOIN images i ON i.id=r.image_id WHERE r.release_id=? AND (i.status!='accepted' OR i.revision!=json_extract(r.snapshot,'$.revision'))", [id]);
    requireValue(invalid.n === 0, 'Source records changed during publication. Create a new release.', 'revision_conflict', 409);
    const published = await env.DB.prepare("UPDATE releases SET status='provisional',public_delivery=?,data=? WHERE id=? AND status='publishing'").bind(+publicDelivery, JSON.stringify(meta), id).run();
    requireValue(published.meta.changes === 1, 'Release was invalidated during publication.', 'revision_conflict', 409);
    await activity(env, role, 'release.publish', id); return json(meta, 201);
  } catch (error) {
    await env.DB.prepare("UPDATE releases SET status='failed',public_delivery=0 WHERE id=? AND status='publishing'").bind(id).run(); throw error;
  }
}
export async function getRelease(env, role, id) {
  const row = await first(env, 'SELECT * FROM releases WHERE id=?', [id]); requireValue(row && (role !== 'public' || row.public_delivery === 1), 'Release not found.', 'not_found', 404);
  const audits = await rows(env, 'SELECT image_id,result,reason,actor,created_at FROM audits WHERE release_id=? ORDER BY id', [id]);
  const result = { ...JSON.parse(row.data), status: row.status, audits };
  const latest = new Map(); for (const audit of audits) latest.set(audit.image_id, audit.result);
  result.audit_status = (result.audit_sample ?? []).length && result.audit_sample.every(item => latest.get(item.image_id) === 'pass') && row.status !== 'withdrawn' ? 'sample_passed' : row.status === 'withdrawn' ? 'failed_or_withdrawn' : 'pending';
  return result;
}
export async function releaseFile(request, env, role, id, filename) {
  const release = await getRelease(env, role, id); requireValue(release.status === 'provisional', 'Release is unavailable or withdrawn.', 'release_unavailable', 410);
  requireValue(FILES.includes(filename), 'Unknown release file.', 'not_found', 404);
  const file = await first(env, 'SELECT * FROM release_files WHERE release_id=? AND filename=?', [id, filename]); requireValue(file, 'Release file unavailable.', 'not_found', 404);
  return streamAsset(request, env, file.object_key, file.content_type, file.sha256);
}
export async function auditRelease(request, env, role, id) {
  allowed(role, ['owner', 'verifier']); await getRelease(env, role, id); const input = await body(request); identifier(input.image_id); text(input.reason); requireValue(['pass', 'fail'].includes(input.result), 'Audit must pass or fail.');
  requireValue(await first(env, 'SELECT image_id FROM release_images WHERE release_id=? AND image_id=?', [id, input.image_id]), 'Image does not belong to release.', 'invalid_audit', 422);
  await env.DB.prepare('INSERT INTO audits(release_id,image_id,result,reason,actor,created_at) VALUES(?,?,?,?,?,?)').bind(id, input.image_id, input.result, input.reason, role, date()).run();
  if (input.result === 'fail') {
    const record = await first(env, "SELECT event_group,json_extract(data,'$.collection_job_id') collection_job_id FROM images WHERE id=?", [input.image_id]);
    await env.DB.batch([
      env.DB.prepare("UPDATE images SET status='quarantined',revision=revision+1,updated_at=? WHERE id=? OR event_group=? OR (? IS NOT NULL AND json_extract(data,'$.collection_job_id')=?)").bind(date(), input.image_id, record.event_group, record.collection_job_id, record.collection_job_id),
      env.DB.prepare("UPDATE releases SET status='withdrawn',data=json_set(data,'$.withdrawal_reason',?) WHERE id IN (SELECT DISTINCT r.release_id FROM release_images r JOIN images i ON i.id=r.image_id WHERE i.id=? OR i.event_group=? OR (? IS NOT NULL AND json_extract(i.data,'$.collection_job_id')=?))").bind(input.reason, input.image_id, record.event_group, record.collection_job_id, record.collection_job_id),
    ]);
  }
  await activity(env, role, `audit.${input.result}`, input.image_id, input.reason); return json(await getRelease(env, role, id), 201);
}
export async function withdrawRelease(request, env, role, id) {
  allowed(role, ['owner', 'verifier']); await getRelease(env, role, id); const input = await body(request); text(input.reason);
  await env.DB.prepare("UPDATE releases SET status='withdrawn',data=json_set(data,'$.withdrawal_reason',?) WHERE id=?").bind(input.reason, id).run(); await activity(env, role, 'release.withdraw', id, input.reason); return json(await getRelease(env, role, id));
}
