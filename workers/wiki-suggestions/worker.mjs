const origin = 'https://boomerrawlings.com';
const kinds = new Set(['suggestion', 'revision', 'page', 'topic']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const reply = (value, status = 200) => Response.json(value, {status, headers: {'Cache-Control': 'no-store'}});

async function smallJson(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json') || !request.body) throw Error('Invalid request');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let length = 0, text = '';
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 8192) { await reader.cancel(); throw Error('Request too large'); }
    text += decoder.decode(value, {stream:true});
  }
  return JSON.parse(text + decoder.decode());
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    try {
      if (path === '/wiki/api/suggestions/review') {
        if (!env.REVIEW_KEY || request.headers.get('Authorization') !== 'Bearer ' + env.REVIEW_KEY) return reply({error:'Not found.'}, 404);
        if (request.method === 'GET') {
          const {results} = await env.DB.prepare('SELECT id,kind,subject,idea,submitted_at AS submittedAt FROM suggestions WHERE reviewed_at IS NULL ORDER BY submitted_at,id').all();
          return reply({suggestions:results});
        }
        if (request.method === 'POST') {
          const payload = await smallJson(request).catch(() => null);
          if (!Array.isArray(payload?.ids) || payload.ids.length < 1 || payload.ids.length > 3 || !payload.ids.every(id => typeof id === 'string' && uuid.test(id))) return reply({error:'Invalid review receipt.'}, 400);
          const at = new Date().toISOString();
          await env.DB.batch(payload.ids.map(id => env.DB.prepare('UPDATE suggestions SET reviewed_at = COALESCE(reviewed_at, ?) WHERE id = ?').bind(at,id)));
          return reply({ok:true});
        }
      }
      if (path !== '/wiki/api/suggestions' || request.method !== 'POST') return reply({error:'Not found.'}, 404);
      if (request.headers.get('Origin') !== origin) return reply({error:'Use the wiki suggestion form.'}, 403);
      const payload = await smallJson(request).catch(() => null);
      const {id, kind, subject: rawSubject, idea: rawIdea, website} = payload ?? {};
      const subject = typeof rawSubject === 'string' ? rawSubject.trim() : '';
      const idea = typeof rawIdea === 'string' ? rawIdea.trim() : '';
      if (typeof id !== 'string' || !uuid.test(id) || !kinds.has(kind) || website || subject.length < 1 || subject.length > 100 || idea.length < 10 || idea.length > 800) return reply({error:'Choose a type and enter a subject and an idea of 10–800 characters.'}, 400);
      const result = await env.DB.prepare(
        'INSERT OR IGNORE INTO suggestions (id,kind,subject,idea,submitted_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM suggestions WHERE reviewed_at IS NULL) < 3'
      ).bind(id,kind,subject,idea,new Date().toISOString()).run();
      if (!result.meta.changes) {
        const existing = await env.DB.prepare('SELECT id FROM suggestions WHERE id = ? AND kind = ? AND subject = ? AND idea = ?').bind(id,kind,subject,idea).first();
        if (!existing) return reply({error:'The next turn’s suggestion queue is full. Please try again after it runs.'}, 429);
      }
      return reply({ok:true, id}, 202);
    } catch {
      return reply({error:'The suggestion queue is temporarily unavailable. Please try again.'}, 503);
    }
  }
};
