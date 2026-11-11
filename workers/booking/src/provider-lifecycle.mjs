const stageError = stage => Object.assign(new Error('Provider session cleanup unavailable'), { stage });
const notFound = failure => failure?.status === 404 || failure?.statusCode === 404
  || /\b(?:status|code|HTTP)\s*:?\s*404\b/i.test(failure?.message || '');

export async function providerSessionExists(binding, id) {
  let session;
  try { session = await binding.getSession(id); }
  catch (failure) { if (notFound(failure)) return false; throw stageError('cleanup_lookup'); }
  if (session === undefined) throw stageError('cleanup_lookup');
  return session !== null && session?.status !== 'closed';
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
