const safeId = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,160}$/;
const fold = value => String(value || '').normalize('NFKC').toLocaleLowerCase('en');
export class Repository {
  constructor(read) { this.read = read; }
  async json(path) { return JSON.parse(await (await this.read(path)).text()); }
  async corpus() { return this.json('.private/corpus.json'); }
  async catalog() { const content = await this.json('.private/transcripts.json'); return Array.isArray(content) ? content : content.records || []; }
  async transcript(id) {
    if (!safeId.test(id)) return null;
    const row = (await this.catalog()).find(x => x.id === id);
    if (!row) return null;
    if (!row.documentFile) return row;
    if (!safeId.test(row.documentFile)) throw new Error('Invalid transcript document');
    return { ...row, ...await this.json(`.private/transcripts/${row.documentFile}`) };
  }
  async search(params) {
    const query = (params.get('query') || params.get('q') || '').slice(0,300).trim();
    const tokens = fold(query).split(/\s+/).filter(Boolean);
    const speaker = params.get('speaker') || '';
    const topic = params.get('topic') || '';
    const source = params.get('source') || '';
    const from = params.get('from') || '';
    const to = params.get('to') || '';
    const catalog = await this.catalog();
    const sources = (await this.corpus()).sources;
    const sourceTitles = new Map(sources.map(s => [s.id,s.title]));
    const matches = [];
    for (const record of catalog) {
      if (speaker && !record.speakers?.includes(speaker)) continue;
      if (topic && !record.topics?.includes(topic)) continue;
      if (source && record.sourceId !== source) continue;
      if (from && (!record.date || record.date.slice(0,10) < from)) continue;
      if (to && (!record.date || record.date.slice(0,10) > to)) continue;
      const metaText = fold([record.title, record.date, sourceTitles.get(record.sourceId), ...record.speakers || [], ...record.topics || []].join(' '));
      let hit = null;
      if (tokens.length && !tokens.every(t => metaText.includes(t))) {
        const doc = await this.transcript(record.id);
        hit = doc.turns?.find(turn => tokens.every(t => fold(`${metaText} ${turn.speaker} ${turn.text} ${turn.readingText || ''}`).includes(t)));
        if (!hit) continue;
      }
      const { turns, originalText, documentFile, ...metadata } = record;
      matches.push({ ...metadata, sourceTitle:sourceTitles.get(record.sourceId) || '', ...(hit ? { match:{turnId:hit.id,startSeconds:hit.startSeconds,text:hit.text.slice(0,220)} } : {}) });
    }
    const sort = params.get('sort') || 'date-desc';
    matches.sort((a,b) => {
      if (sort === 'title' || sort === 'title-asc') return a.title.localeCompare(b.title);
      if (sort === 'speaker') return (a.speakers?.[0] || '').localeCompare(b.speakers?.[0] || '');
      if (sort === 'source') return a.sourceTitle.localeCompare(b.sourceTitle);
      return (sort === 'date-asc' || sort === 'oldest' ? 1 : -1) * String(a.date || '').localeCompare(String(b.date || ''));
    });
    const pageSize = Math.max(1,Math.min(50,parseInt(params.get('pageSize') || '20',10) || 20));
    const pageCount = Math.max(1,Math.ceil(matches.length / pageSize));
    const page = Math.max(1,Math.min(pageCount,parseInt(params.get('page') || '1',10) || 1));
    return { items:matches.slice((page-1)*pageSize,page*pageSize),total:matches.length,page,pageSize,pageCount,query,
      speakers:[...new Set(catalog.flatMap(r=>r.speakers || []))].sort(),topics:[...new Set(catalog.flatMap(r=>r.topics || []))].sort(),sources:sources.map(({id,title})=>({id,title})) };
  }
}
