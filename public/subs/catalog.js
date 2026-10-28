(() => {
  'use strict';
  const search = document.getElementById('catalog-search');
  const country = document.getElementById('catalog-country');
  const clear = document.getElementById('catalog-clear');
  const previous = document.getElementById('catalog-previous');
  const next = document.getElementById('catalog-next');
  const results = document.getElementById('catalog-results');
  const pageLabel = document.getElementById('catalog-page');
  const empty = document.getElementById('catalog-empty');
  const normalize = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('en').trim();
  const rows = [...document.querySelectorAll('#catalog-rows tr')].map(element => ({
    element,
    text: normalize(`${element.dataset.type} ${element.dataset.country}`),
    countries: element.dataset.country.split(' / '),
  }));
  const pageSize = 50;
  let page = 0;

  function render() {
    const terms = normalize(search.value).split(/\s+/).filter(Boolean);
    const matching = rows.filter(row => (!country.value || row.countries.includes(country.value)) && terms.every(term => row.text.includes(term)));
    const pages = Math.max(1, Math.ceil(matching.length / pageSize));
    page = Math.min(page, pages - 1);
    rows.forEach(row => { row.element.hidden = true; });
    matching.slice(page * pageSize, (page + 1) * pageSize).forEach(row => { row.element.hidden = false; });
    empty.hidden = matching.length !== 0;
    results.textContent = matching.length
      ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, matching.length)} of ${matching.length} designs${matching.length !== rows.length ? ` · ${rows.length} total` : ''}`
      : `0 matching designs · ${rows.length} total`;
    pageLabel.textContent = `Page ${page + 1} of ${pages}`;
    previous.disabled = page === 0;
    next.disabled = page >= pages - 1;
    clear.disabled = !search.value && !country.value;
  }
  function filter() { page = 0; render(); }
  search.addEventListener('input', filter);
  country.addEventListener('change', filter);
  clear.addEventListener('click', () => { search.value = ''; country.value = ''; filter(); search.focus(); });
  previous.addEventListener('click', () => { if (page > 0) { page--; render(); results.scrollIntoView({ block: 'start' }); } });
  next.addEventListener('click', () => { if (!next.disabled) { page++; render(); results.scrollIntoView({ block: 'start' }); } });

  const sources = document.getElementById('sources');
  document.getElementById('open-sources').addEventListener('click', event => { event.preventDefault(); sources.showModal(); });
  document.getElementById('close-sources').addEventListener('click', () => sources.close());
  render();
})();
