import { failureDiagnostic } from './diagnostics.mjs';
const stageError = (stage, cause) => Object.assign(new Error('Provider session cleanup unavailable'), { stage,
  failureDiagnostic: failureDiagnostic(cause || new Error(stage), 'provider_cleanup') });
const notFound = failure => failure?.status === 404 || failure?.statusCode === 404
  || /\b(?:status|code|HTTP)\s*:?\s*404\b/i.test(failure?.message || '');

export async function providerSessionExists(binding, id) {
  let session;
  try { session = await binding.getSession(id); }
  catch (failure) { if (notFound(failure)) return false; throw stageError('cleanup_lookup', failure); }
  if (session === null) return false;
  if (!session || typeof session !== 'object' || Array.isArray(session) || session.sessionId !== id) throw stageError('cleanup_lookup');
  // getSession returns BrowserRunSession, including ended-session history.
  // Only closeSession's result has `status`; connectionEndTime does not end
  // the browser and must never release its lease.
  if (session.endTime === undefined || session.endTime === 0) return true;
  if (typeof session.endTime !== 'number' || !Number.isFinite(session.endTime) || session.endTime < 0) throw stageError('cleanup_lookup');
  return false;
}

// closeSession is asynchronous and may reject an already-closed ID. A close
// error alone neither proves liveness nor absence: independently verify it.
export async function closeProviderSession(binding, id, { closeLocal, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  if (closeLocal) { try { await closeLocal(); } catch { /* Verify via provider below. */ } }
  if (!id) return;
  try { await binding.closeSession(id); } catch { /* A subsequent lookup is authoritative. */ }
  for (let attempt = 0; attempt < 4; attempt++) {
    if (!await providerSessionExists(binding, id)) return;
    if (attempt < 3) await sleep(300);
  }
  throw stageError('cleanup_pending');
}
