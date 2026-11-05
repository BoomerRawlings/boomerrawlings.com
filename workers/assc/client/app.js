import {createProfileController} from './profiles.js';
import {configurePresentation} from './presentation.js';
let profileController;let rosterPage=0;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = { corpus: null, graph: null, timeline: null, transcriptPage: 1, transcriptRequest: 0, readerRequest: 0, reader: null, readerVersion: 'reading', readerFilter: '', readerTurnPage: 1, totalTranscripts: null, route: '', dialogReturnRoute: '', routeRequest: 0, lifecycleEpoch: 0, suspended: false, motionRoute: '' };
const pageNames = ['brief', 'bios', 'sources', 'connections', 'timeline', 'kf'];
const pendingFeatures = new Map(), activeFrames = new Set(), privateObservers = new Set();
// Direct loads use the deferred script in app.html. The authenticated gate imports
// this module after removing shell scripts, so enhancement also loads on that path.
// It is optional: a missing motion helper must never hold up the research desk.
if (!window.SiteMotion) void import('/ASSC/client/screen-motion.js').catch(() => {});
const asArray = value => Array.isArray(value) ? value : [];
const str = value => value == null ? '' : String(value);
const textOf = value => typeof value === 'string' ? value : value?.text || value?.summary || value?.description || '';
const formatDate = value => {
  if (!value) return 'Date not recorded';
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isNaN(parsed.valueOf()) ? str(value) : new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(parsed);
};
const number = value => new Intl.NumberFormat('en').format(Number(value) || 0);
const idPart = value => encodeURIComponent(str(value));
const humanize = value => str(value).replace(/[-_]/g, ' ');

function element(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function safeURL(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, location.href);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function sourceURL(source) { return safeURL(source?.url); }
function sourceById(id) { return state.corpus.sources.find(source => source.id === id); }
function personById(id) { return state.corpus.people.find(person => person.id === id); }
function link(url, label, attributes = {}) {
  const href = safeURL(url);
  return href ? element('a', { href, target: '_blank', rel: 'noopener noreferrer', ...attributes }, label) : element('span', attributes, label);
}

function portrait(person, className = '') {
  const wrapper = element('div', { class: `portrait ${className}` });
  const raw = typeof person.portrait === 'object' ? person.portrait?.url : person.portrait;
  let imageURL;
  try {
    const candidate = new URL(raw || '', location.href);
    if (raw && candidate.origin === location.origin && candidate.pathname.startsWith('/ASSC/')) imageURL = candidate.href;
  } catch { /* An unavailable image remains an honest initials marker. */ }
  const initials = str(person.name || person.label).split(/\s+/).filter(Boolean).slice(0, 2).map(name => name[0]).join('').toUpperCase();
  const fallback = () => { wrapper.replaceChildren(document.createTextNode(initials || '·')); wrapper.classList.add('initials'); wrapper.title = 'Portrait not yet available'; wrapper.setAttribute('aria-label', `${person.name || person.label}: portrait not yet available`); };
  if (imageURL) {
    const image = element('img', { src: imageURL, alt: '', loading: 'lazy', width: 100, height: 100 });
    image.addEventListener('error', fallback, { once: true });
    wrapper.append(image);
  } else fallback();
  return wrapper;
}

function emptyState(title, copy, glyph = '◌') {
  return element('div', { class: 'empty-state' }, element('div', { class: 'empty-glyph', 'aria-hidden': true }, glyph), element('h2', {}, title), element('p', {}, copy));
}

async function api(path) {
  const epoch = state.lifecycleEpoch;
  if (state.suspended) throw new DOMException('The page is no longer active.', 'AbortError');
  const response = await fetch(`/ASSC/api/${path}`, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
  if (state.suspended || epoch !== state.lifecycleEpoch) throw new DOMException('The page is no longer active.', 'AbortError');
  if (response.status === 401 || response.status === 403) { suspendPrivateView(); location.assign('/ASSC/'); throw new Error('The session ended.'); }
  if (!response.ok) throw new Error(`The record could not be loaded (${response.status}).`);
  const payload = await response.json();
  if (state.suspended || epoch !== state.lifecycleEpoch) throw new DOMException('The page is no longer active.', 'AbortError');
  return payload;
}

function afterActiveFrame(callback) {
  if (state.suspended) return;
  const epoch = state.lifecycleEpoch;
  const frame = requestAnimationFrame(() => {
    activeFrames.delete(frame);
    if (!state.suspended && epoch === state.lifecycleEpoch) callback();
  });
  activeFrames.add(frame);
}

function stopWatching(observer) {
  observer?.disconnect();
  privateObservers.delete(observer);
}

function watchPrivate(target, options, callback) {
  if (state.suspended || !target) return null;
  const observer = new MutationObserver(() => {
    if (!state.suspended && target.isConnected) callback(observer);
  });
  observer.observe(target, options);
  privateObservers.add(observer);
  return observer;
}

function toast(message) {
  if (state.suspended) return;
  const target = $('#toast'); target.textContent = message; target.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { target.hidden = true; }, 3500);
}

function evidenceLinks(ids) {
  const sources = [...new Set(asArray(ids))].map(sourceById).filter(Boolean);
  return sources.map(source => element('a', { class: 'detail-source', href: `#sources/index/${idPart(source.id)}` }, element('span', {}, source.title), element('span', { 'aria-hidden': true }, '↗')));
}

function transcriptLinks(refs) {
  return asArray(refs).map(ref => {
    const id = typeof ref === 'string' ? ref : ref.transcriptId || ref.id;
    if (!id) return null;
    const turn = ref.turnId || ref.turn;
    return element('a', { class: 'detail-source', href: `#sources/transcripts/${idPart(id)}${turn ? `/${idPart(turn)}` : ''}` }, element('span', {}, ref.label || ref.title || 'Open transcript passage'), '↗');
  }).filter(Boolean);
}

function renderBrief() {
  const { meta, people, sources, edges, events, questions } = state.corpus;
  const title = element('h1', {}, 'Research desk');
  const summary = meta.summary || 'An evolving research desk for the public record: people, organizations, statements, and the connections between them.';
  const stats = [
    { count: people.length, label: 'Names in the record', route: 'bios' },
    { count: sources.length, label: 'Source records', route: 'sources' },
    { count: edges.length, label: 'Mapped connections', route: 'connections' },
    { count: events.length, label: 'Dated moments', route: 'timeline' },
  ];
  const researchCopy = asArray(meta.brief || state.corpus.brief?.paragraphs);
  const notes = element('div', { class: 'editorial-body' });
  if (researchCopy.length) researchCopy.forEach(item => notes.append(element('p', {}, textOf(item))));
  else notes.append(element('p', {}, 'This is the working record behind a future long-form brief. The source index holds the material; the biographies and map make it navigable. Each connection opens onto its reason and supporting record.'), element('p', {}, 'The next layer is synthesis: tracing what changed, which accounts agree or conflict, and where a more specific explanation can be tested against primary material.'));
  const questionList = element('div');
  if (questions.length) questions.slice(0, 5).forEach((question, i) => {
    questionList.append(element('div', { class: 'question-item' }, element('span', { class: 'number' }, String(i + 1).padStart(2, '0')), element('div', {}, element('h3', {}, typeof question === 'string' ? question : question.title || question.question || textOf(question)), typeof question === 'object' && (question.summary || question.description || question.text) ? element('p', {}, question.summary || question.description || question.text) : null)));
  });
  else questionList.append(element('div', { class: 'question-item' }, element('span', { class: 'number' }, '01'), element('div', {}, element('h3', {}, 'What does each connection rest on?'), element('p', {}, 'Open a thread in the map to see its evidence and the question it leaves open.'))), element('div', { class: 'question-item' }, element('span', { class: 'number' }, '02'), element('div', {}, element('h3', {}, 'How does the sequence change the reading?'), element('p', {}, 'Place the public record in time, with each event beside its original source.'))));
  $('#brief').replaceChildren(
    element('div', { class: 'brief-topline' }, element('p', { class: 'eyebrow' }, '01 / THE BRIEF'), element('p', { class: 'edition' }, 'WORKING EDITION', meta.updated ? ` · ${formatDate(meta.updated)}` : '')),
    element('div', { class: 'brief-hero' }, title, element('div', { class: 'brief-deck' }, element('p', { class: 'brief-label' }, meta.title || 'AntiSnarkerSnarkerClub'), element('p', {}, summary), element('a', { class: 'button', href: '#connections' }, 'Enter the connections', element('span', { 'aria-hidden': true }, '↗')))),
    element('div', { class: 'brief-stats' }, stats.map(stat => element('a', { class: 'brief-stat', href: `#${stat.route}` }, element('strong', {}, number(stat.count)), element('span', {}, stat.label)))),
    readingPaths(),
    element('div', { class: 'brief-grid' }, element('article', {}, element('h2', { class: 'brief-section-title' }, element('span', {}, 'I.'), 'THE CURRENT EDITION'), element('p', { class: 'lead-note' }, meta.lead || 'The story begins with the record. The connections are where we look closer.'), notes, element('p', { class: 'editorial-status' }, element('span', {}, element('strong', {}, 'The synthesis is taking shape. '), 'This edition opens the research desk; the finished long-form brief will live here.'))), element('aside', {}, element('h2', { class: 'brief-section-title' }, element('span', {}, 'II.'), 'LINES OF INQUIRY'), questionList)),
    element('a', { class: 'brief-route', href: '#sources/transcripts' }, element('span', { class: 'route-symbol', 'aria-hidden': true }, '“'), element('div', { class: 'route-copy' }, element('h2', {}, 'Transcript library'), element('p', {}, 'A transcript library built around speakers, timestamps, and source passages.')), element('span', { class: 'route-arrow', 'aria-hidden': true }, '↗')),
  );
}

function readingPaths() {
  const paths = asArray(state.corpus.meta.readingPaths);
  const cards = paths.map((path, index) => {
    const steps = asArray(path.steps).filter(step => typeof step.href === 'string' && /^#(?:brief|bios|sources|connections|timeline)(?:\/[^\s]*)?$/.test(step.href) && (!step.source || sourceById(step.source)) && (!step.node || state.corpus.nodes.some(node => node.id === step.node)) && (!step.event || state.corpus.events.some(event => event.id === step.event)));
    if (!steps.length) return null;
    return element('article', { class: 'reading-path' }, element('div', { class: 'path-top' }, element('span', { class: 'path-number' }, String(index + 1).padStart(2, '0')), element('span', { class: 'path-glyph', 'aria-hidden': true }, index === 0 ? '⌁' : index === 1 ? '↗' : '¶')), element('h3', {}, path.title), element('p', {}, path.copy), element('ol', {}, steps.map(step => element('li', {}, element('a', { href: step.href }, step.label, element('span', { 'aria-hidden': true }, '↗'))))));
  }).filter(Boolean);
  return cards.length ? element('section', { class: 'reading-paths', 'aria-labelledby': 'reading-paths-title' }, element('div', { class: 'reading-paths-heading' }, element('h2', { id: 'reading-paths-title' }, 'Reading routes'), element('p', {}, 'READING PATHS / OVERVIEW → EVIDENCE → PASSAGE')), element('div', { class: 'reading-path-grid' }, cards)) : null;
}

function renderPeople() {
  let kind=document.querySelector('#people-kind');if(!kind){kind=element('select',{id:'people-kind','aria-label':'Directory records'},element('option',{value:'people'},'People & accounts'),element('option',{value:'organizations'},'Organizations'),element('option',{value:'all'},'All records'));const label=element('label',{class:'select-control'},element('span',{},'Show'),kind);document.querySelector('#bios .filter-bar').append(label);kind.addEventListener('change',()=>{rosterPage=0;renderPeople();});}
  const directoryRecords=new Map((state.profileIndex||[]).map(p=>[p.id,p]));
  const eligible=p=>kind.value==='all'||(kind.value==='organizations'?['organization','public committee record','community'].includes(directoryRecords.get(p.id)?.role):['public creator','public handle','public person','public account','account'].includes(directoryRecords.get(p.id)?.role));
  const query = $('#people-search').value.trim().toLowerCase();
  let people = state.corpus.people.filter(eligible).filter(person => [person.name, person.role, person.bio, ...asArray(person.aliases)].join(' ').toLowerCase().includes(query));
  people = [...people].sort((a, b) => $('#people-sort').value === 'sources' ? (asArray(b.sourceIds).length - asArray(a.sourceIds).length || a.name.localeCompare(b.name)) : a.name.localeCompare(b.name));
  rosterPage=Math.min(rosterPage,Math.max(0,Math.ceil(people.length/50)-1));
  $('#people-count').replaceChildren(number(people.length), element('small', {}, 'matching records'));
  $('#people-grid').replaceChildren(...people.slice(rosterPage*50,(rosterPage+1)*50).map((person, index) => element('a', { class: 'person-card', href: `#profile/${idPart(person.id)}` },
    element('div', { class: 'person-card-top' }, portrait(person), element('span', { class: 'person-number' }, String(index + 1).padStart(2, '0'))),
    element('h2', {}, person.name), element('p', { class: 'person-role' }, person.role || 'Subject in the public record'), element('p', { class: 'bio-excerpt' }, person.bio || ''),
    element('div', { class: 'person-card-foot' }, element('span', {}, directoryRecords.get(person.id)?.forumPosts!=null?number(directoryRecords.get(person.id).forumPosts)+' captured posts':asArray(person.sourceIds).length?number(asArray(person.sourceIds).length)+' linked sources':'Open record'), element('span', { 'aria-hidden': true }, '↗')),
  )));
  let pager=$('#profile-roster-pages');if(!pager){pager=element('nav',{id:'profile-roster-pages',class:'pagination','aria-label':'Profile roster pages'});$('#people-grid').after(pager);}pager.replaceChildren(element('button',{type:'button',disabled:rosterPage===0,onclick:()=>{rosterPage--;renderPeople();}},'Previous'),element('span',{},(rosterPage+1)+' / '+Math.max(1,Math.ceil(people.length/50))),element('button',{type:'button',disabled:(rosterPage+1)*50>=people.length,onclick:()=>{rosterPage++;renderPeople();}},'Next'));
  if (!people.length) $('#people-grid').append(emptyState('No matching names.', 'Try another name, alias, or public role.'));
}

function showPerson(id) {
  const person = personById(id);
  if (!person) { toast('That profile is not in this edition.'); return; }
  const patterns = asArray(person.patterns);
  const content = $('#detail-content');
  content.replaceChildren(portrait(person), element('p', { class: 'eyebrow' }, 'BIOGRAPHICAL RECORD'), element('h2', {}, person.name), element('p', { class: 'person-role' }, person.role || 'Public record subject'), element('p', { class: 'detail-body' }, person.bio || 'No biographical narrative has been added yet.'));
  if (asArray(person.aliases).length) content.append(element('p', { class: 'reader-byline' }, `Also indexed as ${person.aliases.join(' · ')}`));
  if (patterns.length) content.append(element('section', { class: 'detail-section' }, element('h3', {}, 'RECURRING PUBLIC WORK'), element('ul', {}, patterns.map(pattern => element('li', {}, textOf(pattern))))));
  const connections = state.corpus.edges.filter(edge => edge.from === id || edge.to === id);
  if (connections.length) content.append(element('section', { class: 'detail-section' }, element('h3', {}, 'CONNECTIONS IN THIS EDITION'), element('ul', {}, connections.map(edge => element('li', {}, edge.label, ' · ', edge.explanation || humanize(edge.type))))));
  if (asArray(person.sourceIds).length) content.append(element('section', { class: 'detail-section' }, element('h3', {}, 'SOURCE TRAIL'), evidenceLinks(person.sourceIds)));
  if (asArray(person.transcriptRefs).length) content.append(element('section', { class: 'detail-section' }, element('h3', {}, 'TRANSCRIPT PASSAGES'), transcriptLinks(person.transcriptRefs)));
  const credit = person.portraitCredit || person.portrait?.credit;
  content.append(element('div', { class: 'detail-actions' }, element('a', { class: 'button secondary', href: `#connections/${idPart(id)}` }, 'Find in connections', '↗')));
  if (credit) content.append(element('p', { class: 'portrait-credit' }, typeof credit === 'string' ? credit : credit.text || credit.source || 'Portrait supplied by its credited public source.'));
  content.append(element('p', { class: 'record-id' }, `RECORD / ${id}`));
  openDialog();
}

function renderSources() {
  const query = $('#source-search').value.trim().toLowerCase();
  const kind = $('#source-kind').value;
  const sort = $('#source-sort').value;
  const sources = state.corpus.sources.filter(source => (!kind || source.kind === kind) && [source.title, source.publisher, source.summary, source.kind].join(' ').toLowerCase().includes(query));
  sources.sort((a, b) => {
    if (sort === 'title') return str(a.title).localeCompare(str(b.title));
    if (!a.date || !b.date) return !a.date && !b.date ? str(a.title).localeCompare(str(b.title)) : !a.date ? 1 : -1;
    return sort === 'date-asc' ? str(a.date).localeCompare(str(b.date)) : str(b.date).localeCompare(str(a.date));
  });
  $('#source-count').replaceChildren(number(state.corpus.sources.length), element('small', {}, 'RECORDS'));
  $('#index-count').textContent = number(state.corpus.sources.length);
  $('#source-list').replaceChildren(...sources.map((source, index) => element('article', { class: 'source-item' },
    element('span', { class: 'source-index-number' }, String(index + 1).padStart(2, '0')),
    element('div', {}, element('h2', {}, element('a', { href: `#sources/index/${idPart(source.id)}` }, source.title)), element('p', {}, source.summary || 'Open the source record for provenance and related material.'), element('span', { class: 'source-publisher' }, source.publisher || 'PUBLIC SOURCE')),
    element('div', { class: 'source-meta' }, element('span', { class: 'kind' }, humanize(source.kind || 'Source')), element('span', {}, source.date ? formatDate(source.date) : 'Undated record')),
    sourceURL(source) ? link(source.url, '↗', { class: 'source-out', 'aria-label': `Open original: ${source.title}` }) : null,
  )));
  if (!sources.length) $('#source-list').append(emptyState('Nothing on this shelf.', 'Try another title, publisher, or source type.'));
}

function showSource(id) {
  const source = sourceById(id);
  if (!source) { toast('That source is not in this edition.'); return; }
  const content = $('#detail-content');
  content.replaceChildren(element('p', { class: 'eyebrow' }, humanize(source.kind || 'SOURCE RECORD')), element('h2', {}, source.title), element('p', { class: 'reader-byline' }, [source.publisher, source.date && formatDate(source.date)].filter(Boolean).join(' · ')), element('p', { class: 'detail-body' }, source.summary || 'This record preserves its original source link and index metadata.'));
  if (source.provenance) content.append(element('section', { class: 'detail-section' }, element('h3', {}, 'PROVENANCE'), element('p', { class: 'detail-body' }, textOf(source.provenance))));
  const people = state.corpus.people.filter(person => asArray(person.sourceIds).includes(id));
  if (people.length) content.append(element('section', { class: 'detail-section' }, element('h3', {}, 'INDEXED PROFILES'), people.map(person => element('a', { class: 'detail-source', href: `#profile/${idPart(person.id)}` }, person.name, '↗'))));
  const refs = transcriptLinks(source.transcriptRefs);
  if (refs.length) content.append(element('section', { class: 'detail-section' }, element('h3', {}, 'TRANSCRIPT PASSAGES'), refs));
  if (sourceURL(source)) content.append(element('div', { class: 'detail-actions' }, link(source.url, ['Open original source ', '↗'], { class: 'button' })));
  content.append(element('p', { class: 'record-id' }, `RECORD / ${id}`));
  openDialog();
}

function openDialog() {
  const dialog = $('#detail-dialog');
  const context = state.dialogReturnRoute?.split('/')[0];
  if (context) $('#detail-content').prepend(element('button', { class: 'detail-return', type: 'button', onclick: () => closeDialog() }, `← Return to ${context === 'sources' && state.dialogReturnRoute.includes('transcripts') ? 'transcript' : context}`));
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}

function closeDialog(updateHash = true) {
  $('#detail-dialog').close();
  if (updateHash) location.hash = `#${state.dialogReturnRoute || (state.route.startsWith('bios') ? 'bios' : 'sources/index')}`;
}

function transcriptQuery() {
  const params = new URLSearchParams(new FormData($('#transcript-filters')));
  for (const [key, value] of [...params.entries()]) if (!value) params.delete(key);
  params.set('page', state.transcriptPage);
  return params;
}

function updateOptions(select, values, firstLabel) {
  const selected = select.value;
  select.replaceChildren(element('option', { value: '' }, firstLabel), ...[...new Set(asArray(values).map(value => typeof value === 'string' ? value : value.name || value.label || value.value).filter(Boolean))].sort().map(value => element('option', { value }, value)));
  if ([...select.options].some(option => option.value === selected)) select.value = selected;
}

async function loadTranscripts() {
  if (state.suspended) return;
  const request = ++state.transcriptRequest;
  $('#transcript-status').textContent = 'Searching the transcript index…';
  $('#transcript-results').setAttribute('aria-busy', 'true');
  try {
    const payload = await api(`transcripts?${transcriptQuery()}`);
    if (request !== state.transcriptRequest) return;
    const records = Array.isArray(payload) ? payload : payload.items || payload.records || payload.results || [];
    const total = Number(payload.total ?? records.length);
    const pageSize = Number(payload.pageSize || 20);
    const page = Number(payload.page || state.transcriptPage);
    if (![...transcriptQuery()].some(([key, value]) => !['page', 'sort'].includes(key) && value)) state.totalTranscripts = total;
    $('#transcript-count').textContent = state.totalTranscripts == null ? '' : number(state.totalTranscripts);
    const speakers = payload.speakers || payload.facets?.speakers;
    const topics = payload.topics || payload.facets?.topics;
    if (speakers) updateOptions($('#transcript-filters [name=speaker]'), speakers, 'Everyone');
    if (topics) updateOptions($('#transcript-filters [name=topic]'), topics, 'All topics');
    if (payload.sources) {
      const select = $('#transcript-filters [name=source]');
      const selected = select.value;
      select.replaceChildren(element('option', { value: '' }, 'Every source'), ...payload.sources.map(source => element('option', { value: source.id }, source.title)));
      if ([...select.options].some(option => option.value === selected)) select.value = selected;
    }
    $('#transcript-status').textContent = `${number(total)} ${total === 1 ? 'transcript' : 'transcripts'}${total > pageSize ? ` · page ${page}` : ''}`;
    $('#transcript-results').replaceChildren(...records.map(record => element('a', { class: 'transcript-card', href: `#sources/transcripts/${idPart(record.id)}${record.match?.turnId ? `/${idPart(record.match.turnId)}` : ''}` },
      element('p', { class: 'eyebrow' }, record.date ? formatDate(record.date) : 'UNDATED RECORD'), element('h2', {}, record.title), element('p', { class: 'transcript-speakers' }, asArray(record.speakers).map(speaker => typeof speaker === 'string' ? speaker : speaker.name).join(' · ') || 'Speakers awaiting indexing'),
      record.snippet || record.match?.text ? element('p', { class: 'transcript-snippet' }, record.match ? `${timestamp(record.match.startSeconds)} · ${record.match.text}` : record.snippet) : null,
      element('div', { class: 'tags' }, asArray(record.topics).slice(0, 6).map(topic => element('span', { class: 'tag' }, topic))),
      element('div', { class: 'transcript-card-foot' }, element('span', {}, record.turnCount ? `${number(record.turnCount)} SPEAKER TURNS` : humanize(record.status || 'INDEXED RECORD').toUpperCase()), element('span', {}, 'READ TRANSCRIPT ↗')),
    )));
    if (!records.length) {
      const filtered = [...transcriptQuery()].some(([key, value]) => !['page', 'sort'].includes(key) && value);
      $('#transcript-results').append(emptyState(filtered ? 'No passages found.' : 'A library, ready to grow.', filtered ? 'Try a shorter phrase, another speaker, or a wider date range.' : 'Authorized transcripts will appear here as they are indexed. Originals, reading copies, speakers, and timestamps stay connected to their sources.', '“'));
    }
    const pages = Math.max(1, Math.ceil(total / pageSize));
    $('#transcript-pagination').replaceChildren();
    if (pages > 1) $('#transcript-pagination').append(element('button', { class: 'button secondary', type: 'button', disabled: page <= 1, onclick: () => { state.transcriptPage = page - 1; loadTranscripts(); } }, '← Previous'), element('span', {}, `${page} / ${pages}`), element('button', { class: 'button secondary', type: 'button', disabled: page >= pages, onclick: () => { state.transcriptPage = page + 1; loadTranscripts(); } }, 'Next →'));
  } catch (error) {
    if (request !== state.transcriptRequest) return;
    $('#transcript-status').textContent = 'The transcript index is temporarily unavailable.';
    $('#transcript-results').replaceChildren(emptyState('The shelf did not open.', error.message));
    $('#transcript-pagination').replaceChildren(element('button', { class: 'button secondary', type: 'button', onclick: loadTranscripts }, 'Try again'));
  } finally { if (request === state.transcriptRequest) $('#transcript-results').removeAttribute('aria-busy'); }
}

function timestamp(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return '—';
  const value = Math.max(0, Math.floor(Number(seconds)));
  return value >= 3600 ? `${Math.floor(value / 3600)}:${String(Math.floor(value % 3600 / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}` : `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function sourceAtTime(url, seconds) {
  const valid = safeURL(url);
  if (!valid) return null;
  const parsed = new URL(valid);
  if (seconds != null && (parsed.hostname === 'youtu.be' || /(^|\.)youtube\.com$/.test(parsed.hostname))) parsed.searchParams.set('t', String(Math.max(0, Math.floor(seconds))));
  return parsed.href;
}

async function openTranscript(id, turnId) {
  if (state.suspended) return;
  const request = ++state.readerRequest;
  const container = $('#transcript-reader');
  if (state.reader?.id !== id) {
    container.replaceChildren(element('div', { class: 'loading-state', role: 'status' }, 'Opening the transcript…'));
    try {
      const payload = await api(`transcripts/${idPart(id)}`);
      if (request !== state.readerRequest) return;
      state.reader = payload.record ? { ...payload.record, turns: payload.turns || payload.record.turns, originalText: payload.originalText || payload.record.originalText } : payload;
      state.readerVersion = 'reading'; state.readerFilter = ''; state.readerTurnPage = 1;
    } catch (error) {
      if (request !== state.readerRequest) return;
      container.replaceChildren(element('a', { class: 'reader-back', href: '#sources/transcripts' }, '← Back to transcripts'), emptyState('This record did not open.', error.message)); return;
    }
  }
  if (request !== state.readerRequest) return;
  if (turnId) state.readerFilter = '';
  renderReader(turnId);
}

function renderReader(turnId) {
  const record = state.reader;
  const source = sourceById(record.sourceId);
  const participants = asArray(record.speakers).length ? record.speakers : [...new Set(asArray(record.turns).map(turn => turn.speaker).filter(Boolean))];
  const reader = $('#transcript-reader');
  const sidebar = element('aside', { class: 'reader-sidebar' });
  sidebar.append(element('section', {}, element('h3', {}, 'PARTICIPANT INDEX'), participants.length ? participants.map(speaker => {
    const name = typeof speaker === 'string' ? speaker : speaker.name;
    const person = typeof speaker==='object' && speaker.personId ? personById(speaker.personId) : null;
    return person ? element('a', { class: 'participant', href: `#profile/${idPart(person.id)}` }, name, ' ↗') : element('span', { class: 'participant' }, name);
  }) : element('p', {}, 'Participants have not been indexed.')));
  const mentioned=(state.profileIndex||[]).filter(p=>p.transcriptIds?.includes(record.id));if(mentioned.length)sidebar.append(element('section',{},element('h3',{},'CAPTION MENTIONS'),mentioned.map(p=>element('a',{href:'#profile/'+idPart(p.id),class:'participant'},p.name))));
  if (asArray(record.topics).length) sidebar.append(element('section', {}, element('h3', {}, 'TOPICS'), record.topics.map(topic => element('span', { class: 'tag' }, topic))));
  sidebar.append(element('section', {}, element('h3', {}, 'PROVENANCE'), element('p', {}, source?.publisher || record.publisher || 'Source-linked record'), source ? element('a', { class: 'detail-source', href: `#sources/index/${idPart(source.id)}` }, source.title, '↗') : null, record.provenance ? element('p', {}, textOf(record.provenance)) : null, sourceURL(source) || safeURL(record.url) ? link(source?.url || record.url, 'Open original ↗') : null));
  if (record.rights) sidebar.append(element('section', {}, element('h3', {}, 'TEXT RECORD'), element('p', {}, typeof record.rights === 'string' ? humanize(record.rights) : record.rights.note || record.rights.status || 'Authorized source material')));
  const main = element('div', { class: 'reader-main' });
  const originalButton = element('button', { type: 'button', 'aria-pressed': state.readerVersion === 'original', onclick: () => { state.readerVersion = 'original'; renderReader(); } }, 'Original');
  const readingButton = element('button', { type: 'button', 'aria-pressed': state.readerVersion === 'reading', onclick: () => { state.readerVersion = 'reading'; renderReader(); } }, 'Reading copy');
  main.append(element('div', { class: 'reader-toolbar' }, element('div', { class: 'version-switch', role: 'group', 'aria-label': 'Transcript version' }, readingButton, originalButton), element('div', { class: 'reader-record-actions' }, record.originalFilename ? element('a', { class: 'text-button', href: `/ASSC/api/transcripts/${idPart(record.id)}/original`, download: '' }, 'Download original ↓') : null, element('button', { class: 'text-button', type: 'button', onclick: () => copyLink(location.href) }, 'Copy record link ↗'))));
  const search = element('input', { id: 'passage-search', type: 'search', placeholder: 'Find within this transcript', value: state.readerFilter, oninput: event => { state.readerFilter = event.target.value; state.readerTurnPage = 1; renderTurns(turnsRoot); } });
  main.append(element('div', { class: 'reader-search' }, element('label', { for: 'passage-search' }, 'FIND A PASSAGE'), search));
  main.append(element('p', { class: 'transcript-reading-note' }, state.readerVersion === 'original' ? 'Original wording is preserved. Time and speaker indexing remain alongside the text.' : 'Reading copies retain meaning; supplied corrections and editorial notes are attached to their passages.'));
  const turnsRoot = element('div', { id: 'transcript-turns' }); main.append(turnsRoot);
  reader.replaceChildren(element('a', { class: 'reader-back', href: '#sources/transcripts' }, '← Back to transcripts'), element('header', { class: 'reader-header' }, element('p', { class: 'eyebrow' }, 'TRANSCRIPT / READING ROOM'), element('h2', {}, record.title || 'Transcript record'), element('p', { class: 'reader-byline' }, [record.date && formatDate(record.date), source?.publisher, `${number(asArray(record.turns).length)} indexed turns`].filter(Boolean).join(' · '))), element('div', { class: 'reader-layout' }, main, sidebar));
  renderTurns(turnsRoot, turnId);
  if (turnId) afterActiveFrame(() => {
    if (!turnsRoot.isConnected) return;
    const target = [...turnsRoot.children].find(node => node.dataset.turnId === turnId);
    if (target) { target.classList.add('is-highlighted'); target.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }
    else toast('That passage is not in the current text.');
  });
}

function renderTurns(container, focusId) {
  const record = state.reader;
  const query = state.readerFilter.trim().toLowerCase();
  const turns = asArray(record.turns).filter(turn => !query || [turn.speaker, turn.text, turn.readingText].join(' ').toLowerCase().includes(query));
  container.replaceChildren();
  if (!asArray(record.turns).length) {
    if (record.originalText) container.append(element('pre', { class: 'original-text' }, record.originalText));
    else container.append(emptyState('The record is indexed.', 'Transcript text will appear when an authorized original is attached. Its metadata and provenance remain available.'));
    return;
  }
  if (!turns.length) { container.append(emptyState('No matching passages.', 'Try a different phrase or speaker.')); return; }
  const pageSize = 100;
  const focusIndex = focusId ? turns.findIndex(turn => turn.id === focusId) : -1;
  if (focusIndex >= 0) state.readerTurnPage = Math.floor(focusIndex / pageSize) + 1;
  const pageCount = Math.max(1, Math.ceil(turns.length / pageSize));
  state.readerTurnPage = Math.min(pageCount, Math.max(1, state.readerTurnPage));
  const offset = (state.readerTurnPage - 1) * pageSize;
  container.append(element('p', { class: 'reader-range' }, element('span', {}, `${number(offset + 1)}–${number(Math.min(turns.length, offset + pageSize))} OF ${number(turns.length)} ${query ? 'MATCHING ' : ''}PASSAGES`), element('span', {}, `PAGE ${state.readerTurnPage} / ${pageCount}`)));
  turns.slice(offset, offset + pageSize).forEach((turn, index) => {
    const turnId = str(turn.id || `turn-${index + 1}`);
    const href = `#sources/transcripts/${idPart(record.id)}/${idPart(turnId)}`;
    const source = sourceById(record.sourceId);
    const timeURL = sourceAtTime(source?.url || record.url, turn.startSeconds);
    const annotations = asArray(turn.annotations);
    const body = element('div', {}, element('div', { class: 'turn-speaker' }, turn.speaker || 'Speaker not identified'), element('p', { class: 'turn-text' }, state.readerVersion === 'reading' && turn.readingText ? turn.readingText : turn.text || ''));
    if (annotations.length || (turn.readingText && turn.readingText !== turn.text)) body.append(element('details', { class: 'turn-annotations' }, element('summary', {}, annotations.length ? `${annotations.length} editorial ${annotations.length === 1 ? 'note' : 'notes'}` : 'Edited reading copy'), annotations.length ? annotations.map(annotation => element('p', {}, typeof annotation === 'string' ? annotation : `${annotation.type ? `${humanize(annotation.type)}: ` : ''}${annotation.text || annotation.note || annotation.description || ''}`)) : element('p', {}, 'A separate reading version was supplied for this passage. Select Original to compare its preserved wording.')));
    if (timeURL && turn.startSeconds != null) body.append(element('details', { class: 'turn-annotations' }, element('summary', {}, 'Passage links'), element('p', {}, link(timeURL, 'Open source at this timestamp ↗')), element('p', {}, element('button', { class: 'text-button', type: 'button', onclick: () => copyLink(new URL(href, location.href).href) }, 'Copy passage link'))));
    const item = element('article', { class: 'transcript-turn', 'data-turn-id': turnId }, element('a', { class: 'turn-time', href, 'aria-label': `Link to ${turn.speaker || 'speaker'} at ${timestamp(turn.startSeconds)}` }, timestamp(turn.startSeconds)), body);
    container.append(item);
  });
  if (pageCount > 1) {
    const change = delta => { state.readerTurnPage += delta; renderTurns(container); container.scrollIntoView({ block: 'start', behavior: 'instant' }); };
    container.append(element('nav', { class: 'pagination turn-pagination', 'aria-label': 'Transcript passage pages' }, element('button', { class: 'button secondary', type: 'button', disabled: state.readerTurnPage <= 1, onclick: () => change(-1) }, '← Earlier'), element('span', {}, `${state.readerTurnPage} / ${pageCount}`), element('button', { class: 'button secondary', type: 'button', disabled: state.readerTurnPage >= pageCount, onclick: () => change(1) }, 'Later →')));
  }
}

async function copyLink(value) {
  try { await navigator.clipboard.writeText(value); toast('Link copied.'); }
  catch { toast('Use the address bar to copy this record link.'); }
}

const integrations = {
  onPerson: id => { profileController.navigate(id); },
  onSource: id => { location.hash = `#sources/index/${idPart(id)}`; },
  onTranscript: (id, turn) => { location.hash = `#sources/transcripts/${idPart(id)}${turn ? `/${idPart(turn)}` : ''}`; },
};

async function loadFeatureModule(name) { return import(`./${name}.js`); }

async function mountFeature(name) {
  if (state.suspended) return null;
  if (state[name]) return state[name];
  if (pendingFeatures.has(name)) return pendingFeatures.get(name);
  const container = $(`#${name}-host`);
  const epoch = state.lifecycleEpoch;
  const pending = (async () => {
    try {
      const module = await loadFeatureModule(name);
      if (state.suspended || epoch !== state.lifecycleEpoch) return null;
      const mount = module[{ graph: 'mountGraph', timeline: 'mountTimeline', kf: 'mountKF' }[name]] || module.default;
      const feature = await mount(container, name === 'kf' ? { api, onProfile: id => profileController.navigate(id) } : state.corpus, integrations) || { mounted: true };
      if (state.suspended || epoch !== state.lifecycleEpoch) { feature.destroy?.(); return null; }
      state[name] = feature;
      return feature;
    } catch (error) {
      if (state.suspended || epoch !== state.lifecycleEpoch) return null;
      const title = { graph: 'The map did not open.', timeline: 'The chronology did not open.', kf: 'The activity view did not open.' }[name];
      container.replaceChildren(emptyState(title, 'Reload the desk to try again. Source records remain available in the reading room.'));
      console.error(`Unable to open ${name}:`, error);
      return null;
    } finally {
      if (pendingFeatures.get(name) === pending) pendingFeatures.delete(name);
    }
  })();
  pendingFeatures.set(name, pending);
  return pending;
}

function screenForRoute(raw) {
  if (!raw) return null;
  let parts;
  try { parts = raw.split('?')[0].split('/').map(decodeURIComponent); } catch { parts = ['brief']; }
  const [requested, subpage, recordId] = parts;
  if (requested === 'profile' || (requested === 'bios' && subpage)) return { key: `profile/${subpage}`, selector: '.assc-profile .ap-body', kind: 'panel', rank: 1.5 };
  const page = pageNames.includes(requested) ? requested : 'brief';
  if (page === 'sources') {
    if (subpage === 'transcripts') return recordId
      ? { key: `sources/transcripts/${recordId}`, selector: '#transcript-reader', kind: 'paper', rank: 2.5 }
      : { key: 'sources/transcripts', selector: '#transcript-library', kind: 'paper', rank: 2.25 };
    if (recordId) return { key: `sources/index/${recordId}`, selector: '#detail-content', kind: 'panel', rank: 2.125 };
    return { key: 'sources/index', selector: '#source-index', kind: 'paper', rank: 2 };
  }
  return { key: page, selector: `#${page}`, kind: page === 'connections' ? 'atlas' : ['timeline', 'kf'].includes(page) ? 'instrument' : 'paper', rank: pageNames.indexOf(page) };
}

function suspendPrivateView() {
  state.suspended = true;
  configurePresentation(null);
  state.lifecycleEpoch++; state.routeRequest++; state.transcriptRequest++; state.readerRequest++;
  for (const frame of activeFrames) cancelAnimationFrame(frame);
  activeFrames.clear();
  for (const observer of privateObservers) observer.disconnect();
  privateObservers.clear(); pendingFeatures.clear();
  window.SiteMotion?.cancelAll();
  // Conceal synchronously before history can retain a rendered private screen.
  // A restored page reloads through the server gate; this document never resumes.
  document.body.hidden = true; document.body.inert = true;
  state.graph?.destroy?.(); state.timeline?.destroy?.(); state.kf?.destroy?.(); profileController?.destroy?.();
  state.graph = null; state.timeline = null; state.kf = null; state.corpus = null; state.reader = null; state.profileIndex = null;
  $$('.page').forEach(section => { section.hidden = true; section.replaceChildren(); });
  const dialog = $('#detail-dialog'); if (dialog?.open) dialog.close();
  $('#detail-content')?.replaceChildren();
  $('.console-results')?.replaceChildren();
  const search = $('.console-search input'); if (search) search.value = '';
  const toastNode = $('#toast'); if (toastNode) { toastNode.hidden = true; toastNode.textContent = ''; }
  clearTimeout(toast.timer);
}

async function route() {
  if (state.suspended || !state.corpus) return;
  const raw = location.hash.slice(1) || 'brief';
  if(raw===state.route&&!profileController?.isOpen())return;
  const request = ++state.routeRequest;
  const previousScreen = screenForRoute(state.motionRoute || state.route), nextScreen = screenForRoute(raw);
  const changedScreen = previousScreen && previousScreen.key !== nextScreen.key;
  state.motionRoute = raw;
  if (changedScreen) window.SiteMotion?.cancelAll();
  state.transcriptRequest++; state.readerRequest++;
  const current = () => !state.suspended && request === state.routeRequest;
  const reveal = () => {
    if (current() && changedScreen && !document.body.classList.contains('gate-body')) {
      window.SiteMotion?.revealScreen($(nextScreen.selector), { kind: nextScreen.kind, direction: nextScreen.rank < previousScreen.rank ? -1 : 1 });
    }
  };
  let parts;
  try { parts = raw.split('?')[0].split('/').map(decodeURIComponent); } catch { parts = ['brief']; }
  const [requestedPage, subpage, recordId, turnId] = parts;
  if(requestedPage==='profile'){if(!state.route){$('#bios').hidden=false;renderPeople();}await profileController.open(subpage);reveal();return;}
  if(requestedPage==='bios'&&subpage){history.replaceState(null,'','#profile/'+idPart(subpage)+'?back=bios');await profileController.open(subpage);reveal();return;}
  const returningFromProfile=profileController.closeForRoute();
  const page = pageNames.includes(requestedPage) ? requestedPage : 'brief';
  const detailRoute = (page === 'bios' && subpage) || (page === 'sources' && subpage !== 'transcripts' && recordId);
  const previousDetail = /^(bios\/[^/]+|sources\/index\/[^/]+)$/.test(state.route);
  if (detailRoute && !previousDetail) state.dialogReturnRoute = state.route || (page === 'bios' ? 'bios' : 'sources/index');
  state.route = raw;
  if ($('#detail-dialog').open) closeDialog(false);
  $$('.page').forEach(section => { section.hidden = section.id !== page; });
  $$('.primary-nav a').forEach(anchor => { if (anchor.dataset.route === page) anchor.setAttribute('aria-current', 'page'); else anchor.removeAttribute('aria-current'); });
  document.title = `AntiSnarkerSnarkerClub · ${page.charAt(0).toUpperCase() + page.slice(1)}`;
  if (page === 'bios') { renderPeople(); if (subpage) showPerson(subpage); }
  if (page === 'sources') {
    const tab = subpage === 'transcripts' ? 'transcripts' : 'index';
    $$('[data-source-tab]').forEach(anchor => { if (anchor.dataset.sourceTab === tab) anchor.setAttribute('aria-current', 'page'); else anchor.removeAttribute('aria-current'); });
    $('#source-index').hidden = tab !== 'index';
    $('#transcript-library').hidden = tab !== 'transcripts' || Boolean(recordId);
    $('#transcript-reader').hidden = tab !== 'transcripts' || !recordId;
    if (tab === 'index') { renderSources(); if (recordId) showSource(recordId); }
    else if (recordId) await openTranscript(recordId, turnId);
    else await loadTranscripts();
  }
  if (page === 'connections') {
    const graph = await mountFeature('graph');
    if (!current()) return;
    arrangeNetworkConsole();
    if(!returningFromProfile)graph?.resize?.();
    if (subpage && state.route === raw && !returningFromProfile) { if (graph?.focusNode) graph.focusNode(subpage); else $('#graph-host').dispatchEvent(new CustomEvent('focus-node', { detail: { id: subpage } })); }
  }
  if (page === 'kf') {
    await mountFeature('kf');
  }
  if (page === 'timeline') {
    const timeline = await mountFeature('timeline');
    if (!current()) return;
    if(!returningFromProfile)timeline?.resize?.();
    if (subpage && state.route === raw && !returningFromProfile) timeline?.focusEvent?.(subpage);
  }
  reveal();
}

async function init() {
  try {
    configurePresentation(await api('presentation'));
    const corpus = await api('corpus');
    state.corpus = { ...corpus, meta: corpus.meta || {}, people: asArray(corpus.people), sources: asArray(corpus.sources), nodes: asArray(corpus.nodes), edges: asArray(corpus.edges), events: asArray(corpus.events), questions: asArray(corpus.questions) };
    profileController=createProfileController({api});
    const profileIndex=await api('profiles');state.profileIndex=profileIndex.records;
    const existingIds=new Set(state.corpus.people.map(p=>p.id));state.corpus.people.push(...profileIndex.records.filter(p=>!existingIds.has(p.id)));
    renderBrief(); renderPeople(); installResearchConsole();
    [...new Set(state.corpus.sources.map(source => source.kind).filter(Boolean))].sort().forEach(kind => $('#source-kind').append(element('option', { value: kind }, humanize(kind))));
    renderSources();
    $('#revision-note').textContent = corpus.meta?.updated ? `RECORD UPDATED ${formatDate(corpus.meta.updated).toUpperCase()}` : 'A LIVING COLLECTION';
    $('#loading').hidden = true;
    await route();if(state.suspended)return;document.documentElement.dataset.asscReady='true';document.dispatchEvent(new CustomEvent('assc-ready',{detail:{ok:true}}));
  } catch (error) {
    if (state.suspended) return;
    document.dispatchEvent(new CustomEvent('assc-ready',{detail:{ok:false,message:error.message}}));
    $('#loading').replaceChildren(emptyState('The desk did not open.', error.message), element('button', { class: 'button secondary', type: 'button', onclick: () => location.reload() }, 'Try again'));
  }
}

$('#people-search').addEventListener('input', renderPeople);
$('#people-sort').addEventListener('change', renderPeople);
$('#source-search').addEventListener('input', renderSources);
$('#source-kind').addEventListener('change', renderSources);
$('#source-sort').addEventListener('change', renderSources);
$('#transcript-filters').addEventListener('submit', event => { event.preventDefault(); state.transcriptPage = 1; loadTranscripts(); });
$$('select, input[type=date]', $('#transcript-filters')).forEach(input => input.addEventListener('change', () => { state.transcriptPage = 1; loadTranscripts(); }));
$('#transcript-clear').addEventListener('click', () => { $('#transcript-filters').reset(); state.transcriptPage = 1; loadTranscripts(); });
$('#detail-close').addEventListener('click', () => closeDialog());
$('#detail-dialog').addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
$('#detail-dialog').addEventListener('click', event => { if (event.target === $('#detail-dialog')) { const rect = event.target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(); } });
$('#logout').addEventListener('click', async () => {
  if (state.suspended) return;
  const epoch = state.lifecycleEpoch;
  window.SiteMotion?.cancelAll();
  const button = $('#logout'); button.disabled = true;
  try {
    const response = await fetch('/ASSC/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
    if (state.suspended || epoch !== state.lifecycleEpoch) return;
    if (!response.ok) throw new Error('The session could not be closed.');
    suspendPrivateView();
    location.replace('/ASSC/');
  } catch (error) { if (!state.suspended) { button.disabled = false; toast(error.message); } }
});
window.addEventListener('hashchange', route);
window.addEventListener('popstate', route);
window.addEventListener('pagehide', suspendPrivateView);
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
init();

function installResearchConsole() {
  const names={brief:'Overview',bios:'People & accounts',sources:'Sources',connections:'Network',timeline:'Timeline',kf:'KF threads'};
  const header=document.querySelector('.masthead');
  const search=element('form',{class:'console-search',role:'search'},element('label',{class:'sr-only',for:'console-query'},'Search accounts, sources and passages'),element('input',{id:'console-query',type:'search',placeholder:'Search accounts, sources, passages…',autocomplete:'off'}),element('button',{type:'submit'},'Search'));
  header.insertBefore(search,document.querySelector('#logout'));
  const rail=element('aside',{class:'console-rail','aria-label':'Workspace navigation'});
  const original=document.querySelector('.primary-nav');
  for(const a of original.querySelectorAll('a')){const copy=a.cloneNode(true);copy.textContent=names[a.dataset.route];if(a.dataset.route==='kf')copy.addEventListener('click',()=>copy.href=a.href);rail.append(copy);}
  function openNotes(){const show=()=>{if(state.suspended)return false;const n=[...document.querySelectorAll('#kf-host details')].find(d=>d.querySelector('summary')?.textContent==='Research notes');if(!n)return false;n.open=true;n.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});return true;};afterActiveFrame(()=>{if(show())return;const obs=watchPrivate(document.querySelector('#kf-host'),{childList:true,subtree:true},observer=>{if(show())stopWatching(observer);});if(obs)setTimeout(()=>stopWatching(obs),10000);});}
  rail.append(element('div',{class:'console-nav-divider'}),element('a',{href:'#sources/transcripts'},'Transcripts'),element('a',{href:'#kf',onclick:ev=>ev.currentTarget.href=original.querySelector('[data-route=kf]').href},'Export metrics'),element('a',{href:'#kf',onclick:openNotes},'Notes'));
  header.after(rail);
  document.querySelector('#main').before(original);
  for(const a of original.querySelectorAll('a'))a.textContent={brief:'Overview',bios:'People',sources:'Evidence',connections:'Network',timeline:'Timeline',kf:'KF activity'}[a.dataset.route];
  const results=element('div',{class:'console-results',hidden:true,'aria-label':'Search results'});search.after(results);
  function runSearch(){if(state.suspended)return;const q=search.querySelector('input').value.trim().toLowerCase();results.replaceChildren();results.hidden=!q;if(!q)return;
    const people=state.corpus.people.filter(p=>[p.name,...(p.aliases||[])].join(' ').toLowerCase().includes(q)).slice(0,6);
    const sources=state.corpus.sources.filter(p=>[p.title,p.publisher].join(' ').toLowerCase().includes(q)).slice(0,4);
    results.append(element('p',{class:'console-label'},'MATCHING RECORDS'));
    if(!people.length&&!sources.length)results.append(element('p',{role:'status',class:'console-empty-search'},'No matching names or sources.'));
    for(const p of people)results.append(element('a',{href:'#profile/'+idPart(p.id),onclick:()=>results.hidden=true},element('span',{},p.name),element('small',{},p.type||'Record')));
    for(const s of sources)results.append(element('a',{href:'#sources/index/'+idPart(s.id),onclick:()=>results.hidden=true},element('span',{},s.title),element('small',{},'Source')));
    results.append(element('a',{href:'#sources/transcripts',onclick:()=>{if(state.suspended)return;results.hidden=true;const input=document.querySelector('#transcript-filters input[name=query]');if(input)input.value=search.querySelector('input').value;afterActiveFrame(()=>document.querySelector('#transcript-filters')?.requestSubmit());}},'Search this phrase in transcripts'));
  }
  search.addEventListener('submit',ev=>{ev.preventDefault();runSearch();});search.querySelector('input').addEventListener('input',runSearch);search.addEventListener('keydown',ev=>{if(ev.key==='Escape')results.hidden=true;});document.addEventListener('click',ev=>{if(!header.contains(ev.target))results.hidden=true;});
  search.querySelector('input').addEventListener('keydown',ev=>{if(ev.key==='ArrowDown'&&!results.hidden){ev.preventDefault();results.querySelector('a')?.focus();}});
  results.addEventListener('keydown',ev=>{const links=[...results.querySelectorAll('a')],i=links.indexOf(document.activeElement);if(ev.key==='Escape'){results.hidden=true;search.querySelector('input').focus();}else if(['ArrowDown','ArrowUp'].includes(ev.key)){ev.preventDefault();const next=i+(ev.key==='ArrowDown'?1:-1);if(next<0)search.querySelector('input').focus();else links[Math.min(next,links.length-1)]?.focus();}});
  document.addEventListener('keydown',ev=>{if(!state.suspended&&(ev.metaKey||ev.ctrlKey)&&ev.key==='k'){ev.preventDefault();search.querySelector('input').focus();}});
  const sync=()=>{if(state.suspended)return;const page=(location.hash.slice(1)||'brief').split(/[/?]/)[0];for(const a of rail.querySelectorAll('[data-route]')){a.toggleAttribute('aria-current',a.dataset.route===page);if(a.dataset.route===page)a.setAttribute('aria-current','page');}document.body.dataset.workspace=page;};window.addEventListener('hashchange',sync);sync();
}

function arrangeNetworkConsole(){
  const host=document.querySelector('#graph-host'),root=host.querySelector('.assc-graph');if(!root||root.querySelector('.console-network-grid'))return;
  const stage=root.querySelector('.ag-stage'),detail=root.querySelector('.ag-detail');
  const grid=element('div',{class:'console-network-grid'}),side=element('aside',{class:'console-inspector','aria-label':'Network inspector'}),summary=element('div',{class:'console-case-summary'});
  summary.append(element('h2',{},'In this map'),element('p',{class:'console-selection-hint'},'Select a name or connection for details.'));
  for(const n of state.corpus.nodes.filter(n=>n.type==='person'||n.type==='organization'))summary.append(element('button',{type:'button',onclick:()=>profileController.navigate(n.id)},n.label||n.name));
  stage.before(grid);grid.append(stage,side);side.append(summary,detail);watchPrivate(detail,{attributes:true,attributeFilter:['hidden']},()=>{summary.hidden=!detail.hidden;});summary.hidden=!detail.hidden;
  const deck=element('div',{class:'console-support'});
  const archive=element('details',{class:'console-archive'}),metrics=element('div',{class:'console-archive-links'});archive.append(element('summary',{},'Browse the archive'),metrics);
  for(const [n,label,href]of [[state.corpus.people.length,'People & accounts','#bios'],[state.corpus.sources.length,'Source records','#sources'],[state.corpus.edges.length,'Mapped connections','#connections'],[state.corpus.events.length,'Dated events','#timeline']])metrics.append(element('a',{class:'console-metric',href},element('span',{},label),element('strong',{},number(n))));
  const chronology=element('section',{class:'console-panel'},element('header',{},element('h2',{},'Timeline'),element('a',{href:'#timeline'},'All events')));
  for(const event of [...state.corpus.events].sort((a,b)=>str(b.date).localeCompare(str(a.date))).slice(0,3))chronology.append(element('a',{class:'console-event',href:'#timeline/'+idPart(event.id)},element('time',{},formatDate(event.date)),element('span',{},event.title||event.label)));
  const evidence=element('section',{class:'console-panel'},element('header',{},element('h2',{},'Sources'),element('a',{href:'#sources'},'All sources')));
  for(const s of [...state.corpus.sources].sort((a,b)=>str(b.date).localeCompare(str(a.date))).slice(0,4))evidence.append(element('a',{class:'console-source',href:'#sources/index/'+idPart(s.id)},element('span',{},s.title),element('small',{},humanize(s.kind||'Source'))));
  deck.append(chronology,evidence);host.append(deck,archive);state.graph?.resize?.();state.graph?.fit?.();
}
