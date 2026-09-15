const data = JSON.parse(document.getElementById('dataset').textContent);
const el = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const link = (url, text = url) => /^https?:\/\//i.test(url) ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(text)}</a>` : escape(text);
const grades = {
  A: ['Official record', 'Strong provenance for the stated official record, not proof that every allegation or identity match is correct.'],
  B: ['Bounded evidence', 'Source-linked records or documented technical checks. Check dates, coverage, and the claim being made.'],
  C: ['Lead source', 'May suggest where to investigate. Confirm an identity or relationship against an original record.'],
  D: ['Heightened caution', 'A cited finding gives a specific reason for caution. Read its date and scope; it is not a blanket claim about every result.'],
  'C-P': ['Provisional lead', 'Based on saved metadata only. Provider behavior and current results have not been independently verified.'],
  U: ['Not verified', 'Not enough verified evidence for a rating. This does not mean the service is unreliable or unsafe.'],
  'N/A': ['Not evidence', 'A utility, guide, or other resource that does not establish connections. This is not a quality or security score.'],
};
const gradeOrder = Object.keys(grades);
const badge = grade => `<span class="badge g${grade.replace(/[^A-Z]/g, '')}" title="${escape(grades[grade]?.[1])}">${escape(grade)}</span>`;
const collator = new Intl.Collator('en', {numeric:true, sensitivity:'base'});
const priorities = new Set([357,359,1130,440,293,1061,1063,1086,654,661,381,324,190]);
const sortLabels = {id:'ID', name:'Resource', category:'Original section', grade:'Grade', purpose:'Purpose'};
let mode = '', sortKey = 'id', direction = 1, timer;

for (const grade of gradeOrder) el('grade').add(new Option(`${grade} · ${grades[grade][0]}`, grade));
for (const basis of [...new Set(data.map(row => row.basis))].sort()) el('basis').add(new Option(basis, basis));
for (const category of [...new Set(data.map(row => row.category))].sort()) el('category').add(new Option(category, category));
el('legend').innerHTML = Object.entries(grades).map(([grade, [label, detail]]) => `<div>${badge(grade)}<span><strong>${escape(label)}.</strong> ${escape(detail)}</span></div>`).join('');
const sourceCount = data.filter(row => row.references?.length).length;
el('purpose-coverage').textContent = `Purpose descriptions cover all ${data.length.toLocaleString()} entries. Additional external source notes accompany ${sourceCount} entries. Unchecked functions are marked as such; the original audit grades remain separate from these purpose notes.`;

function details(row) {
  const citations = row.references?.length ? `<strong>Additional sources checked for this edition</strong>${row.references.map(source => `<p>${link(source.url, source.title)}${source.note ? `<br>${escape(source.note)}` : ''}</p>`).join('')}<p class="label">Reviewed 15 September 2026. Documentation is not an independent test of accuracy.</p>` : '';
  return `<details class="row-details"><summary>Evidence &amp; limits</summary><div class="detail-body">
    <strong>Purpose description</strong><p>${escape(row.purposeBasis || 'Saved bookmark')}. ${row.purposeBasis === 'External documentation' ? 'See the cited documentation below.' : 'Describes the saved listing; current functionality has not been tested.'}</p>
    <strong>What the grade covers</strong><p>${escape(row.scope)}</p><p>${escape(row.note)}</p>
    <strong>Original review basis</strong><p>${escape(row.basis)} · ${escape(row.confidence)}</p><p>${escape(row.method)}</p>
    ${row.ratingNote ? `<strong>Additional rating context</strong><p>${escape(row.ratingNote)}</p>` : ''}
    ${citations}
    <strong>Original audit evidence ${escape(row.source_ids)}</strong>${row.source_urls ? row.source_urls.split('\n').filter(Boolean).map(url => `<p class="url">${link(url)}</p>`).join('') : '<p>No external source reviewed for the original classification.</p>'}
    <strong>Availability noted in the original audit</strong><p>${escape(row.availability)}</p>
    <strong>Recommended use</strong><p>${escape(row.action)}</p>
    <strong>Inventory trace</strong><p>Bookmark ${escape(row.bookmark_id)} · HTML line ${escape(row.source_line)} · ${escape(row.exact_url_occurrences)} exact-URL occurrence(s)</p>
    <p>Original check: ${escape(row.checked_on || 'Not checked')} · Position in section: ${escape(row.position)}</p>
    <p>Saved description: ${escape(row.description)}</p>
  </div></details>`;
}

// Keep each row's disclosure state while sorting; build the large directory only once.
el('rows').innerHTML = data.map(row => `<tr id="r${row.id}">
  <td class="resource-id">${row.id}</td>
  <td><div class="name">${link(row.url, row.name)}</div><div class="url">${escape(row.domain)}</div></td>
  <td class="section-name">${escape(row.category)}</td>
  <td>${badge(row.grade)}<span class="grade-label">${escape(grades[row.grade]?.[0])}</span></td>
  <td><p class="purpose">${escape(row.purpose)}</p>${details(row)}</td>
</tr>`).join('');
const rowElements = new Map([...el('rows').children].map(row => [Number(row.id.slice(1)), row]));

function draw() {
  const query = el('q').value.trim().toLowerCase(), grade = el('grade').value, basis = el('basis').value, category = el('category').value;
  const filtered = data.filter(row => (!grade || row.grade === grade) && (!basis || row.basis === basis) && (!category || row.category === category)
    && (!mode || (mode === 'contacts' ? row.priority === 'Contacts / records' : mode === 'sources' ? row.references?.length : priorities.has(row.id)))
    && (!query || [row.id,row.bookmark_id,row.name,row.category,row.url,row.purpose,row.scope,row.note,row.availability,row.ratingNote].join(' ').toLowerCase().includes(query)));
  filtered.sort((a,b) => direction * (sortKey === 'id' ? a.id - b.id : sortKey === 'grade' ? gradeOrder.indexOf(a.grade) - gradeOrder.indexOf(b.grade) : collator.compare(a[sortKey] || '', b[sortKey] || '')) || a.id - b.id);
  const modeLabel = {contacts:'Contact / record view', sources:'Additional source notes', fixes:'Priority findings'}[mode];
  el('count').textContent = `${filtered.length.toLocaleString()} of ${data.length.toLocaleString()} bookmarks shown${modeLabel ? ` · ${modeLabel}` : ''} · Sorted by ${sortLabels[sortKey]}, ${direction === 1 ? 'ascending' : 'descending'}`;
  for (const [id, active] of [['documented',basis === 'Documented'],['contacts',mode === 'contacts'],['sources',mode === 'sources'],['fixes',mode === 'fixes']]) el(id).setAttribute('aria-pressed', String(active));
  el('rows').replaceChildren(...filtered.map(row => rowElements.get(row.id)));
  if (!filtered.length) el('rows').innerHTML = '<tr><td colspan="5" class="empty">No matching resources. Try a different search or reset the filters.</td></tr>';
  for (const button of document.querySelectorAll('[data-sort]')) {
    const active = button.dataset.sort === sortKey;
    button.closest('th').setAttribute('aria-sort', active ? direction === 1 ? 'ascending' : 'descending' : 'none');
    button.querySelector('.sort-arrow').textContent = active ? direction === 1 ? '↑' : '↓' : '↕';
  }
}

function reset() {
  clearTimeout(timer);
  for (const id of ['q','grade','basis','category']) el(id).value = '';
  mode = ''; sortKey = 'id'; direction = 1;
}
el('q').addEventListener('input', () => {clearTimeout(timer);timer = setTimeout(draw,150);});
for (const id of ['grade','basis','category']) el(id).addEventListener('change',draw);
el('documented').onclick = () => {const active = el('basis').value === 'Documented';reset();if (!active) el('basis').value = 'Documented';draw();};
for (const [id, selected] of [['contacts','contacts'],['fixes','fixes'],['sources','sources']]) el(id).onclick = () => {const active = mode === selected;reset();if (!active) mode = selected;draw();};
el('reset').onclick = () => {reset();draw();};
for (const button of document.querySelectorAll('[data-sort]')) button.addEventListener('click', () => {
  if (sortKey === button.dataset.sort) direction *= -1;
  else {sortKey = button.dataset.sort;direction = 1;}
  draw();
});
draw();
// A row permalink opens its evidence, instead of treating the ID as a substring search.
if (/^#r\d+$/.test(location.hash)) {
  const row = document.getElementById(location.hash.slice(1));
  if (row) {row.querySelector('details').open = true;row.scrollIntoView();}
}
