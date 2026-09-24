const OUTCOMES = ['core', 'broad', 'all'];
const CATEGORIES = ['all', 'core', 'drug', 'property', 'violence', 'weapons', 'driving'];
const TEMPERATURES = ['high10', 'mean10', 'low10'];
const COLUMNS = [...OUTCOMES, ...TEMPERATURES, 'heatwave'];
const LABELS = ['<60', '60–69', '70–79', '80–89', '90+'];
const DAY_MS = 86_400_000;

function invalid(message) {
  throw new TypeError(`Invalid daily panel: ${message}`);
}

function validateAxes(panel) {
  if (!panel || typeof panel !== 'object' || Array.isArray(panel)) invalid('expected an object');
  if (panel.schema_version !== '1.0.0' || panel.layout !== 'zip-major-column-arrays') {
    invalid('unsupported schema or layout');
  }
  if (!Array.isArray(panel.dates) || !panel.dates.length) invalid('dates must be a nonempty array');
  let previousTime;
  for (const date of panel.dates) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) invalid('date must be YYYY-MM-DD');
    const time = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) invalid('invalid calendar date');
    if (previousTime !== undefined && time !== previousTime + DAY_MS) {
      invalid('dates must be consecutive, unique and ascending');
    }
    previousTime = time;
  }
  if (!Array.isArray(panel.zips) || !panel.zips.length ||
      panel.zips.some((zip) => typeof zip !== 'string' || !/^\d{5}$/.test(zip)) ||
      new Set(panel.zips).size !== panel.zips.length) {
    invalid('ZIPs must be unique five-digit strings');
  }
  for (const flag of ['raw_source_present_by_date', 'incomplete_export_by_date', 'primary_period_by_date']) {
    if (panel[flag] !== undefined && (!Array.isArray(panel[flag]) || panel[flag].length !== panel.dates.length ||
        panel[flag].some((value) => value !== 0 && value !== 1))) invalid(`${flag} must contain one binary flag per date`);
  }
}

function namedColumns(panel, names) {
  if (!Array.isArray(panel.columns) || panel.columns.length !== names.length ||
      new Set(panel.columns).size !== names.length || names.some((name) => !panel.columns.includes(name)) ||
      !Array.isArray(panel.data) || panel.data.length !== names.length) {
    invalid('expected the seven named column arrays');
  }
  const size = panel.dates.length * panel.zips.length;
  const columns = Object.fromEntries(panel.columns.map((name, index) => [name, panel.data[index]]));
  for (const name of names) {
    const values = columns[name];
    if (!Array.isArray(values) || values.length !== size) invalid(`${name} has the wrong length`);
  }
  return columns;
}

function validatePanel(panel) {
  validateAxes(panel);
  if (panel.temperature_scale !== 10 || panel.temperature_unit !== 'F') {
    invalid('temperatures must be Fahrenheit encoded in tenths');
  }
  const columns = namedColumns(panel, COLUMNS);
  const size = panel.dates.length * panel.zips.length;
  for (const name of COLUMNS) {
    const values = columns[name];
    for (const value of values) {
      if (TEMPERATURES.includes(name)) {
        if (value !== null && !Number.isSafeInteger(value)) invalid(`${name} must contain integer tenths or null`);
      } else if (!Number.isSafeInteger(value) || value < 0 || (name === 'heatwave' && value > 1)) {
        invalid(`${name} must contain nonnegative integer counts or binary heatwave flags`);
      }
    }
  }
  for (let index = 0; index < size; index += 1) {
    if (columns.core[index] > columns.broad[index] || columns.broad[index] > columns.all[index]) {
      invalid('counts must satisfy core <= broad <= all');
    }
    const high = columns.high10[index];
    const mean = columns.mean10[index];
    const low = columns.low10[index];
    if ((high !== null && mean !== null && mean > high) ||
        (mean !== null && low !== null && low > mean) ||
        (high !== null && low !== null && low > high)) invalid('temperatures must satisfy low <= mean <= high');
  }
  return columns;
}

function validateCategoryPanel(panel, weatherPanel, weatherColumns) {
  validateAxes(panel);
  for (const axis of ['dates', 'zips']) {
    if (panel[axis].length !== weatherPanel[axis].length ||
        panel[axis].some((value, index) => value !== weatherPanel[axis][index])) {
      invalid(`category and weather ${axis} axes must match exactly`);
    }
  }
  const columns = namedColumns(panel, CATEGORIES);
  for (const name of CATEGORIES) {
    for (let index = 0; index < columns[name].length; index += 1) {
      const value = columns[name][index];
      if (!Number.isSafeInteger(value) || value < 0) invalid(`${name} must contain nonnegative integer counts`);
      if (value > columns.all[index]) invalid('each category count must be <= all');
      if ((name === 'all' || name === 'core') && value !== weatherColumns[name][index]) {
        invalid(`category and weather ${name} counts must match exactly`);
      }
    }
  }
  return columns;
}

function validateOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Options must be an object');
}

/**
 * Summarize the public ZIP-major daily panel without changing it.
 * Rates are counts per 100 ZIP-days, not per resident. Overall ZIP-days include
 * every selected cell; a null chosen temperature excludes that cell's count and
 * denominator from temperature bins only. Empty-bin rates and means are null.
 * Daily temperatures are unweighted means of non-null ZIP-point temperatures.
 * Export-completeness flags are not a filter: the caller must display warnings.
 */
export function summarizeDaily(panel, options = {}) {
  const columns = validatePanel(panel);
  validateOptions(options);
  const { outcome = 'core' } = options;
  if (!OUTCOMES.includes(outcome)) throw new RangeError('Outcome must be core, broad or all');
  return summarizeCounts(panel, columns, columns[outcome], options);
}

/**
 * Summarize one possibly overlapping crime category against the weather panel.
 * Both panels must have identical date/ZIP axes and matching all/core counts.
 * Categories are not mutually exclusive; their counts must not be added together.
 * Denominators, missing-weather handling and output shape match summarizeDaily.
 */
export function summarizeCategoryDaily(weatherPanel, categoryPanel, options = {}) {
  const weatherColumns = validatePanel(weatherPanel);
  const categoryColumns = validateCategoryPanel(categoryPanel, weatherPanel, weatherColumns);
  validateOptions(options);
  const { category = 'all' } = options;
  if (!CATEGORIES.includes(category)) throw new RangeError(`Category must be one of ${CATEGORIES.join(', ')}`);
  return summarizeCounts(weatherPanel, weatherColumns, categoryColumns[category], options);
}

function summarizeCounts(panel, columns, selectedCounts, options) {
  const { zip = 'all', startYear = 2021, endYear = 2024, temperature = 'high10' } = options;
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) ||
      startYear < 1000 || endYear > 9999 || startYear > endYear) {
    throw new RangeError('Years must be ordered integers from 1000 through 9999');
  }
  if (!TEMPERATURES.includes(temperature)) throw new RangeError('Temperature must be high10, mean10 or low10');
  if (zip !== 'all' && !panel.zips.includes(zip)) throw new RangeError('ZIP is not present in this panel');

  const zipIndices = zip === 'all' ? panel.zips.map((_, index) => index) : [panel.zips.indexOf(zip)];
  const dateIndices = [];
  for (let index = 0; index < panel.dates.length; index += 1) {
    const year = Number(panel.dates[index].slice(0, 4));
    if (year >= startYear && year <= endYear) dateIndices.push(index);
  }
  const bins = LABELS.map((label) => ({ label, zipDays: 0, count: 0, temperatureSum: 0 }));
  const daily = [];
  let totalCount = 0;
  for (const dateIndex of dateIndices) {
    let count = 0;
    const sums = [0, 0, 0];
    const valid = [0, 0, 0];
    for (const zipIndex of zipIndices) {
      const index = zipIndex * panel.dates.length + dateIndex;
      const value = selectedCounts[index];
      count += value;
      for (let metric = 0; metric < TEMPERATURES.length; metric += 1) {
        const encoded = columns[TEMPERATURES[metric]][index];
        if (encoded !== null) {
          sums[metric] += encoded;
          valid[metric] += 1;
        }
      }
      const encoded = columns[temperature][index];
      if (encoded !== null) {
        const binIndex = encoded < 600 ? 0 : encoded < 700 ? 1 : encoded < 800 ? 2 : encoded < 900 ? 3 : 4;
        const bin = bins[binIndex];
        bin.zipDays += 1;
        bin.count += value;
        bin.temperatureSum += encoded;
      }
    }
    totalCount += count;
    const means = sums.map((sum, index) => valid[index] ? sum / valid[index] / 10 : null);
    daily.push({ date: panel.dates[dateIndex], count, high: means[0], mean: means[1], low: means[2], zipDays: zipIndices.length });
  }
  return {
    bins: bins.map(({ label, zipDays, count, temperatureSum }) => ({
      label, zipDays, count,
      rate: zipDays ? 100 * count / zipDays : null,
      temperatureMean: zipDays ? temperatureSum / zipDays / 10 : null,
    })),
    daily, totalCount,
    zipDays: dateIndices.length * zipIndices.length,
    dateDays: dateIndices.length,
    zipCount: zipIndices.length,
  };
}
