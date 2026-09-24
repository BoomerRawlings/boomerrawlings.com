import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeDaily, summarizeCategoryDaily } from '../src/lib/analysis-data.mjs';

function panel({ dates = ['2021-01-01'], zips = ['91901'], core = [0], broad = core, all = broad,
  high = core.map(() => 700), mean = high.map((value) => value === null ? null : value - 100),
  low = mean.map((value) => value === null ? null : value - 100) } = {}) {
  return {
    schema_version: '1.0.0', layout: 'zip-major-column-arrays', temperature_scale: 10, temperature_unit: 'F',
    dates, zips, columns: ['core', 'broad', 'all', 'high10', 'mean10', 'low10', 'heatwave'],
    data: [[...core], [...broad], [...all], [...high], [...mean], [...low], core.map(() => 0)],
  };
}

function categoryPanel(weather, overrides = {}) {
  const weatherColumns = Object.fromEntries(weather.columns.map((name, index) => [name, weather.data[index]]));
  const columns = ['all', 'core', 'drug', 'property', 'violence', 'weapons', 'driving'];
  return {
    schema_version: '1.0.0', layout: 'zip-major-column-arrays',
    dates: [...weather.dates], zips: [...weather.zips], columns,
    data: columns.map((name) => [...(overrides[name] ?? weatherColumns[name] ?? weatherColumns.all.map(() => 0))]),
  };
}

test('ZIP-major indexing, zero cells, inclusive year filtering and unweighted weather', () => {
  const input = panel({
    dates: ['2020-12-31', '2021-01-01', '2021-01-02'], zips: ['91901', '92071'],
    core: [1, 0, 2, 100, 4, 0], high: [500, 600, 700, 900, 1000, 1100],
  });
  const before = structuredClone(input);
  const result = summarizeDaily(input, { startYear: 2020, endYear: 2021 });
  assert.equal(result.totalCount, 107);
  assert.equal(result.zipDays, 6);
  assert.equal(result.dateDays, 3);
  assert.equal(result.zipCount, 2);
  assert.deepEqual(result.daily, [
    { date: '2020-12-31', count: 101, high: 70, mean: 60, low: 50, zipDays: 2 },
    { date: '2021-01-01', count: 4, high: 80, mean: 70, low: 60, zipDays: 2 },
    { date: '2021-01-02', count: 2, high: 90, mean: 80, low: 70, zipDays: 2 },
  ]);
  assert.equal(result.bins[4].zipDays, 3);
  assert.equal(result.bins[4].count, 104);
  assert.equal(result.bins[4].rate, 100 * 104 / 3);
  const year = summarizeDaily(input, { startYear: 2021, endYear: 2021 });
  assert.equal(year.totalCount, 6);
  assert.equal(year.zipDays, 4);
  assert.equal(year.dateDays, 2);
  const locality = summarizeDaily(input, { zip: '92071', startYear: 2021, endYear: 2021 });
  assert.equal(locality.totalCount, 4);
  assert.equal(locality.zipDays, 2);
  assert.equal(locality.zipCount, 1);
  assert.equal(locality.daily[1].count, 0);
  assert.equal(locality.bins[4].rate, 200);
  assert.deepEqual(input, before);
});

test('each exact temperature boundary uses the correct bin, including 100+ in 90+', () => {
  const input = panel({
    dates: Array.from({ length: 10 }, (_, index) => `2021-01-${String(index + 1).padStart(2, '0')}`),
    core: [0, 1, 0, 2, 0, 3, 0, 4, 0, 5],
    high: [599, 600, 699, 700, 799, 800, 899, 900, 999, 1000],
  });
  const result = summarizeDaily(input);
  assert.deepEqual(result.bins.map(({ label, zipDays, count, rate }) => ({ label, zipDays, count, rate })), [
    { label: '<60', zipDays: 1, count: 0, rate: 0 },
    { label: '60–69', zipDays: 2, count: 1, rate: 50 },
    { label: '70–79', zipDays: 2, count: 2, rate: 100 },
    { label: '80–89', zipDays: 2, count: 3, rate: 150 },
    { label: '90+', zipDays: 3, count: 9, rate: 300 },
  ]);
  assert.equal(result.bins[1].temperatureMean, 64.95);
  assert.equal(result.totalCount, 15);
  assert.equal(result.zipDays, 10);
});

test('alternate outcome and weather selection use their named columns', () => {
  const input = panel({ core: [1], broad: [2], all: [10], high: [900], mean: [750], low: [590] });
  const mean = summarizeDaily(input, { outcome: 'broad', temperature: 'mean10' });
  assert.equal(mean.totalCount, 2);
  assert.equal(mean.bins[2].count, 2);
  assert.equal(mean.bins[2].temperatureMean, 75);
  const low = summarizeDaily(input, { outcome: 'all', temperature: 'low10' });
  assert.equal(low.totalCount, 10);
  assert.equal(low.bins[0].count, 10);
  input.columns.reverse();
  input.data.reverse();
  assert.deepEqual(summarizeDaily(input, { outcome: 'all', temperature: 'low10' }), low);
});

test('missing weather excludes both bin numerator and denominator, never becomes zero', () => {
  const input = panel({ zips: ['91901', '92071'], core: [9, 0], high: [null, 700], mean: [null, 600], low: [null, 500] });
  const result = summarizeDaily(input);
  assert.equal(result.totalCount, 9);
  assert.equal(result.zipDays, 2);
  assert.equal(result.bins.reduce((sum, bin) => sum + bin.zipDays, 0), 1);
  assert.equal(result.bins.reduce((sum, bin) => sum + bin.count, 0), 0);
  assert.equal(result.bins[0].rate, null);
  assert.equal(result.bins[0].temperatureMean, null);
  assert.deepEqual(result.daily[0], { date: '2021-01-01', count: 9, high: 70, mean: 60, low: 50, zipDays: 2 });
  assert.deepEqual(summarizeDaily(input, { zip: '91901' }).daily[0], {
    date: '2021-01-01', count: 9, high: null, mean: null, low: null, zipDays: 1,
  });
});

test('actual date span is preserved; out-of-range years do not fabricate days', () => {
  const input = panel({ dates: ['2018-07-01'] });
  const included = summarizeDaily(input, { startYear: 2018, endYear: 2018 });
  assert.equal(included.dateDays, 1);
  assert.equal(included.daily[0].date, '2018-07-01');
  const empty = summarizeDaily(input, { startYear: 2019, endYear: 2020 });
  assert.deepEqual(empty.daily, []);
  assert.equal(empty.zipDays, 0);
  assert.equal(empty.totalCount, 0);
  assert.equal(empty.dateDays, 0);
  assert.equal(empty.zipCount, 1);
  assert.ok(empty.bins.every((bin) => bin.zipDays === 0 && bin.rate === null));
});

test('each daily weather mean has its own non-null denominator', () => {
  const input = panel({
    zips: ['91901', '92071'], core: [5, 0], high: [900, 1100], mean: [750, null], low: [null, 500],
  });
  const result = summarizeDaily(input, { temperature: 'mean10' });
  assert.deepEqual(result.daily[0], { date: '2021-01-01', count: 5, high: 100, mean: 75, low: 50, zipDays: 2 });
  assert.equal(result.bins[2].zipDays, 1);
  assert.equal(result.bins[2].count, 5);
  assert.equal(result.bins[2].rate, 500);
});

test('all ZIPs includes areas whose selected outcome is always zero', () => {
  const input = panel({ zips: ['91901', '92071', '92101'], core: [1, 0, 0], high: [700, 800, 900] });
  const result = summarizeDaily(input, { zip: 'all' });
  assert.equal(result.zipCount, 3);
  assert.equal(result.zipDays, 3);
  assert.equal(result.daily[0].high, 80);
  assert.equal(result.bins[3].zipDays, 1);
  assert.equal(result.bins[3].rate, 0);
  assert.equal(result.bins[4].zipDays, 1);
});

test('source-completeness flags do not silently filter the chosen period', () => {
  const input = panel({ dates: ['2025-01-01'] });
  input.raw_source_present_by_date = [0];
  input.incomplete_export_by_date = [1];
  assert.equal(summarizeDaily(input, { startYear: 2025, endYear: 2025 }).zipDays, 1);
});

test('invalid options are rejected instead of silently changing the requested population', () => {
  for (const options of [null, [], { zip: '99999' }, { zip: 91901 }, { startYear: '2021' },
    { startYear: 2025, endYear: 2024 }, { startYear: NaN }, { endYear: Infinity },
    { startYear: 999 }, { endYear: 10000 }, { outcome: 'arrests' }, { temperature: 'high' }]) {
    assert.throws(() => summarizeDaily(panel(), options));
  }
});

test('malformed payloads and invalid unselected cells are rejected', () => {
  const changes = [
    (p) => { p.layout = 'date-major'; }, (p) => { p.schema_version = '2.0.0'; },
    (p) => { p.temperature_scale = 1; }, (p) => { p.temperature_unit = 'C'; },
    (p) => { p.dates = []; }, (p) => { p.dates[0] = '2021-02-30'; },
    (p) => { p.zips[0] = 91901; }, (p) => { p.zips.push('91901'); },
    (p) => { p.columns[0] = 'broad'; }, (p) => { p.data[0] = []; },
    (p) => { p.data[0][0] = -1; }, (p) => { p.data[0][0] = 1; },
    (p) => { p.data[3][0] = NaN; }, (p) => { p.data[3][0] = Infinity; },
    (p) => { p.data[3][0] = '700'; }, (p) => { p.data[3][0] = 700.5; },
    (p) => { p.data[5][0] = 900; }, (p) => { p.data[6][0] = 2; },
    (p) => { p.raw_source_present_by_date = []; },
  ];
  for (const change of changes) {
    const input = panel();
    change(input);
    assert.throws(() => summarizeDaily(input, { startYear: 2024, endYear: 2024 }), TypeError);
  }
  assert.throws(() => summarizeDaily(null), TypeError);
  for (const dates of [['2021-01-01', '2021-01-01'], ['2021-01-02', '2021-01-01'], ['2021-01-01', '2021-01-03']]) {
    assert.throws(() => summarizeDaily(panel({ dates, core: [0, 0] })), /consecutive/);
  }
});

test('category selection shares ZIP/year/weather aggregation without changing DV meanings', () => {
  const weather = panel({
    dates: ['2020-12-31', '2021-01-01', '2021-01-02'], zips: ['91901', '92071'],
    core: [1, 0, 2, 1, 1, 0], all: [5, 5, 5, 5, 5, 5],
    high: [500, 600, 700, 900, 1000, 1100],
  });
  const categories = categoryPanel(weather, { drug: [4, 3, 2, 1, 0, 5] });
  const before = structuredClone({ weather, categories });
  assert.deepEqual(summarizeCategoryDaily(weather, categories), summarizeDaily(weather, { outcome: 'all' }));
  assert.deepEqual(summarizeCategoryDaily(weather, categories, { category: 'core' }), summarizeDaily(weather));
  const result = summarizeCategoryDaily(weather, categories, {
    category: 'drug', zip: '92071', startYear: 2021, endYear: 2021, temperature: 'low10',
  });
  assert.equal(result.totalCount, 5);
  assert.equal(result.zipDays, 2);
  assert.equal(result.dateDays, 2);
  assert.equal(result.zipCount, 1);
  assert.deepEqual(result.daily, [
    { date: '2021-01-01', count: 0, high: 100, mean: 90, low: 80, zipDays: 1 },
    { date: '2021-01-02', count: 5, high: 110, mean: 100, low: 90, zipDays: 1 },
  ]);
  assert.equal(result.bins[3].rate, 0);
  assert.equal(result.bins[4].rate, 500);
  assert.deepEqual({ weather, categories }, before);
  categories.columns.reverse();
  categories.data.reverse();
  weather.columns.reverse();
  weather.data.reverse();
  assert.deepEqual(summarizeCategoryDaily(weather, categories, {
    category: 'drug', zip: '92071', startYear: 2021, endYear: 2021, temperature: 'low10',
  }), result);
});

test('crime categories may overlap and their sum need not equal or fall below all', () => {
  const weather = panel({ core: [4], all: [5] });
  const categories = categoryPanel(weather, {
    drug: [4], property: [4], violence: [4], weapons: [4], driving: [4],
  });
  for (const category of categories.columns) {
    const result = summarizeCategoryDaily(weather, categories, { category });
    assert.equal(result.totalCount, category === 'all' ? 5 : 4);
    assert.equal(result.zipDays, 1);
  }
});

test('category zero cells remain in denominators; missing or empty exposure bins remain null', () => {
  const weather = panel({
    dates: ['2021-01-01', '2021-01-02'], zips: ['91901', '92071'],
    core: [0, 0, 0, 0], all: [2, 0, 0, 0], high: [null, 700, 800, 900],
  });
  const categories = categoryPanel(weather, { property: [2, 0, 0, 0] });
  const result = summarizeCategoryDaily(weather, categories, { category: 'property' });
  assert.equal(result.totalCount, 2);
  assert.equal(result.zipDays, 4);
  assert.deepEqual(result.daily.map(({ count, zipDays }) => ({ count, zipDays })), [
    { count: 2, zipDays: 2 }, { count: 0, zipDays: 2 },
  ]);
  assert.equal(result.bins.reduce((sum, bin) => sum + bin.zipDays, 0), 3);
  assert.equal(result.bins.reduce((sum, bin) => sum + bin.count, 0), 0);
  assert.ok(result.bins.slice(0, 2).every((bin) => bin.rate === null && bin.temperatureMean === null));
  assert.ok(result.bins.slice(2).every((bin) => bin.rate === 0));
  const allZero = summarizeCategoryDaily(weather, categories, { category: 'weapons' });
  assert.equal(allZero.totalCount, 0);
  assert.equal(allZero.zipDays, 4);
  const outside = summarizeCategoryDaily(weather, categories, { category: 'property', startYear: 2022 });
  assert.deepEqual(outside.daily, []);
  assert.equal(outside.zipDays, 0);
  assert.equal(outside.dateDays, 0);
  assert.equal(outside.zipCount, 2);
  assert.ok(outside.bins.every((bin) => bin.count === 0 && bin.zipDays === 0 && bin.rate === null && bin.temperatureMean === null));
});

test('category axes must match weather axes in both membership and order', () => {
  const weather = panel({
    dates: ['2021-01-01', '2021-01-02'], zips: ['91901', '92071'], core: [0, 0, 0, 0],
  });
  for (const change of [
    (p) => { p.dates = ['2021-01-02', '2021-01-03']; },
    (p) => { p.dates = ['2021-01-01']; },
    (p) => { p.zips.reverse(); },
    (p) => { p.zips[1] = '92101'; },
    (p) => { p.zips.pop(); },
  ]) {
    const categories = categoryPanel(weather);
    change(categories);
    assert.throws(() => summarizeCategoryDaily(weather, categories), /axes must match exactly/);
  }
});

test('category validation checks all cells, count bounds and shared baseline equality', () => {
  const weather = panel({ dates: ['2021-01-01', '2021-01-02'], core: [1, 0], all: [5, 5] });
  const changes = [
    (p) => { p.layout = 'date-major'; },
    (p) => { p.schema_version = '2.0.0'; },
    (p) => { p.columns[2] = 'core'; },
    (p) => { p.data[2] = [0]; },
    (p) => { p.data[2][1] = -1; },
    (p) => { p.data[2][1] = 0.5; },
    (p) => { p.data[2][1] = null; },
    (p) => { p.data[2][1] = NaN; },
    (p) => { p.data[2][1] = Infinity; },
    (p) => { p.data[2][1] = '1'; },
    (p) => { p.data[2][1] = Number.MAX_SAFE_INTEGER + 1; },
    (p) => { p.data[2][1] = 6; },
    (p) => { p.data[0][1] = 4; },
    (p) => { p.data[1][1] = 1; },
  ];
  for (const change of changes) {
    const categories = categoryPanel(weather);
    change(categories);
    assert.throws(() => summarizeCategoryDaily(weather, categories, {
      category: 'weapons', startYear: 2024, endYear: 2024,
    }), TypeError);
  }
  const tooMany = categoryPanel(weather, { violence: [6, 0] });
  assert.throws(() => summarizeCategoryDaily(weather, tooMany), /each category count must be <= all/);
  const changedAll = categoryPanel(weather, { all: [4, 5] });
  assert.throws(() => summarizeCategoryDaily(weather, changedAll), /weather all counts must match exactly/);
  const changedCore = categoryPanel(weather, { core: [0, 0] });
  assert.throws(() => summarizeCategoryDaily(weather, changedCore), /weather core counts must match exactly/);
  assert.throws(() => summarizeCategoryDaily(weather, null), TypeError);
  const badWeather = structuredClone(weather);
  badWeather.data[3][0] = '700';
  assert.throws(() => summarizeCategoryDaily(badWeather, categoryPanel(weather)), TypeError);
});

test('category options reject unknown categories and invalid population or weather selections', () => {
  const weather = panel();
  const categories = categoryPanel(weather);
  for (const options of [null, [], { category: 'broad' }, { category: 'unknown' }, { category: null },
    { zip: '99999' }, { zip: 91901 }, { startYear: '2021' }, { startYear: 2025, endYear: 2024 },
    { startYear: NaN }, { endYear: Infinity }, { startYear: 999 }, { endYear: 10000 }, { temperature: 'high' }]) {
    assert.throws(() => summarizeCategoryDaily(weather, categories, options));
  }
});
