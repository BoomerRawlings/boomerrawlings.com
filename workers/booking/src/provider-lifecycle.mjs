import { failureDiagnostic } from './diagnostics.mjs';
import { bounded } from './timeout.mjs';
const stageError = (stage, cause, reason) => Object.assign(new Error('Provider session cleanup unavailable'), { stage,
  failureDiagnostic: { ...failureDiagnostic(cause || new Error(stage), 'provider_cleanup'), ...(reason ? { reason } : {}),
    ...([cause?.status, cause?.statusCode].find(value => Number.isInteger(value) && value >= 100 && value <= 599) ?
      { status: [cause?.status, cause?.statusCode].find(value => Number.isInteger(value) && value >= 100 && value <= 599) } : {}) } });
const notFound = failure => failure?.status === 404 || failure?.statusCode === 404
  || /\b(?:status|code|HTTP)\s*[:=]?\s*404\b/i.test(failure?.message || '');

export function sanitizedProviderMessage(failure) {
  return String(failure?.message || '').slice(0, 2000)
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[url]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
    .replace(/\b(token|secret|password|authorization|cookie|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/[A-Za-z0-9+/_=-]{24,}/g, '[token]')
    .replace(/[\r\n\t]+/g, ' ').slice(0, 240);
}

export async function providerSessionExists(binding, id) {
  let session;
  try { session = await binding.getSession(id); }
  catch (failure) {
    if (notFound(failure)) return false;
    throw stageError('cleanup_lookup', failure, 'lookup_throw');
  }
  if (session === null) return false;
  if (!session || typeof session !== 'object' || Array.isArray(session)) throw stageError('cleanup_lookup', undefined, 'response_type');
  if (typeof session.sessionId !== 'string') throw stageError('cleanup_lookup', undefined, 'missing_id');
  if (session.sessionId !== id) throw stageError('cleanup_lookup', undefined, 'mismatched_id');
  // getSession returns BrowserRunSession, including ended-session history.
  // Only closeSession's result has `status`; connectionEndTime does not end
  // the browser and must never release its lease.
  if (session.endTime === undefined || session.endTime === 0) return true;
  if (typeof session.endTime !== 'number' || !Number.isFinite(session.endTime) || session.endTime < 0) throw stageError('cleanup_lookup', undefined, 'invalid_endtime');
  return false;
}

// closeSession is asynchronous and may reject an already-closed ID. A close
// error alone neither proves liveness nor absence: independently verify it.
export async function closeProviderSession(binding, id, { closeLocal, localTimeoutMs = 2000, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  if (closeLocal) { try { await bounded(Promise.resolve().then(closeLocal), localTimeoutMs, 'local_close_timeout'); } catch { /* Verify via provider below. */ } }
  if (!id) return;
  try { await binding.closeSession(id); } catch { /* A subsequent lookup is authoritative. */ }
  for (let attempt = 0; attempt < 4; attempt++) {
    if (!await providerSessionExists(binding, id)) return;
    if (attempt < 3) await sleep(300);
  }
  throw stageError('cleanup_pending');
}
