/* Small, source-backed browser demonstrations. No network services or model calls. */
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const words = (value) => value.replaceAll('_', ' ');
const date = (value) => value ? value.slice(0, 10) : 'No stated end';
const unique = (values) => [...new Set(values)].sort();

export function aggregateRequests(rows, filters = {}) {
  const selected = rows.filter((row) => Object.entries(filters).every(([key, value]) => !value || row[key] === value));
  const closed = selected.filter((row) => row.is_closed);
  const timed = closed.filter((row) => Number.isFinite(row.closure_hours));
  const groups = new Map();
  selected.forEach((row) => groups.set(row.complaint_type, (groups.get(row.complaint_type) || 0) + 1));
  return {
    selected, closed: closed.length, timed: timed.length,
    mean: timed.length ? timed.reduce((sum, row) => sum + row.closure_hours, 0) / timed.length : null,
    groups: [...groups].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  };
}

export function temporalView(data, knowledge, validTime, modality = '') {
  const active = new Map();
  for (const batch of data.batches) {
    if (batch.published_at > knowledge) continue;
    for (const record of batch.records) {
      if (record.operation === 'withdraw') active.delete(record.document_id);
      else active.set(record.document_id, { record, batch });
    }
  }
  const assertions = [];
  for (const { record, batch } of active.values()) {
    for (const claim of batch.assertions) {
      if (claim.document_id !== record.document_id || claim.version_id !== record.version_id) continue;
      if (claim.valid_from > validTime || (claim.valid_to && claim.valid_to <= validTime)) continue;
      assertions.push({ ...claim, published_at: batch.published_at, source_available_at: record.source_available_at });
    }
  }
  const reported = assertions.filter((claim) => claim.modality === 'reported');
  const disputed = reported.length > 1 && reported.every((claim) => claim.qualifiers?.exclusive);
  return { assertions: assertions.filter((claim) => !modality || claim.modality === modality), disputed };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, callback, className = '') {
  const node = el('button', className, text);
  node.type = 'button';
  node.addEventListener('click', callback);
  return node;
}

function field(label, options, value, onChange) {
  const wrapper = el('label', 'demo-field');
  wrapper.append(el('span', '', label));
  const select = el('select');
  for (const option of options) {
    const [key, text] = Array.isArray(option) ? option : [option, option];
    const node = el('option', '', text);
    node.value = key;
    select.append(node);
  }
  select.value = value;
  select.addEventListener('change', onChange);
  wrapper.append(select);
  return { wrapper, select };
}

function status(root, text) { root.querySelector('[data-demo-status]').textContent = text; }
function empty(text) { return el('p', 'demo-empty', text); }
function label(text) { return el('p', 'demo-label', text); }

function sourceBox(title, text, path) {
  const box = el('aside', 'demo-source');
  box.setAttribute('aria-label', 'Source evidence');
  box.append(label(title), el('blockquote', '', text));
  if (path) box.append(label(path));
  return box;
}

function reset(controls, callback) { controls.append(button('Reset demo', callback, 'demo-reset')); }

function sensemaking(root, data) {
  const controls = root.querySelector('[data-demo-controls]');
  const results = root.querySelector('[data-demo-results]');
  const question = field('Question', data.findings.map((finding, i) => [String(i), finding.question]), '0', render);
  controls.append(question.wrapper);
  reset(controls, () => { question.select.value = '0'; render(); });
  function render() {
    const finding = data.findings[Number(question.select.value)];
    const article = el('article', 'demo-card');
    article.append(label('Recorded finding · Riverwatch14'), el('h4', '', finding.claim), el('p', 'demo-qualification', finding.qualification));
    const list = el('div', 'demo-source-list');
    list.setAttribute('aria-label', 'Choose a cited source');
    const detail = el('div');
    const sources = finding.evidence_ids.map((id) => data.evidence.find((item) => item.id === id));
    const buttons = sources.map((source) => {
      const node = button(`${source.id} · ${source.date}`, () => show(source));
      node.setAttribute('aria-pressed', 'false');
      list.append(node);
      return node;
    });
    function show(source) {
      buttons.forEach((node, i) => node.setAttribute('aria-pressed', String(sources[i].id === source.id)));
      detail.replaceChildren(sourceBox(`${source.title} · ${source.date}`, source.text, source.path));
      status(root, `${sources.length} linked sources · inspecting ${source.id}.`);
    }
    article.append(list, detail);
    results.replaceChildren(article);
    show(sources[0]);
  }
  render();
}

function serviceRequests(root, data) {
  const controls = root.querySelector('[data-demo-controls]');
  const results = root.querySelector('[data-demo-results]');
  const filters = [['borough', 'Borough'], ['complaint_type', 'Complaint'], ['status', 'Request status']].map(([key, title]) => {
    const control = field(title, [['', `All ${title.toLowerCase()}s`], ...unique(data.rows.map((row) => row[key]))], '', render);
    controls.append(control.wrapper);
    return { key, ...control };
  });
  reset(controls, () => { filters.forEach((control) => { control.select.value = ''; }); render(); });
  function render() {
    const values = Object.fromEntries(filters.map((control) => [control.key, control.select.value]));
    const summary = aggregateRequests(data.rows, values);
    status(root, `${summary.selected.length} of ${data.rows.length} fixture requests · ${summary.closed} closed · ${summary.timed} with recorded closure duration.`);
    if (!summary.selected.length) { results.replaceChildren(empty('No fixture rows match these filters. Change a filter or reset the demo.')); return; }
    const metrics = el('dl', 'demo-metrics');
    const entries = [
      ['Matching requests', String(summary.selected.length)],
      ['Closed share', `${number.format(100 * summary.closed / summary.selected.length)}%`],
      ['Mean closure', summary.mean === null ? 'No duration' : `${number.format(summary.mean)} h`],
    ];
    entries.forEach(([name, value]) => {
      const metric = el('div', 'demo-metric');
      metric.append(el('dt', '', name), el('dd', '', value));
      metrics.append(metric);
    });
    const bars = el('div', 'demo-bars');
    const max = Math.max(...summary.groups.map((group) => group[1]));
    for (const [name, count] of summary.groups) {
      const line = el('div', 'demo-bar-line');
      const track = el('div', 'demo-bar-track');
      track.setAttribute('aria-hidden', 'true');
      const fill = el('div', 'demo-bar-fill');
      fill.style.width = `${100 * count / max}%`;
      track.append(fill);
      line.append(el('span', '', name), el('strong', '', String(count)), track);
      bars.append(line);
    }
    const tableWrap = el('div', 'demo-table-wrap');
    tableWrap.tabIndex = 0;
    tableWrap.setAttribute('role', 'region');
    tableWrap.setAttribute('aria-label', 'Matching fixture rows, scroll horizontally if needed');
    const table = el('table');
    table.append(el('caption', '', 'Matching source rows'));
    const head = el('thead');
    const header = el('tr');
    ['Request / date', 'Borough', 'Complaint', 'Status', 'Closure hours'].forEach((name) => {
      const cell = el('th', '', name); cell.scope = 'col'; header.append(cell);
    });
    head.append(header); table.append(head);
    const body = el('tbody');
    summary.selected.forEach((request) => {
      const row = el('tr');
      [request.unique_key + ' · ' + date(request.created_date), request.borough, request.complaint_type, request.status, request.closure_hours === null ? 'Not recorded' : number.format(request.closure_hours)].forEach((text) => row.append(el('td', '', text)));
      body.append(row);
    });
    table.append(body); tableWrap.append(table);
    results.replaceChildren(metrics, el('p', 'demo-explanation', 'Mean closure uses only closed rows with a recorded duration. A missing duration is not zero; open requests stay out of that average.'), bars, tableWrap);
  }
  render();
}

function specifications(root, data) {
  const controls = root.querySelector('[data-demo-controls]');
  const results = root.querySelector('[data-demo-results]');
  const model = field('Equipment', [['', 'All equipment'], ...unique(data.observations.map((row) => row.model))], 'M18', render);
  const attribute = field('Specification', [['', 'All specifications'], ...unique(data.observations.map((row) => row.attribute)).map((name) => [name, words(name)])], 'output_power', render);
  controls.append(model.wrapper, attribute.wrapper);
  reset(controls, () => { model.select.value = 'M18'; attribute.select.value = 'output_power'; render(); });
  function render() {
    const selected = data.observations.filter((row) => (!model.select.value || row.model === model.select.value) && (!attribute.select.value || row.attribute === attribute.select.value));
    status(root, `${selected.length} of ${data.observations.length} reviewed observations · ${unique(selected.map((row) => row.doc_id)).length} source manuals.`);
    const cards = el('div', 'demo-grid');
    if (!selected.length) { results.replaceChildren(empty('No reviewed observation matches this equipment and specification. Choose another specification or all equipment.')); return; }
    for (const row of selected) {
      const card = el('article', 'demo-card');
      const value = `${number.format(row.value)}${row.value_max !== null ? '–' + number.format(row.value_max) : ''} ${row.unit}`;
      card.append(label(`${row.model} · ${words(row.attribute)}`), el('h4', 'demo-value', value));
      card.append(el('p', 'demo-qualification', row.conditions?.length ? row.conditions.join(' · ') : 'No additional operating condition recorded.'));
      card.append(sourceBox(`Source excerpt · PDF page ${row.pdf_page}`, row.source_quote));
      card.append(el('p', 'demo-explanation', row.notes));
      const link = el('a', '', `${row.title} · page ${row.pdf_page}`);
      if (row.source_url.startsWith('https://www.ibiblio.org/')) link.href = `${row.source_url}#page=${row.pdf_page}`;
      card.append(link, label(`${row.lead_id} · ${row.review}`));
      cards.append(card);
    }
    results.replaceChildren(cards);
  }
  render();
}

function organization(root, data) {
  const controls = root.querySelector('[data-demo-controls]');
  const results = root.querySelector('[data-demo-results]');
  const person = field('Entity', data.entities.map((item) => [item.id, `${item.name} · ${item.department}`]), 'taylor', render);
  const layer = field('Relationship layer', [['reporting', 'Declared reporting'], ['communication', 'Dated messages']], 'reporting', render);
  controls.append(person.wrapper, layer.wrapper);
  reset(controls, () => { person.select.value = 'taylor'; layer.select.value = 'reporting'; render(); });
  function render() {
    const entity = data.entities.find((item) => item.id === person.select.value);
    const edges = data.edges.filter((edge) => edge.kind === layer.select.value && (edge.from === entity.id || edge.to === entity.id));
    const grid = el('div', 'demo-grid');
    const network = el('div', 'demo-network');
    const center = el('div', 'demo-node');
    center.append(el('h4', '', entity.name), el('p', '', `${entity.role} · ${entity.department}`), el('p', '', `ID: ${entity.id} · ${words(entity.type)}`));
    network.append(center);
    const connections = el('div', 'demo-connections');
    const evidence = el('div');
    const buttons = edges.map((edge) => {
      const from = data.entities.find((item) => item.id === edge.from);
      const to = data.entities.find((item) => item.id === edge.to);
      const node = button('', () => show(edge), 'demo-edge');
      node.append(el('span', '', `${from.name} → ${to.name}`), el('small', '', `${edge.label} · ${edge.id}`));
      node.setAttribute('aria-pressed', 'false');
      connections.append(node);
      return node;
    });
    function show(edge) {
      buttons.forEach((node, i) => node.setAttribute('aria-pressed', String(edges[i].id === edge.id)));
      evidence.replaceChildren(sourceBox(`${edge.title || 'Declared reporting'} · ${date(edge.date)}`, edge.evidence, `${edge.source} · ${edge.id}`));
      evidence.append(el('p', 'demo-qualification', layer.select.value === 'reporting' ? 'This edge is supplied by the roster. It is a declared relationship, not a probability inferred from message traffic.' : 'A message establishes communication. Coordination and message volume alone do not establish a formal manager.'));
      status(root, `${entity.name} · ${edges.length} ${layer.select.value === 'reporting' ? 'declared reporting connections' : 'dated messages'} · inspecting ${edge.id}.`);
    }
    if (edges.length) { network.append(connections); show(edges[0]); }
    else {
      evidence.append(empty('No relationship in this layer is recorded for this entity in the bundled fixture.'));
      status(root, `${entity.name} · no ${layer.select.value} connections in this fixture.`);
    }
    grid.append(network, evidence);
    results.replaceChildren(grid);
  }
  render();
}

function temporal(root, data) {
  const controls = root.querySelector('[data-demo-controls]');
  const results = root.querySelector('[data-demo-results]');
  const snapshots = [
    ['2025-01-10T00:00:00Z', 'Jan 10 · initial report'],
    ['2025-02-05T00:00:00Z', 'Feb 05 · plan published'],
    ['2025-02-11T00:00:00Z', 'Feb 11 · correction published'],
    ['2025-02-13T00:00:00Z', 'Feb 13 · competing report'],
    ['2025-02-15T10:05:00Z', 'Feb 15 · withdrawal published'],
  ];
  const knowledge = field('Known by (UTC)', snapshots, snapshots[3][0], render);
  const dateWrapper = el('label', 'demo-field');
  dateWrapper.append(el('span', '', 'Claim applies on (UTC)'));
  const valid = el('input');
  valid.type = 'date'; valid.value = '2025-02-04'; valid.min = '2024-12-01'; valid.max = '2025-03-31';
  valid.addEventListener('change', render); dateWrapper.append(valid);
  const modality = field('Claim type', [['', 'All claims'], ['reported', 'Reported'], ['planned', 'Planned']], '', render);
  controls.append(knowledge.wrapper, dateWrapper, modality.wrapper);
  reset(controls, () => { knowledge.select.value = snapshots[3][0]; valid.value = '2025-02-04'; modality.select.value = ''; render(); });
  function render() {
    if (!valid.value || !valid.checkValidity()) { status(root, 'Choose a date between December 1, 2024 and March 31, 2025.'); results.replaceChildren(empty('Choose a valid claim date to inspect the published evidence.')); return; }
    const view = temporalView(data, knowledge.select.value, `${valid.value}T00:00:00Z`, modality.select.value);
    const names = view.assertions.map((claim) => claim.subject_label).join(' + ');
    status(root, `${date(knowledge.select.value)} knowledge / ${valid.value} claim date · ${view.assertions.length} matching claims${view.disputed ? ' · disputed' : ''}.`);
    if (!view.assertions.length) { results.replaceChildren(empty('No active claim matches these dates and this claim type. No supported claim is different from proof that no operator existed.')); return; }
    const explanation = el('p', 'demo-qualification', view.disputed ? `${names}: two independent reported claims remain in dispute under the fixture’s one-operator premise.` : view.assertions.some((claim) => claim.modality === 'planned') ? `${names}: a published plan. Passing the planned start date does not confirm that the event occurred.` : `${names}: supported by the currently published report for this claim date.`);
    const cards = el('div', 'demo-grid');
    for (const claim of view.assertions) {
      const card = el('article', 'demo-card');
      card.append(el('span', 'demo-pill', view.disputed ? 'Reported · disputed' : words(claim.modality)), el('h4', '', `${claim.subject_label} → ${claim.object_label}`));
      card.append(label(`${date(claim.valid_from)} → ${date(claim.valid_to)}${claim.valid_to ? ' (end excluded)' : ''}`));
      card.append(sourceBox(`Exact assertion · ${claim.assertion_id}`, claim.text, `${claim.document_id} / ${claim.version_id}`));
      card.append(el('p', 'demo-explanation', `Source available ${date(claim.source_available_at)}; published to knowledge ${date(claim.published_at)}.`));
      if (claim.supersedes.length) card.append(label(`Supersedes: ${claim.supersedes.join(', ')}`));
      cards.append(card);
    }
    results.replaceChildren(explanation, cards, el('p', 'demo-explanation', 'Knowledge time chooses the published document versions. Claim time filters their half-open validity intervals. An open end means no stated end, not guaranteed persistence.'));
  }
  render();
}

const demos = {
  '01-sensemaking': sensemaking,
  '02-311-analytics': serviceRequests,
  '03-semantic-discovery': specifications,
  '04-org-knowledge-graphs': organization,
  '05-graphrag-discovery': temporal,
};

async function mount(root) {
  if (root.dataset.demoMounted) return;
  root.dataset.demoMounted = 'true';
  const slug = root.dataset.scadsDemo;
  try {
    if (!Object.hasOwn(demos, slug)) throw new Error('Unknown demo');
    const response = await fetch(`/data/scads/${slug}.json`);
    if (!response.ok) throw new Error('Dataset unavailable');
    demos[slug](root, await response.json());
  } catch {
    status(root, 'The bundled demo could not load. Reload this page to try again.');
    root.querySelector('[data-demo-results]').append(empty('The demo data and source fingerprints remain available below.'));
  }
}

function mountAll() { document.querySelectorAll('[data-scads-demo]').forEach(mount); }
if (typeof document !== 'undefined') {
  mountAll();
  document.addEventListener('astro:page-load', mountAll);
}
