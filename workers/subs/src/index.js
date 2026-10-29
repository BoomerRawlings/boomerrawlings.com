import { BASE, MAX_FILE, MIME, Problem, requireValue, identifier, text, url, hash, finite, integer, classRecord, imageRecord, validateAcceptance, hamming, evidenceUrl } from './validation.js';
import { createRelease, getRelease, releaseFile, auditRelease, withdrawRelease } from './releases.js';
import { inspectedStream } from './image-header.js';
import openapi from './openapi.js';

const encoder = new TextEncoder();
const now = () => new Date().toISOString();
const month = () => now().slice(0, 7);
export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
export async function body(request, max = 256 * 1024) {
  requireValue((request.headers.get('content-type') ?? '').startsWith('application/json'), 'Content-Type must be application/json.', 'unsupported_media', 415);
  const reader = request.body?.getReader(); requireValue(reader, 'JSON body required.');
  const chunks = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > max) { await reader.cancel(); throw new Problem(413, 'too_large', 'Request exceeds size limit.'); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { const result = JSON.parse(new TextDecoder().decode(bytes)); requireValue(result && typeof result === 'object' && !Array.isArray(result), 'JSON object required.'); return result; } catch (error) { if (error instanceof Problem) throw error; throw new Problem(400, 'invalid_json', 'Malformed JSON.'); }
}
export async function rows(env, sql, args = []) { return (await env.DB.prepare(sql).bind(...args).all()).results; }
export async function first(env, sql, args = []) { return env.DB.prepare(sql).bind(...args).first(); }
export function allowed(role, roles) { requireValue(roles.includes(role), role === 'public' ? 'Authentication required.' : 'Credential has insufficient scope.', role === 'public' ? 'unauthorized' : 'forbidden', role === 'public' ? 401 : 403); }
export async function activity(env, role, action, id, reason = '') { await env.DB.prepare('INSERT INTO activity(actor,action,entity_id,reason,created_at) VALUES(?,?,?,?,?)').bind(role, action, id, String(reason).slice(0, 2000), now()).run(); }
async function roleFor(request, env) {
  const authorization = request.headers.get('Authorization'); if (!authorization) return 'public';
  requireValue(authorization.startsWith('Bearer ') && authorization.length <= 1024, 'Invalid credential.', 'unauthorized', 401);
  const incoming = await crypto.subtle.digest('SHA-256', encoder.encode(authorization.slice(7)));
  let role;
  for (const [name, value] of [['owner', env.OWNER_TOKEN], ['collector', env.COLLECTOR_TOKEN], ['verifier', env.VERIFIER_TOKEN], ['reader', env.READER_TOKEN]]) {
    const candidate = await crypto.subtle.digest('SHA-256', encoder.encode(typeof value === 'string' ? value : ''));
    if (crypto.subtle.timingSafeEqual(incoming, candidate) && typeof value === 'string' && value.length >= 24) role = name;
  }
  requireValue(role, 'Invalid credential.', 'unauthorized', 401); return role;
}
function page(params) { const limit = params.has('limit') ? Number(params.get('limit')) : 50, offset = params.has('offset') ? Number(params.get('offset')) : 0; integer(limit, 1, 100); integer(offset, 0, 1000000); return { limit, offset }; }
function revision(request, row) { const value = request.headers.get('If-Match')?.replaceAll('"', ''); requireValue(value != null, 'If-Match revision is required.', 'precondition_required', 428); requireValue(Number(value) === row.revision, 'Record changed. Reload before saving.', 'revision_conflict', 409); return row.revision; }
function statementActivity(env, role, action, id, reason = '') { return env.DB.prepare('INSERT INTO activity(actor,action,entity_id,reason,created_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(role, action, id, String(reason).slice(0, 2000), now()); }
async function changed(env, statement, role, action, id, reason) { const result = await env.DB.batch([statement, statementActivity(env, role, action, id, reason)]); requireValue(result[0].meta.changes === 1, 'Record changed. Reload before saving.', 'revision_conflict', 409); }
export async function image(env, id) {
  const row = await first(env, 'SELECT * FROM images WHERE id=?', [id]); if (!row) return null;
  const assets = {}; for (const asset of await rows(env, 'SELECT * FROM assets WHERE image_id=?', [id])) assets[asset.kind] = { key: asset.object_key, sha256: asset.sha256, bytes: asset.bytes, content_type: asset.content_type, download_url: `${BASE}/images/${id}/assets/${asset.kind}` };
  return { ...JSON.parse(row.data), id: row.id, class_id: row.class_id, domain: row.domain, status: row.status, revision: row.revision, updated_at: row.updated_at, assets };
}
export function visible(record, role) { return role !== 'public' || (record.status === 'accepted' && record.rights.redistribution_allowed === true); }
async function invalidateReleases(env, imageId, reason) {
  await env.DB.prepare("UPDATE releases SET status='withdrawn',data=json_set(data,'$.withdrawal_reason',?) WHERE id IN (SELECT release_id FROM release_images WHERE image_id=?) AND status!='withdrawn'").bind(reason, imageId).run();
}
async function classList(env, params) {
  const { limit, offset } = page(params), clauses = [], values = [];
  if (params.get('q')) { clauses.push('(name LIKE ? OR data LIKE ?)'); values.push(`%${params.get('q')}%`, `%${params.get('q')}%`); }
  if (params.get('pilot') === 'true') clauses.push("json_extract(data,'$.pilot')=1");
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = (await first(env, `SELECT COUNT(*) n FROM classes ${where}`, values)).n;
  const result = await rows(env, `SELECT * FROM classes ${where} ORDER BY name,id LIMIT ? OFFSET ?`, [...values, limit, offset]);
  const counts = await rows(env, "SELECT class_id, SUM(CASE WHEN status='accepted' AND domain='camera' THEN 1 ELSE 0 END) camera, SUM(CASE WHEN status='accepted' AND domain='satellite' THEN 1 ELSE 0 END) satellite, SUM(CASE WHEN status IN ('candidate','held') THEN 1 ELSE 0 END) candidates FROM images GROUP BY class_id");
  const map = new Map(counts.map(c => [c.class_id, c]));
  return json({ items: result.map(row => { const count = map.get(row.id) ?? { camera: 0, satellite: 0, candidates: 0 }; return { ...JSON.parse(row.data), revision: row.revision, counts: { camera: count.camera, satellite: count.satellite, candidates: count.candidates, deficit: Math.max(0, 400 - count.camera) } }; }), total, offset, limit });
}
async function putClass(request, env, role, id) {
  allowed(role, ['owner']); const data = classRecord(await body(request), id), row = await first(env, 'SELECT * FROM classes WHERE id=?', [id]);
  if (row) { revision(request, row); await changed(env, env.DB.prepare('UPDATE classes SET name=?,data=?,revision=revision+1 WHERE id=? AND revision=?').bind(data.name, JSON.stringify(data), id, row.revision), role, 'class.update', id); }
  else await changed(env, env.DB.prepare('INSERT OR IGNORE INTO classes(id,name,data) VALUES(?,?,?)').bind(id, data.name, JSON.stringify(data)), role, 'class.create', id);
  return json({ ...data, revision: (row?.revision ?? 0) + 1 }, row ? 200 : 201);
}
export async function imageList(env, role, params) {
  const { limit, offset } = page(params), clauses = [], args = [];
  let selectedIds;
  if (role === 'public') clauses.push("i.status='accepted' AND i.public_delivery=1");
  if (params.has('ids')) {
    requireValue(params.getAll('ids').length === 1, 'Supply ids once as a comma-separated list.');
    const ids = params.get('ids').split(',');
    requireValue(ids.length <= 50, 'At most 50 image identifiers are allowed.');
    selectedIds = [...new Set(ids.map(identifier))]; args.push(...selectedIds);
  }
  for (const key of ['class_id', 'domain', 'status', 'rights_tier', 'duplicate_group', 'event_group']) if (params.get(key)) { clauses.push(`i.${key}=?`); args.push(params.get(key)); }
  for (const key of ['variant', 'operator_country']) if (params.get(key)) { if (params.get(key) === '__unknown__') clauses.push(`COALESCE(json_extract(i.data,'$.${key}'),'')=''`); else { clauses.push(`json_extract(i.data,'$.${key}')=?`); args.push(params.get(key)); } }
  if (params.get('origin_country')) { clauses.push("EXISTS(SELECT 1 FROM json_each(c.data,'$.origin_countries') WHERE value=?)"); args.push(params.get('origin_country')); }
  if (params.get('q')) { clauses.push('(c.name LIKE ? OR i.id LIKE ? OR i.data LIKE ?)'); args.push(...Array(3).fill(`%${params.get('q')}%`)); }
  // Drive targeted reads from at most50 IDs; a status index can otherwise turn IN into a public-row scan.
  const imageFrom = selectedIds ? `FROM (VALUES ${selectedIds.map(() => '(?)').join(',')}) requested CROSS JOIN images i ON i.id=requested.column1` : 'FROM images i';
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', from = `${imageFrom}${params.get('q') || params.get('origin_country') ? ' JOIN classes c ON c.id=i.class_id' : ''}`;
  const total = (await first(env, `SELECT COUNT(*) n ${from} ${where}`, args)).n;
  const records = await rows(env, `SELECT i.*, (SELECT json_group_object(a.kind,json_object('key',a.object_key,'sha256',a.sha256,'bytes',a.bytes,'content_type',a.content_type)) FROM assets a WHERE a.image_id=i.id) asset_data ${from} ${where} ORDER BY i.updated_at DESC,i.id LIMIT ? OFFSET ?`, [...args, limit, offset]);
  const items = records.map(row => { const assets = JSON.parse(row.asset_data); for (const [kind, asset] of Object.entries(assets)) asset.download_url = `${BASE}/images/${row.id}/assets/${kind}`; return { ...JSON.parse(row.data), id: row.id, status: row.status, revision: row.revision, updated_at: row.updated_at, assets }; });
  return json({ items, total, limit, offset });
}
async function putImage(request, env, role, id) {
  allowed(role, ['owner', 'collector']); const input = await body(request), data = imageRecord(input, id);
  requireValue(await first(env, 'SELECT id FROM classes WHERE id=?', [data.class_id]), 'Unknown class.', 'unknown_class', 422);
  const row = await first(env, 'SELECT * FROM images WHERE id=?', [id]);
  if (row) {
    revision(request, row); requireValue(role === 'owner' || ['candidate', 'held'].includes(row.status), 'Collector cannot modify reviewed images.', 'forbidden', 403);
    requireValue(!row.sha256 || data.sha256 === row.sha256, 'Original identity cannot change. Create a new image.', 'identity_conflict', 409);
    const previousJob = JSON.parse(row.data).collection_job_id; if (previousJob) data.collection_job_id = previousJob;
    await changed(env, env.DB.prepare("UPDATE images SET class_id=?,domain=?,status='candidate',rights_tier=?,public_delivery=?,sha256=?,pixel_sha256=?,phash=?,duplicate_group=?,event_group=?,data=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?").bind(data.class_id, data.domain, data.rights.tier, +data.rights.redistribution_allowed, data.sha256 ?? null, data.pixel_sha256 ?? null, data.phash ?? null, data.duplicate_group ?? null, data.event_group ?? null, JSON.stringify(data), now(), id, row.revision), role, 'image.update', id);
    const previous = JSON.parse(row.data); if (JSON.stringify(previous.target_bbox) !== JSON.stringify(data.target_bbox)) await env.DB.prepare("DELETE FROM assets WHERE image_id=? AND kind='crop'").bind(id).run();
    await invalidateReleases(env, id, 'Source image metadata changed; reverification required.');
  } else {
    await budgetAvailable(env);
    await changed(env, env.DB.prepare("INSERT OR IGNORE INTO images(id,class_id,domain,status,rights_tier,public_delivery,sha256,pixel_sha256,phash,duplicate_group,event_group,data,updated_at) VALUES(?,?,?,'candidate',?,?,?,?,?,?,?,?,?)").bind(id, data.class_id, data.domain, data.rights.tier, +data.rights.redistribution_allowed, data.sha256 ?? null, data.pixel_sha256 ?? null, data.phash ?? null, data.duplicate_group ?? null, data.event_group ?? null, JSON.stringify(data), now()), role, 'image.create', id);
  }
  return json(await image(env, id), row ? 200 : 201);
}
async function patchImage(request, env, role, id) {
  allowed(role, ['owner']); const record = await image(env, id); requireValue(record, 'Image not found.', 'not_found', 404); revision(request, record);
  const input = await body(request); text(input.reason); requireValue(input.changes && typeof input.changes === 'object' && !Array.isArray(input.changes), 'changes object required.');
  const keys = ['variant', 'operator_country', 'hull', 'captured_at', 'viewpoint', 'condition', 'target_bbox', 'class_id', 'status'];
  requireValue(Object.keys(input.changes).length > 0 && Object.keys(input.changes).every(key => keys.includes(key)), 'Unsupported edit field.');
  if ('status' in input.changes) requireValue(['candidate', 'held', 'rejected', 'quarantined'].includes(input.changes.status), 'Use verification endpoint to accept.');
  const data = imageRecord({ ...record, ...input.changes }, id); data.status = input.changes.status ?? 'candidate'; delete data.verification;
  if (record.collection_job_id) data.collection_job_id = record.collection_job_id;
  requireValue(await first(env, 'SELECT id FROM classes WHERE id=?', [data.class_id]), 'Unknown class.', 'unknown_class', 422);
  await changed(env, env.DB.prepare('UPDATE images SET class_id=?,status=?,data=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(data.class_id, data.status, JSON.stringify(data), now(), id, record.revision), role, 'image.correct', id, input.reason);
  if ('target_bbox' in input.changes) await env.DB.prepare("DELETE FROM assets WHERE image_id=? AND kind='crop'").bind(id).run();
  await invalidateReleases(env, id, input.reason); return json(await image(env, id));
}
export async function budget(env) {
  const current = month(), declared = await first(env, 'SELECT * FROM budgets WHERE month=?', [current]) ?? { external_spend_usd: 0, projected_other_usd: 0 };
  const stored = (await first(env, 'SELECT COALESCE(SUM(bytes),0) n FROM object_inventory')).n;
  const jobs = await first(env, "SELECT COALESCE(SUM(cost_usd),0) costs, COALESCE(SUM(CASE WHEN status IN ('running','paused') THEN MAX(0,estimated_cost_usd-cost_usd) ELSE 0 END),0) reserved, COALESCE(SUM(CASE WHEN status IN ('running','paused') THEN MAX(0,max_bytes-used_bytes) ELSE 0 END),0) reserved_bytes FROM jobs WHERE month=?", [current]);
  const storage_usd = stored / 1e9 * 0.015, reserved_storage_usd = jobs.reserved_bytes / 1e9 * 0.015, projected = Number(env.BASE_MONTHLY_USD ?? 5) + storage_usd + reserved_storage_usd + declared.external_spend_usd + declared.projected_other_usd + jobs.costs + jobs.reserved;
  return { month: current, monthly_limit_usd: Number(env.MONTHLY_LIMIT_USD ?? 50), collection_stop_usd: Number(env.COLLECTION_STOP_USD ?? 40), projected_month_usd: Math.round(projected * 10000) / 10000, stored_bytes: stored, storage_projection_usd: storage_usd, reserved_storage_usd, ...declared, declared_job_cost_usd: jobs.costs, reserved_job_cost_usd: jobs.reserved, collection_paused: projected >= Number(env.COLLECTION_STOP_USD ?? 40), billing_notice: 'Projection includes declared external spend; not a provider-enforced billing cap.' };
}
async function budgetAvailable(env, added = 0) { const report = await budget(env); requireValue(report.projected_month_usd + added < report.collection_stop_usd, 'Collection paused at projected budget threshold.', 'budget_exhausted', 429); return report; }
const projectionSQL = `(COALESCE((SELECT external_spend_usd+projected_other_usd FROM budgets WHERE month=strftime('%Y-%m','now')),0) + COALESCE((SELECT SUM(cost_usd+CASE WHEN status IN ('running','paused') THEN MAX(0,estimated_cost_usd-cost_usd)+(MAX(0,max_bytes-used_bytes)/1000000000.0*0.015) ELSE 0 END) FROM jobs WHERE month=strftime('%Y-%m','now')),0) + COALESCE((SELECT SUM(bytes) FROM object_inventory),0)/1000000000.0*0.015)`;
async function jobCreate(request, env, role) {
  allowed(role, ['owner', 'collector']); const input = await body(request); identifier(input.id); integer(input.max_requests ?? 1000, 1, 10000); integer(input.max_bytes ?? 1073741824, 1, 10 * 1073741824); finite(input.estimated_cost_usd ?? 0, 0, 35);
  await budgetAvailable(env, input.estimated_cost_usd ?? 0);
  requireValue(!await first(env, 'SELECT id FROM jobs WHERE id=?', [input.id]), 'Job ID already exists.', 'conflict', 409);
  const additional = (input.estimated_cost_usd ?? 0) + (input.max_bytes ?? 1073741824) / 1e9 * 0.015;
  const result = await env.DB.prepare(`INSERT OR IGNORE INTO jobs(id,month,max_requests,max_bytes,estimated_cost_usd,data,created_at) SELECT ?,?,?,?,?,?,? WHERE ?+?+${projectionSQL}<?`).bind(input.id, month(), input.max_requests ?? 1000, input.max_bytes ?? 1073741824, input.estimated_cost_usd ?? 0, JSON.stringify({ classes: input.classes ?? [] }), now(), Number(env.BASE_MONTHLY_USD ?? 5), additional, Number(env.COLLECTION_STOP_USD ?? 40)).run();
  requireValue(result.meta.changes === 1, 'Budget reservation failed or job ID exists.', 'budget_exhausted', 429); return json(await first(env, 'SELECT * FROM jobs WHERE id=?', [input.id]), 201);
}
async function chargeJob(env, id, requests, bytes, cost = 0, status) {
  identifier(id); integer(requests, 0, 10000); integer(bytes, 0, 10 * 1073741824); finite(cost, 0, 50);
  requireValue(status == null || ['running', 'completed', 'failed', 'paused'].includes(status), 'Invalid job status.');
  const closing = requests === 0 && bytes === 0 && cost === 0 && ['completed', 'failed', 'paused'].includes(status);
  const result = await env.DB.prepare(`UPDATE jobs SET used_requests=used_requests+?,used_bytes=used_bytes+?,cost_usd=cost_usd+?,status=COALESCE(?,status) WHERE id=? AND month=? AND (status='running' OR (status='paused' AND ?='running')) AND used_requests+?<=max_requests AND used_bytes+?<=max_bytes AND (?=1 OR ?+?+${projectionSQL}<?)`).bind(requests, bytes, cost, status ?? null, id, month(), status ?? null, requests, bytes, +closing, Number(env.BASE_MONTHLY_USD ?? 5), cost, Number(env.COLLECTION_STOP_USD ?? 40)).run();
  requireValue(result.meta.changes === 1, 'Job unavailable, expired, paused, or quota exhausted.', 'job_limit', 429);
}
async function upload(request, env, role, id, kind) {
  allowed(role, ['owner', 'collector']); requireValue(['original', 'crop', 'preview'].includes(kind), 'Unknown asset kind.');
  const record = await image(env, id); requireValue(record, 'Image not found.', 'not_found', 404);
  requireValue(['candidate', 'held'].includes(record.status), 'Reviewed images must be reopened before uploading.', 'reviewed_image', 409);
  requireValue(record.rights.download_allowed === true && record.rights.evidence_url && record.rights.license, 'Document download permission before uploading.', 'rights_required', 422);
  url(record.rights.evidence_url);
  const sha = hash(request.headers.get('X-Content-SHA256')), length = Number(request.headers.get('Content-Length')), type = request.headers.get('Content-Type')?.split(';')[0];
  requireValue(request.headers.has('Content-Length'), 'Content-Length required.', 'length_required', 411); integer(length, 1, MAX_FILE); requireValue(MIME.has(type), 'Unsupported image media type.', 'unsupported_media', 415);
  if (kind === 'original') requireValue(sha === record.sha256, 'Original checksum must match record.', 'checksum_mismatch', 422);
  if (record.assets[kind]?.sha256 === sha) return json({ asset: record.assets[kind], revision: record.revision });
  await budgetAvailable(env, length / 1e9 * 0.015);
  const jobId = request.headers.get('X-Job-Id'); if (role === 'collector') requireValue(jobId, 'Collector upload requires X-Job-Id.');
  if (jobId) await chargeJob(env, jobId, 1, length);
  const key = `images/${kind}/${sha}`;
  const inspected = await inspectedStream(request.body, length, type);
  const q = record.quality;
  if (kind === 'original' && (!q || ![q.original_width, q.original_height].every((n, i) => n === inspected.dimensions[i]) && ![q.original_height, q.original_width].every((n, i) => n === inspected.dimensions[i]))) {
    await inspected.cancel(); await inspected.pumping.catch(() => {}); throw new Problem(422, 'dimension_mismatch', 'Native image dimensions do not match record metadata.');
  }
  if (kind === 'crop' && (!Array.isArray(record.target_bbox) || inspected.dimensions[0] !== record.target_bbox[2] || inspected.dimensions[1] !== record.target_bbox[3])) {
    await inspected.cancel(); await inspected.pumping.catch(() => {}); throw new Problem(422, 'crop_dimension_mismatch', 'Derived crop must retain the target box native dimensions.');
  }
  await env.DB.prepare("INSERT OR IGNORE INTO object_inventory(object_key,bytes,sha256,state,created_at) VALUES(?,?,?,'reserved',?)").bind(key, length, sha, now()).run();
  try { await Promise.all([env.ASSETS.put(key, inspected.stream, { sha256: sha, httpMetadata: { contentType: type }, customMetadata: { sha256: sha } }), inspected.pumping]); }
  catch { throw new Problem(422, 'upload_failed', 'Asset upload failed integrity validation.'); }
  const stored = await env.ASSETS.head(key); requireValue(stored?.size === length, 'Uploaded size mismatch.', 'size_mismatch', 422);
  await env.DB.prepare("UPDATE object_inventory SET state='stored' WHERE object_key=?").bind(key).run();
  const result = await env.DB.batch([
    env.DB.prepare("UPDATE images SET revision=revision+1,updated_at=?,data=CASE WHEN ?='original' AND ? IS NOT NULL THEN json_set(data,'$.collection_job_id',COALESCE(json_extract(data,'$.collection_job_id'),?)) ELSE data END WHERE id=? AND revision=? AND status IN ('candidate','held')").bind(now(), kind, jobId, jobId, id, record.revision),
    env.DB.prepare('INSERT INTO assets(image_id,kind,object_key,sha256,bytes,content_type) SELECT ?,?,?,?,?,? WHERE changes()=1 ON CONFLICT(image_id,kind) DO UPDATE SET object_key=excluded.object_key,sha256=excluded.sha256,bytes=excluded.bytes,content_type=excluded.content_type').bind(id, kind, key, sha, length, type),
    statementActivity(env, role, `asset.${kind}`, id),
  ]);
  requireValue(result[0].meta.changes === 1, 'Image changed during upload. Retry after reloading.', 'revision_conflict', 409);
  return json({ asset: { key, sha256: sha, bytes: length, content_type: type, download_url: `${BASE}/images/${id}/assets/${kind}` }, revision: record.revision + 1 }, 201);
}
async function verify(request, env, role, id) {
  allowed(role, ['owner', 'verifier']); const record = await image(env, id); requireValue(record, 'Image not found.', 'not_found', 404); revision(request, record);
  const input = await body(request), verification = input.verification;
  requireValue(verification && ['accept', 'hold', 'reject'].includes(verification.decision), 'Verification decision required.');
  let status = { accept: 'accepted', hold: 'held', reject: 'rejected' }[verification.decision];
  if (status === 'accepted') {
    const klass = await first(env, 'SELECT data FROM classes WHERE id=?', [record.class_id]); validateAcceptance(record, klass && JSON.parse(klass.data), record.assets, verification);
    const duplicate = await first(env, "SELECT id FROM images WHERE id!=? AND status='accepted' AND (sha256=? OR pixel_sha256=? OR duplicate_group=?)", [id, record.sha256, record.pixel_sha256, record.duplicate_group]);
    requireValue(!duplicate, 'Original/decoded pixels/duplicate group already accepted.', 'duplicate_image', 409);
    const similar = await rows(env, "SELECT id,phash FROM images WHERE id!=? AND status='accepted' AND phash IS NOT NULL", [id]);
    const matches = similar.filter(item => hamming(item.phash, record.phash) <= 6).slice(0, 20);
    requireValue(matches.length === 0 || (role === 'owner' && input.near_duplicate_override?.reason && Array.isArray(input.near_duplicate_override.reviewed_ids) && matches.every(item => input.near_duplicate_override.reviewed_ids.includes(item.id))), 'Near-duplicate review required.', 'near_duplicate_review', 409);
    if (matches.length) text(input.near_duplicate_override.reason);
  }
  const data = { ...record, verification: { ...verification, actor_role: role }, status }; delete data.assets; delete data.revision;
  if (input.near_duplicate_override && role === 'owner') data.near_duplicate_review = input.near_duplicate_override;
  try { await changed(env, env.DB.prepare('UPDATE images SET status=?,data=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(status, JSON.stringify(data), now(), id, record.revision), role, 'image.verify', id, input.reason ?? verification.decision); }
  catch (error) { if (String(error.message).includes('UNIQUE')) throw new Problem(409, 'duplicate_image', 'Duplicate accepted concurrently.'); throw error; }
  if (status !== 'accepted') await invalidateReleases(env, id, input.reason ?? 'Verification changed.');
  return json(await image(env, id));
}
export async function streamAsset(request, env, key, type, sha) {
  const partial = request.headers.has('Range');
  let object; try { object = await env.ASSETS.get(key, partial ? { range: request.headers } : {}); } catch { throw new Problem(416, 'invalid_range', 'Requested byte range is unavailable.'); }
  requireValue(object && 'body' in object, 'Asset unavailable.', 'not_found', 404);
  const headers = new Headers({ 'Content-Type': type, 'ETag': `"${sha}"`, 'X-Content-SHA256': sha, 'Accept-Ranges': 'bytes', 'Content-Length': String(object.range?.length ?? object.size) });
  if (partial && object.range) headers.set('Content-Range', `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
  return new Response(request.method === 'HEAD' ? null : object.body, { status: partial && object.range ? 206 : 200, headers });
}
async function sources(env, role, params) {
  const { limit, offset } = page(params), set = new Set();
  const classes = await rows(env, params.get('class_id') ? 'SELECT data FROM classes WHERE id=?' : 'SELECT data FROM classes', params.get('class_id') ? [params.get('class_id')] : []);
  for (const row of classes) for (const item of JSON.parse(row.data).service?.evidence ?? []) if (evidenceUrl(item)) set.add(evidenceUrl(item));
  const clauses = [], args = []; if (role === 'public') clauses.push("status='accepted' AND public_delivery=1"); if (params.get('class_id')) { clauses.push('class_id=?'); args.push(params.get('class_id')); }
  for (const row of await rows(env, `SELECT json_extract(data,'$.source.page_url') page_url,json_extract(data,'$.rights.evidence_url') evidence_url FROM images ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}`, args)) { if (row.page_url) set.add(row.page_url); if (row.evidence_url) set.add(row.evidence_url); }
  const urls = [...set].sort(); return json({ items: urls.slice(offset, offset + limit), total: urls.length, offset, limit });
}
async function dispatch(request, env, role) {
  const parsed = new URL(request.url), parts = parsed.pathname.slice(BASE.length).split('/').filter(Boolean).map(part => decodeURIComponent(part)), method = request.method;
  if (parts.length === 1 && parts[0] === 'openapi.json' && method === 'GET') return json(openapi);
  if (parts.length === 1 && parts[0] === 'health' && method === 'GET') { await first(env, 'SELECT COUNT(*) n FROM classes'); return json({ status: 'ok', schema_version: 1 }); }
  if (parts.length === 1 && parts[0] === 'session' && method === 'GET') { allowed(role, ['owner', 'collector', 'verifier', 'reader']); return json({ role }); }
  if (parts.length === 1 && parts[0] === 'stats' && method === 'GET') {
    const klass = await first(env, "SELECT COUNT(*) n,MAX(json_extract(data,'$.service.as_of')) snapshot_date FROM classes"), counts = await first(env, "SELECT SUM(CASE WHEN status='accepted' AND domain='camera' THEN 1 ELSE 0 END) approved_camera,SUM(CASE WHEN status='accepted' AND domain='satellite' THEN 1 ELSE 0 END) approved_satellite,SUM(CASE WHEN status IN ('candidate','held') THEN 1 ELSE 0 END) candidates FROM images");
    return json({ classes: klass.n, approved_camera: counts.approved_camera ?? 0, approved_satellite: counts.approved_satellite ?? 0, candidates: counts.candidates ?? 0, goal_per_class: 400, snapshot_date: klass.snapshot_date });
  }
  if (parts[0] === 'classes') { if (parts.length === 1 && method === 'GET') return classList(env, parsed.searchParams); if (parts.length === 2 && method === 'PUT') return putClass(request, env, role, identifier(parts[1])); }
  if (parts[0] === 'images') {
    if (parts.length === 1 && method === 'GET') return imageList(env, role, parsed.searchParams);
    const id = identifier(parts[1]);
    if (parts.length === 2) {
      if (method === 'PUT') return putImage(request, env, role, id); if (method === 'PATCH') return patchImage(request, env, role, id);
      if (method === 'GET') { const record = await image(env, id); requireValue(record && visible(record, role), 'Image not found.', 'not_found', 404); return json(record); }
    }
    if (parts.length === 3 && parts[2] === 'verify' && method === 'POST') return verify(request, env, role, id);
    if (parts.length === 4 && parts[2] === 'assets') {
      if (method === 'PUT') return upload(request, env, role, id, parts[3]);
      if (['GET', 'HEAD'].includes(method)) { const record = await image(env, id), asset = record?.assets[parts[3]]; requireValue(record && visible(record, role) && asset, 'Asset not found.', 'not_found', 404); return streamAsset(request, env, asset.key, asset.content_type, asset.sha256); }
    }
  }
  if (parts.length === 1 && parts[0] === 'sources' && method === 'GET') return sources(env, role, parsed.searchParams);
  if (parts[0] === 'budget' && parts.length === 1) {
    if (method === 'GET') { allowed(role, ['owner', 'collector', 'verifier', 'reader']); return json(await budget(env)); }
    if (method === 'PUT') { allowed(role, ['owner']); const input = await body(request); requireValue(input.month === month(), 'Only the current month can be set.'); finite(input.external_spend_usd, 0, 100000); finite(input.projected_other_usd, 0, 100000); await env.DB.prepare('INSERT INTO budgets(month,external_spend_usd,projected_other_usd) VALUES(?,?,?) ON CONFLICT(month) DO UPDATE SET external_spend_usd=excluded.external_spend_usd,projected_other_usd=excluded.projected_other_usd').bind(input.month, input.external_spend_usd, input.projected_other_usd).run(); await activity(env, role, 'budget.update', month()); return json(await budget(env)); }
  }
  if (parts[0] === 'jobs') {
    if (parts.length === 1 && method === 'POST') return jobCreate(request, env, role);
    if (parts.length === 1 && method === 'GET') { allowed(role, ['owner', 'collector', 'verifier', 'reader']); const { limit, offset } = page(parsed.searchParams); return json({ items: await rows(env, 'SELECT * FROM jobs ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]), total: (await first(env, 'SELECT COUNT(*) n FROM jobs')).n, limit, offset }); }
    if (parts.length === 2 && method === 'PATCH') { allowed(role, ['owner', 'collector']); const input = await body(request); await chargeJob(env, identifier(parts[1]), input.requests_delta ?? 0, input.bytes_delta ?? 0, input.cost_delta_usd ?? 0, input.status); return json(await first(env, 'SELECT * FROM jobs WHERE id=?', [parts[1]])); }
  }
  if (parts[0] === 'releases') {
    if (parts.length === 1 && method === 'POST') return createRelease(request, env, role);
    if (parts.length === 1 && method === 'GET') { const { limit, offset } = page(parsed.searchParams), where = role === 'public' ? 'WHERE public_delivery=1' : ''; return json({ items: (await rows(env, `SELECT * FROM releases ${where} ORDER BY created_at DESC,id LIMIT ? OFFSET ?`, [limit, offset])).map(row => ({ ...JSON.parse(row.data), status: row.status })), total: (await first(env, `SELECT COUNT(*) n FROM releases ${where}`)).n, offset, limit }); }
    const id = identifier(parts[1]);
    if (parts.length === 2 && method === 'GET') return json(await getRelease(env, role, id));
    if (parts.length === 4 && parts[2] === 'files' && ['GET', 'HEAD'].includes(method)) return releaseFile(request, env, role, id, parts[3]);
    if (parts.length === 3 && parts[2] === 'audits' && method === 'POST') return auditRelease(request, env, role, id);
    if (parts.length === 3 && parts[2] === 'withdraw' && method === 'POST') return withdrawRelease(request, env, role, id);
  }
  throw new Problem(404, 'not_found', 'Endpoint not found.');
}
export function d1DailyLimit(error, at = new Date()) {
  const seen = new Set(); let current = error;
  while (current && !seen.has(current) && seen.size < 5) {
    seen.add(current);
    const message = typeof current.message === 'string' ? current.message : '';
    if (/\bD1(?:_ERROR)?\b/i.test(message) && /daily (?:row )?(?:read|write)s? limit/i.test(message) && /exceed/i.test(message)) {
      const retryAt = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + 1));
      return { retry_at: retryAt.toISOString(), retry_after: Math.max(1, Math.ceil((retryAt - at) / 1000)) };
    }
    current = current.cause;
  }
  return null;
}
export default {
  async fetch(request, env) {
    let response;
    try {
      const parsed = new URL(request.url); requireValue(parsed.pathname === BASE || parsed.pathname.startsWith(`${BASE}/`), 'Endpoint not found.', 'not_found', 404);
      const origin = request.headers.get('Origin'), permitted = (env.ALLOWED_ORIGINS ?? 'https://boomerrawlings.com').split(',').map(x => x.trim());
      requireValue(!origin || permitted.includes(origin), 'Origin not allowed.', 'forbidden_origin', 403);
      if (request.method === 'OPTIONS') response = new Response(null, { status: 204, headers: { 'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Authorization,Content-Type,If-Match,X-Content-SHA256,X-Job-Id,Range', 'Access-Control-Max-Age': '600' } });
      else response = await dispatch(request, env, await roleFor(request, env));
      if (origin && permitted.includes(origin)) response.headers.set('Access-Control-Allow-Origin', origin);
    } catch (error) {
      if (error instanceof Problem) response = json({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }, error.status);
      else {
        const quota = d1DailyLimit(error);
        if (quota) {
          response = json({ error: { code: 'provider_daily_limit', message: 'Database daily allowance exhausted. Collection is paused until the provider resets or the owner upgrades the plan.', retry_at: quota.retry_at } }, 503);
          response.headers.set('Retry-After', String(quota.retry_after));
        } else { console.error(JSON.stringify({ event: 'request_failed', name: error?.name ?? 'Error' })); response = json({ error: { code: 'internal_error', message: 'Request failed. Retry or contact the collection owner.' } }, 500); }
      }
    }
    response.headers.set('Cache-Control', 'no-store'); response.headers.set('X-Content-Type-Options', 'nosniff'); response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, noimageindex'); response.headers.set('Referrer-Policy', 'no-referrer'); response.headers.set('Vary', 'Origin, Authorization'); response.headers.set('Access-Control-Expose-Headers', 'ETag, X-Content-SHA256, Content-Length, Content-Range, Retry-After');
    return response;
  },
};
