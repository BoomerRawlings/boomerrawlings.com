export const BASE = '/subs/api/v1';
export const MAX_FILE = 64 * 1024 * 1024;
export const MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/tiff']);
export class Problem extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; }
}
export function requireValue(test, message, code = 'invalid_request', status = 400) { if (!test) throw new Problem(status, code, message); }
export function identifier(value) { requireValue(typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,95}$/.test(value), 'Invalid identifier.'); return value; }
export function text(value, max = 2000) { requireValue(typeof value === 'string' && value.trim().length > 0 && value.length <= max, 'A nonempty bounded string is required.'); return value.trim(); }
export function url(value) { requireValue(typeof value === 'string' && value.length <= 4096, 'A bounded HTTPS evidence URL is required.'); let parsed; try { parsed = new URL(value); } catch { throw new Problem(400, 'invalid_url', 'An HTTPS evidence URL is required.'); } requireValue(parsed.protocol === 'https:' && !parsed.username && !parsed.password, 'An HTTPS evidence URL is required.'); requireValue(![...parsed.searchParams.keys()].some(key => /^(token|access_token|api[_-]?key|key|auth|authorization|signature|sig|secret|password|x-amz-.+|x-goog-.+)$/i.test(key)), 'Credential-bearing source URLs cannot be published. Use a stable source page URL.'); return value; }
export function evidenceUrl(value) { return typeof value === 'string' ? value : value?.url; }
export function evidence(value) { requireValue(Array.isArray(value) && value.length > 0 && value.length <= 100, 'Evidence URLs are required.'); value.forEach(item => url(evidenceUrl(item))); return value; }
export function hash(value) { requireValue(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value), 'A lowercase SHA-256 hash is required.'); return value; }
export function finite(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) { requireValue(Number.isFinite(value) && value >= minimum && value <= maximum, 'A bounded nonnegative number is required.'); return value; }
export function integer(value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) { finite(value, minimum, maximum); requireValue(Number.isInteger(value), 'An integer is required.'); return value; }
export function classRecord(input, id) {
  requireValue(input && typeof input === 'object', 'A class record is required.');
  const result = { ...input, id: identifier(id), name: text(input.name, 200) };
  for (const key of ['aliases', 'variants', 'origin_countries', 'operators', 'historical_types']) {
    requireValue(Array.isArray(input[key] ?? []), `${key} must be an array.`); result[key] = [...new Set((input[key] ?? []).map(x => text(x, 200)))];
  }
  requireValue(result.origin_countries.length > 0, 'Design origin required.');
  requireValue(input.service && /^\d{4}-\d{2}-\d{2}$/.test(input.service.as_of), 'A dated service snapshot is required.');
  requireValue(['commissioned', 'uncertain', 'retired', 'construction'].includes(input.service.status), 'Invalid service status.');
  if (input.service.status === 'commissioned') evidence(input.service.evidence);
  result.pilot = input.pilot === true; delete result.counts; delete result.revision; return result;
}
export function imageRecord(input, id) {
  requireValue(input && typeof input === 'object', 'An image record is required.');
  const result = { ...input, id: identifier(id), class_id: identifier(input.class_id) };
  requireValue(['camera', 'satellite'].includes(input.domain), 'Invalid image domain.');
  requireValue(input.source && input.rights, 'Source and rights metadata are required.');
  url(input.source.page_url); if (input.source.original_url) url(input.source.original_url);
  requireValue(['commercial', 'research'].includes(input.rights.tier), 'Invalid rights tier.');
  if (input.rights.evidence_url) url(input.rights.evidence_url);
  for (const key of ['download_allowed', 'training_allowed', 'redistribution_allowed']) requireValue(typeof input.rights[key] === 'boolean', `rights.${key} must be boolean.`);
  if (input.sha256) hash(input.sha256); if (input.pixel_sha256) hash(input.pixel_sha256);
  if (input.phash) requireValue(/^[a-f0-9]{16}$/.test(input.phash), 'phash must be 64-bit hexadecimal.');
  for (const key of ['duplicate_group', 'event_group']) if (input[key]) text(input[key], 200);
  for (const key of ['variant', 'operator_country', 'hull', 'captured_at', 'viewpoint', 'condition']) if (input[key] != null) text(input[key], 500);
  delete result.assets; delete result.revision; delete result.verification; delete result.collection_job_id; result.status = 'candidate'; return result;
}
export function validateAcceptance(record, klass, assets, verification) {
  const q = record.quality, r = record.rights, b = record.target_bbox;
  requireValue(klass?.service?.status === 'commissioned', 'Class must be in the commissioned snapshot.', 'ineligible', 422);
  evidence(klass.service.evidence);
  requireValue(r.download_allowed && r.training_allowed, 'Download and training permissions required.', 'ineligible', 422);
  text(r.license); text(r.attribution); url(r.evidence_url); url(record.source.original_url);
  requireValue(q && q.sharpness_ok === true && q.original_resolution === true && q.not_upscaled === true, 'Sharp original-resolution, non-upscaled imagery required.', 'quality_failed', 422);
  integer(q.original_width, 1, 100000); integer(q.original_height, 1, 100000);
  requireValue(Array.isArray(b) && b.length === 4, 'A target bounding box is required.', 'quality_failed', 422);
  b.forEach(v => finite(v)); requireValue(b[2] > 0 && b[3] > 0 && b[0] + b[2] <= q.original_width && b[1] + b[3] <= q.original_height, 'Target box lies outside original.', 'quality_failed', 422);
  finite(q.subject_length_px, 1, Math.max(b[2], b[3]));
  if (record.domain === 'camera') requireValue(Math.max(q.original_width, q.original_height) >= 1200 && q.subject_length_px >= 400, 'Camera original must be >=1200px long and subject >=400px.', 'quality_failed', 422);
  else requireValue(q.subject_length_px >= 200 && Number.isFinite(q.gsd_m_per_px) && q.gsd_m_per_px > 0 && q.gsd_m_per_px <= 0.5, 'Satellite subject must be >=200 native pixels and GSD <=0.5m.', 'quality_failed', 422);
  hash(record.sha256); hash(record.pixel_sha256); text(record.event_group, 200); text(record.duplicate_group, 200);
  requireValue(/^[a-f0-9]{16}$/.test(record.phash ?? ''), 'Perceptual hash required.', 'ineligible', 422);
  for (const kind of ['original', 'crop', 'preview']) requireValue(assets[kind] && assets[kind].bytes > 0, `${kind} upload is missing.`, 'missing_asset', 422);
  requireValue(assets.original.sha256 === record.sha256, 'Original checksum does not match metadata.', 'checksum_mismatch', 422);
  evidence(verification.class_evidence); text(verification.collector, 200); text(verification.verified_by, 200);
  requireValue(verification.collector.trim().toLocaleLowerCase('en') !== verification.verified_by.trim().toLocaleLowerCase('en'), 'Collector and verifier must be independent.', 'independent_review_required', 422);
  requireValue(Number.isFinite(Date.parse(verification.verified_at)), 'Verification timestamp required.');
}
export function hamming(a, b) { if (!/^[a-f0-9]{16}$/.test(a ?? '') || !/^[a-f0-9]{16}$/.test(b ?? '')) return 64; let n = BigInt(`0x${a}`) ^ BigInt(`0x${b}`), count = 0; while (n) { count++; n &= n - 1n; } return count; }
export function validateRelease(items, domain, rightsTier) {
  requireValue(items.length > 0 && items.length <= 50000, 'Release must contain 1–50000 images.');
  const classes = new Map(), seen = new Set(), groups = new Map(), duplicateGroups = new Set();
  for (const item of items) {
    requireValue(!seen.has(item.id), 'Repeated image in release.', 'duplicate_image', 422); seen.add(item.id);
    requireValue(item.status === 'accepted' && item.domain === domain && item.rights.tier === rightsTier && item.rights.training_allowed, 'Release image is not eligible for its domain/tier.', 'ineligible', 422);
    requireValue(['train', 'validation', 'test'].includes(item.split), 'Invalid split.');
    classes.set(item.class_id, (classes.get(item.class_id) ?? 0) + 1);
    requireValue(!duplicateGroups.has(item.duplicate_group), 'Duplicate group represented more than once.', 'duplicate_image', 422); duplicateGroups.add(item.duplicate_group);
    for (const group of [`event:${item.event_group}`, `duplicate:${item.duplicate_group}`]) {
      requireValue(!groups.has(group) || groups.get(group) === item.split, 'Related images cross dataset splits.', 'split_leakage', 422); groups.set(group, item.split);
    }
  }
  requireValue(classes.size >= 2, 'At least two eligible classes required.', 'insufficient_classes', 422);
  const counts = [...classes.values()];
  requireValue(counts.every(n => n === counts[0]), 'Release classes must be balanced.', 'unbalanced', 422);
  if (domain === 'camera') requireValue(counts[0] >= 100 && counts[0] <= 400, 'Camera releases require 100–400 images per class.', 'insufficient_images', 422);
  return classes;
}
