// Presentation geometry only. Every score stays in its original analytical units.
const DAY = 86400000;
const clamp = value => Math.max(0, Math.min(1, value));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const clean = value => Number(value.toPrecision(14));

function minimumSpan(metric) {
  if (metric.startsWith('ppi')) return 10;
  if (metric === 'adr' || metric.startsWith('percentile')) return 10;
  if (metric.includes('z_') || metric.startsWith('z')) return 1;
  return 0.1;
}
function tickStep(span) {
  const rough = span / 5, magnitude = 10 ** Math.floor(Math.log10(rough));
  return [1, 2, 2.5, 5, 10].find(value => value * magnitude >= rough) * magnitude;
}

/**
 * All rows share this current-snapshot linear domain. Zoomed bar lengths measure
 * distance above the explicitly labeled baseline, not ratios to an absolute zero.
 * Callers must show the baseline/ticks and retain the untransformed score label.
 * Geometry uses fractions, not percentages; missing values return null.
 */
export function createRaceScale(values, { zoom = true, metric = 'kpr' } = {}) {
  const observed = values.filter(finite);
  if (!observed.length) return { domain: [0, 1], baseline: 0, ticks: [0, 0.5, 1], zoom, empty: true, geometry: () => null };
  const lo = Math.min(...observed), hi = Math.max(...observed);
  const span = Math.max(hi - lo, minimumSpan(metric));
  let lower, upper;
  if (zoom) {
    const middle = (lo + hi) / 2;
    lower = middle - span * 0.7;
    upper = middle + span * 0.7;
  } else {
    lower = lo < 0 ? lo - span * 0.08 : 0;
    upper = hi > 0 ? hi + span * 0.08 : 0;
    if (lower === upper) upper = span;
  }
  const step = tickStep(upper - lower);
  lower = clean(Math.floor(lower / step) * step);
  upper = clean(Math.ceil(upper / step) * step);
  if (metric.startsWith('percentile')) {
    lower = Math.max(0, lower);
    upper = Math.min(100, upper);
  }
  const baseline = zoom ? lower : 0, range = upper - lower;
  const ticks = [];
  for (let i = 0; i <= Math.ceil(range / step); i++) {
    const tick = clean(lower + i * step);
    if (tick <= upper) ticks.push(tick);
  }
  if (ticks.at(-1) !== upper) ticks.push(upper);
  return {
    domain: [lower, upper], baseline, ticks, zoom, empty: false,
    geometry(value) {
      if (!finite(value)) return null;
      const at = clamp((value - lower) / range), origin = clamp((baseline - lower) / range);
      return { left: Math.min(at, origin), width: Math.abs(at - origin) };
    },
  };
}

function timestamp(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new TypeError('Expected an ISO calendar date.');
  const time = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) throw new RangeError('Invalid calendar date.');
  return time;
}
function calendarBounds(start, end) {
  const first = timestamp(start), last = timestamp(end);
  if (last < first) throw new RangeError('Calendar bounds must be chronological.');
  return [first, last];
}

/** Actual elapsed UTC days, including leap days and missing-observation periods. */
export function calendarProgress(date, start, end) {
  const [first, last] = calendarBounds(start, end), current = timestamp(date);
  return last === first ? 0 : clamp((current - first) / (last - first));
}

/**
 * Snap a calendar-fraction cursor to an existing date; never invent a snapshot.
 * Equal distances choose the earlier date. The caller displays that actual date.
 */
export function nearestSnapshotIndex(dates, fraction) {
  if (!dates.length) return -1;
  if (!finite(fraction)) throw new TypeError('Calendar fraction must be finite.');
  const times = dates.map(timestamp);
  if (times.some((time, i) => i && time < times[i - 1])) throw new RangeError('Snapshot dates must be sorted.');
  const target = times[0] + clamp(fraction) * (times.at(-1) - times[0]);
  let low = 0, high = times.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (times[middle] < target) low = middle + 1;
    else high = middle;
  }
  return low > 0 && target - times[low - 1] <= times[low] - target ? low - 1 : low;
}

/** Sparse calendar labels; boundaries plus genuine Jan 1 ticks at calendar positions. */
export function calendarTicks(start, end, { maxTicks = 8 } = {}) {
  const [first, last] = calendarBounds(start, end);
  const firstYear = new Date(first).getUTCFullYear(), lastYear = new Date(last).getUTCFullYear();
  const budget = Math.max(2, Math.floor(maxTicks));
  const yearStep = Math.max(1, Math.ceil((lastYear - firstYear + 1) / Math.max(1, budget - 2)));
  const result = [{ date: start, label: String(firstYear), fraction: 0, kind: 'boundary' }];
  for (let year = firstYear + 1; year <= lastYear && result.length < budget - 1; year += yearStep) {
    const date = `${year}-01-01`, time = timestamp(date);
    if (time > first && time < last && last - first > DAY) result.push({ date, label: String(year), fraction: (time - first) / (last - first), kind: 'year' });
  }
  if (last > first) result.push({ date: end, label: String(lastYear), fraction: 1, kind: 'boundary' });
  return result;
}
