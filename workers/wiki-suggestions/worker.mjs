const origin = 'https://boomerrawlings.com';
const kinds = new Set(['suggestion', 'revision', 'page', 'topic']);
const editorId = /^[a-z0-9][a-z0-9-]{0,39}$/;
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
          const {results} = await env.DB.prepare('SELECT id,kind,subject,idea,preferred_editor AS preferredEditor,submitted_at AS submittedAt FROM suggestions WHERE reviewed_at IS NULL ORDER BY submitted_at,id').all();
          return reply({suggestions:results});
        }
        if (request.method === 'POST') {
          const payload = await smallJson(request).catch(() => null);
          const reviews = payload?.reviews;
          if (!Array.isArray(reviews) || reviews.length < 1 || reviews.length > 3 ||
              !reviews.every(item => typeof item?.id === 'string' && uuid.test(item.id) &&
                ['adopted', 'rejected'].includes(item.resolution) &&
                (item.resolution === 'adopted' || (typeof item.note === 'string' && item.note.trim() && item.note.length <= 300)))) {
            return reply({error:'Invalid review receipt.'}, 400);
          }
          const at = new Date().toISOString();
          await env.DB.batch(reviews.map(item => env.DB.prepare(
            'UPDATE suggestions SET reviewed_at = ?, resolution = ?, rejection_note = ? WHERE id = ? AND reviewed_at IS NULL'
          ).bind(at, item.resolution, item.resolution === 'rejected' ? item.note.trim() : null, item.id)));
          return reply({ok:true});
        }
      }
      if (path === '/wiki/api/suggestions' && request.method === 'GET') {
        const {results} = await env.DB.prepare(
          "SELECT id,kind,subject,idea,preferred_editor AS preferredEditor,submitted_at AS submittedAt,COALESCE(resolution,'queued') AS status,rejection_note AS rejectionNote FROM suggestions WHERE visible = 1 ORDER BY reviewed_at IS NOT NULL,submitted_at DESC,id LIMIT 30"
        ).all();
        return reply({suggestions:results});
      }
      if (path !== '/wiki/api/suggestions' || request.method !== 'POST') return reply({error:'Not found.'}, 404);
      if (request.headers.get('Origin') !== origin) return reply({error:'Use the wiki suggestion form.'}, 403);
      const payload = await smallJson(request).catch(() => null);
      const {id, kind, subject: rawSubject, idea: rawIdea, website, preferredEditor = '', publishToQueue = false} = payload ?? {};
      const subject = typeof rawSubject === 'string' ? rawSubject.trim() : '';
      const idea = typeof rawIdea === 'string' ? rawIdea.trim() : '';
      if (typeof id !== 'string' || !uuid.test(id) || !kinds.has(kind) || website || subject.length < 1 || subject.length > 100 || idea.length < 10 || idea.length > 800) return reply({error:'Choose a type and enter a subject and an idea of 10–800 characters.'}, 400);
      if (typeof preferredEditor !== 'string' || (preferredEditor && !editorId.test(preferredEditor))) return reply({error:'Choose an editor or leave the preference blank.'}, 400);
      const result = await env.DB.prepare(
        'INSERT OR IGNORE INTO suggestions (id,kind,subject,idea,submitted_at,preferred_editor,visible) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM suggestions WHERE reviewed_at IS NULL) < 3'
      ).bind(id,kind,subject,idea,new Date().toISOString(),preferredEditor,publishToQueue === true ? 1 : 0).run();
      if (!result.meta.changes) {
        const existing = await env.DB.prepare('SELECT id FROM suggestions WHERE id = ? AND kind = ? AND subject = ? AND idea = ? AND preferred_editor = ?').bind(id,kind,subject,idea,preferredEditor).first();
        if (!existing) return reply({error:'The next turn’s suggestion queue is full. Please try again after it runs.'}, 429);
      }
      return reply({ok:true, id}, 202);
    } catch {
      return reply({error:'The suggestion queue is temporarily unavailable. Please try again.'}, 503);
    }
  }
};
