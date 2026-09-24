import { summarizeCategoryDaily } from '../lib/analysis-data.mjs';

type Row = Record<string, any>;
const root = document.querySelector<HTMLElement>('[data-record-explorer]');
const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const select = (id: string) => get<HTMLSelectElement>(id);
const num = (value: number, digits = 0) => Number.isFinite(value)
  ? value.toLocaleString('en-US', {maximumFractionDigits: digits, minimumFractionDigits: digits}) : '—';
const rowsOf = (table: any): Row[] => table.rows.map((row: any[]) => Object.fromEntries(table.columns.map((key: string, i: number) => [key, row[i]])));
const labelOf = (id: string) => select(id).selectedOptions[0].textContent ?? '';

function table(id: string, caption: string, headers: string[], rows: any[][]) {
  const target = get<HTMLTableElement>(id);
  const cap = document.createElement('caption'); cap.textContent = caption;
  const head = document.createElement('thead'); const header = document.createElement('tr');
  headers.forEach(label => {const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; header.append(th);});
  head.append(header);
  const body = document.createElement('tbody');
  rows.forEach(values => {
    const tr = document.createElement('tr');
    values.forEach((value, i) => {const cell = document.createElement(i ? 'td' : 'th'); if (!i) (cell as HTMLTableCellElement).scope = 'row'; cell.textContent = typeof value === 'number' ? num(value, Number.isInteger(value) ? 0 : Math.min(3, String(value).split('.')[1]?.length ?? 0)) : String(value ?? '—'); tr.append(cell);});
    body.append(tr);
  });
  target.replaceChildren(cap, head, body);
}

function bars(id: string, values: {label:string,value:number|null}[], digits = 0) {
  const target = get(id); const maximum = Math.max(...values.map(row => row.value ?? 0), 1);
  target.replaceChildren(); target.hidden = false;
  values.forEach(row => {
    const line = document.createElement('div'); line.className = 'analysis-bar';
    const label = document.createElement('span'); label.className = 'analysis-bar-label'; label.textContent = row.label;
    const track = document.createElement('div'); track.className = 'analysis-bar-track'; track.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('div'); fill.className = 'analysis-bar-fill'; fill.style.width = `${100 * (row.value ?? 0) / maximum}%`; track.append(fill);
    const value = document.createElement('span'); value.className = 'analysis-bar-value'; value.textContent = row.value == null ? '—' : num(row.value, digits);
    line.append(label, track, value); target.append(line);
  });
}

function csvDownload(filename: string, headers: string[], rows: any[][]) {
  const cell = (value: any) => {
    let text = String(value ?? '');
    if (typeof value === 'string' && /^[\s]*[=+@-]/.test(value)) text = "'" + text;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const content = '\uFEFF' + [headers, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([content], {type:'text/csv;charset=utf-8'}));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function fetchJSON(url: string) {
  const response = await fetch(url); if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

if (root) {
  const base = root.dataset.base!;
  const weatherBase = root.dataset.weatherBase!;
  let chargeAggregates: any, categoryAggregates: any, recordRows: any[][] = [], recordHeaders: string[] = [], recordPage = 0;
  let recordCaption = '', recordFile = '';
  const dimension = select('record-dimension'), outcome = select('record-outcome'), year = select('record-year');
  const yearTables: Record<string,string> = {by_city:'by_year_city',by_command:'by_year_command',by_subtype:'by_year_subtype'};
  const labelColumns: Record<string,string> = {by_year:'year',by_month:'month',by_city:'city_normalized',weekday_rates:'weekday',hour_counts_2021_2024:'recorded_hour',by_command:'Command',by_area:'area_normalized',by_zip:'zip_normalized',by_subtype:'Incident Sub Type',by_race:'Race'};

  function pageRecords() {
    const pages = Math.max(1, Math.ceil(recordRows.length / 25));
    recordPage = Math.max(0, Math.min(recordPage, pages - 1));
    table('record-table', recordCaption, recordHeaders, recordRows.slice(recordPage * 25, (recordPage + 1) * 25));
    get('record-page').textContent = `Page ${recordPage + 1} of ${pages} · ${num(recordRows.length)} categories`;
    get<HTMLButtonElement>('record-prev').disabled = recordPage === 0;
    get<HTMLButtonElement>('record-next').disabled = recordPage === pages - 1;
    get('record-pagination').hidden = false;
  }

  function updateRecords() {
    recordPage = 0;
    const dim = dimension.value, isCharge = dim === 'by_charge', isWeekday = dim === 'weekday_rates', isHour = dim === 'hour_counts_2021_2024';
    year.disabled = !(dim === 'by_year' || dim === 'by_month' || yearTables[dim]);
    if (year.disabled) year.value = 'all';
    outcome.disabled = isCharge;
    if (isCharge) outcome.value = 'all';
    const tableName = year.value !== 'all' && yearTables[dim] ? yearTables[dim] : dim;
    const source = (isCharge ? chargeAggregates : categoryAggregates).tables[tableName];
    let rows = rowsOf(source);
    if (year.value !== 'all') rows = rows.filter(r => String(r.year ?? r.month).startsWith(year.value));
    const category = labelColumns[dim];
    const metric = outcome.value;
    const weekdayOrder = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    if (isWeekday) rows.sort((a,b) => weekdayOrder.indexOf(a.weekday) - weekdayOrder.indexOf(b.weekday));
    else if (isHour) rows.sort((a,b) => Number(a.recorded_hour) - Number(b.recorded_hour));
    else if (!['by_year','by_month'].includes(dim)) rows.sort((a,b) => (b[isCharge?'distinct_source_ids':metric] ?? 0) - (a[isCharge?'distinct_source_ids':metric] ?? 0));
    const period = isWeekday || isHour ? '2021–2024' : year.value === 'all' ? 'July 2018–December 2025' : year.value;
    const names = rows.map(r => isCharge ? `${r['Violation Type']} ${r['Violation Section']} · ${r['Violation Description']} · ${r['Charge Level']}` : isHour && /^\d{1,2}$/.test(String(r[category])) ? `${String(r[category]).padStart(2,'0')}:00–${String(r[category]).padStart(2,'0')}:59` : String(r[category]));
    const vals = rows.map(r => isWeekday ? Number(r[metric])/Number(r.calendar_days) : Number(r[isCharge?'distinct_source_ids':metric]));
    recordCaption = `${labelOf('record-dimension').replace(' · 2021–2024','')} · ${period} · ${isCharge?'Charge categories (groups may overlap)':labelOf('record-outcome')}`;
    recordHeaders = isCharge ? ['Charge','Charge level','Source-ID groups','Charge rows','DV classification'] : isWeekday ? ['Weekday','Groups','Calendar days','Groups per day'] : [isHour?'Recorded hour':labelOf('record-dimension'),'Source-ID groups'];
    recordRows = rows.map((r,i) => isCharge ? [`${r['Violation Type']} ${r['Violation Section']} · ${r['Violation Description']}`,r['Charge Level'],r.distinct_source_ids,r.charge_rows,r.classification] : isWeekday ? [names[i],r[metric],r.calendar_days,Number(vals[i].toFixed(3))] : [names[i],r[metric]]);
    recordFile = `records-${dim}-${metric}-${year.value}.csv`;
    bars('record-chart', names.slice(0,12).map((label,i) => ({label,value:vals[i]})), isWeekday ? 2 : 0);
    get('record-chart').setAttribute('aria-label', `${recordCaption}. ${isWeekday?'Groups per calendar day.':'Counts.'} ${rows.length>12?'First 12 categories shown; full table follows.':''}`);
    const total = rows.reduce((s,r) => s + Number(r[isCharge?'distinct_source_ids':metric]),0);
    get('record-status').textContent = `${period} · ${isCharge?'Charge groups overlap; do not sum categories':`${num(total)} groups · ${labelOf('record-outcome')}`} · ${rows.length>12?'Chart shows first 12 categories':'All categories shown'}`;
    const notes = ['Counts describe supplied records, not verified unique arrests or people.'];
    if (!isCharge) notes.push(outcome.selectedOptions[0].dataset.definition ?? '', 'Selected charge categories overlap; do not add their counts together.');
    if ((dim === 'by_year' || dim === 'by_month') && year.value === 'all') notes.push('Groups with conflicting periods remain in the unassigned category.');
    if (dim === 'by_month' && year.value !== 'all') notes.push('Groups without a unique month are excluded from this year’s monthly table; totals may be lower than the annual count.');
    if (period.includes('2025')) notes.push('2025 is incomplete; absent records are not confirmed zero arrests.');
    if (period.includes('2018')) notes.push('2018 begins July 1.');
    if (dim === 'by_city') notes.push('The supplied records do not establish complete municipal coverage. Counts are not population-adjusted crime rates and include warrant and detention/court categories excluded from the weather model. SHERIFF is an administrative label.');
    if (isWeekday) notes.push('Calendar-day denominators include zero-record dates. Fixed 2021–2024 scope; groups with conflicting dates are excluded.');
    if (isHour) notes.push('Fixed 2021–2024 scope. Recorded time may differ from offense time.');
    if (dim === 'by_race') notes.push('Source categories mix race and ethnicity labels. Counts lack population denominators and cannot establish differences in risk.');
    get('record-note').textContent = notes.join(' ');
    pageRecords();
  }

  async function loadRecords() {
    try {
      [chargeAggregates, categoryAggregates] = await Promise.all([
        fetchJSON(`${base}/data/aggregates.json`),
        fetchJSON(`${base}/data/category_aggregates.json`),
      ]);
      updateRecords();
      root!.querySelector<HTMLElement>('[data-record-controls]')!.hidden = false;
    } catch {
      get('record-status').textContent = 'Interactive tables could not load. The annual summary and downloadable files remain available.';
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'analysis-button'; retry.textContent = 'Retry table loading';
      retry.addEventListener('click',()=>{retry.remove();loadRecords();}); get('record-status').after(retry);
    }
  }
  [dimension,outcome,year].forEach(control => control.addEventListener('change',updateRecords));
  get('record-prev').addEventListener('click',()=>{recordPage--;pageRecords();});
  get('record-next').addEventListener('click',()=>{recordPage++;pageRecords();});
  get('record-download').addEventListener('click',()=>csvDownload(recordFile,[...recordHeaders,'Table scope','Interpretation note'],recordRows.map(row=>[...row,recordCaption,get('record-note').textContent])));
  loadRecords();

  let panel: any, categoryPanel: any, weather: any, weatherPage = 0;
  let weatherFile = '';
  const weatherDefinition = () => select('weather-outcome').value==='all'
    ? 'All groups meeting original weather-model eligibility in the selected ZIPs and dates. Warrant subtypes and detention/court categories excluded; warrant co-charge exclusions apply only to designated statistical models.'
    : `Within the weather-eligible sample: ${select('weather-outcome').selectedOptions[0].dataset.definition ?? ''}`;
  const weatherHeaders = ['Date','Eligible record groups','High °F','Mean °F','Low °F','ZIP-days'];
  const weatherValues = () => weather.daily.map((r:any)=>[r.date,r.count,r.high==null?null:Number(r.high.toFixed(2)),r.mean==null?null:Number(r.mean.toFixed(2)),r.low==null?null:Number(r.low.toFixed(2)),r.zipDays]);
  function clearWeather() {
    weather = undefined;
    ['weather-chart','weather-bins','weather-daily'].forEach(id=>get(id).replaceChildren());
    ['weather-download','weather-prev','weather-next'].forEach(id=>{get<HTMLButtonElement>(id).disabled=true;});
    get('weather-page').textContent='';
    get('weather-warning').hidden=true;
    get('weather-category-note').textContent='';
  }
  function pageWeather() {
    if (!weather) return;
    const pages = Math.max(1,Math.ceil(weather.daily.length/31)); weatherPage = Math.max(0,Math.min(weatherPage,pages-1));
    const daily = weatherValues();
    table('weather-daily', `${labelOf('weather-zip')} · ${labelOf('weather-outcome')} · ${select('weather-start').value}–${select('weather-end').value}`,weatherHeaders,daily.slice(weatherPage*31,(weatherPage+1)*31));
    get('weather-page').textContent = `Page ${weatherPage+1} of ${pages}`;
    get<HTMLButtonElement>('weather-prev').disabled = weatherPage === 0;
    get<HTMLButtonElement>('weather-next').disabled = weatherPage === pages-1;
  }
  function updateWeather() {
    const options = {zip:select('weather-zip').value,startYear:Number(select('weather-start').value),endYear:Number(select('weather-end').value),category:select('weather-outcome').value,temperature:select('weather-temperature').value};
    if (options.startYear > options.endYear) {
      get('weather-status').textContent = 'Choose a through year on or after the from year.';
      clearWeather(); return false;
    }
    try {weather = summarizeCategoryDaily(panel,categoryPanel,options);} catch {
      get('weather-status').textContent = 'This selection could not be computed. Reload the page or use the downloadable data.';
      clearWeather(); return false;
    }
    weatherPage = 0;
    get<HTMLButtonElement>('weather-download').disabled = false;
    get('weather-status').textContent = `${num(weather.totalCount)} eligible source-ID groups · ${labelOf('weather-outcome')} · ${num(weather.dateDays)} calendar dates · ${num(weather.zipCount)} ZIP ${weather.zipCount===1?'area':'areas'} · ${num(weather.zipDays)} ZIP-days`;
    get('weather-category-note').textContent = weatherDefinition();
    const warning = get('weather-warning'); warning.hidden = options.endYear !== 2025 && options.startYear !== 2018;
    warning.textContent = [options.startYear===2018?'2018 begins July 1.':'',options.endYear===2025?'2025 is incomplete. Exported zeros include missing records; these rates cannot establish a change in crime. Both primary analyses exclude 2025.':''].filter(Boolean).join(' ');
    get('weather-chart-heading').textContent = `${select('weather-outcome').selectedOptions[0].dataset.shortLabel} · ${labelOf('weather-temperature')}: records per 100 ZIP-days`;
    bars('weather-chart',weather.bins.map((r:any)=>({label:`${r.label}°F`,value:r.rate})),2);
    table('weather-bins',`Unadjusted temperature bands · ${labelOf('weather-outcome')}`,['Temperature °F','Groups','ZIP-days','Groups / 100 ZIP-days'],weather.bins.map((r:any)=>[r.label,num(r.count),num(r.zipDays),r.rate==null?'—':num(r.rate,2)]));
    get('weather-daily-note').textContent = (options.zip==='all'?`High, mean, and low are unweighted averages across ${panel.zips.length} ZIP representative points, in °F. They are not the county’s highest or lowest measured temperatures. `:'Modeled high, hourly-based mean, and low at this ZIP representative point, in °F. ')+'Dates use America/Los_Angeles civil-day boundaries, including 23- and 25-hour days. Displayed ZIP temperatures are rounded to 0.1°F.';
    weatherFile = `daily-${options.zip}-${options.category}-${options.startYear}-${options.endYear}.csv`;
    pageWeather();
    return true;
  }
  const load = get<HTMLButtonElement>('weather-load');
  load.addEventListener('click', async()=>{
    load.disabled = true; get('weather-status').textContent = 'Loading the daily ZIP panel…';
    try {
      [panel, categoryPanel] = await Promise.all([
        fetchJSON(`${weatherBase}/daily.json`),
        fetchJSON(`${weatherBase}/category_daily.json`),
      ]);
      if (!updateWeather()) throw new Error('Invalid daily panel');
      panel.zips.forEach((zip:string)=>{const option=document.createElement('option');option.value=zip;option.textContent=zip;select('weather-zip').append(option);});
      get('weather-interface').hidden = false; load.hidden = true;
    } catch {get('weather-status').textContent='Daily data could not load. Try again or use the aggregate data package.';load.disabled=false;load.textContent='Retry daily data loading';}
  });
  ['weather-zip','weather-start','weather-end','weather-outcome','weather-temperature'].forEach(id=>select(id).addEventListener('change',updateWeather));
  get('weather-prev').addEventListener('click',()=>{weatherPage--;pageWeather();});
  get('weather-next').addEventListener('click',()=>{weatherPage++;pageWeather();});
  get('weather-download').addEventListener('click',()=>{
    if (!weather) return;
    const headers = ['date','zip_selection','category','category_label','category_definition','category_overlap_note','eligible_source_id_groups','temp_high_f','temp_mean_f','temp_low_f','zip_days','raw_source_rows_present_on_date','incomplete_export','coverage_note','temperature_spatial_aggregation','weather_day_timezone','record_date_definition','civil_day_hours','weather_sample_note'];
    const rows = weatherValues().map((row:any[])=>{
      const i=panel.dates.indexOf(row[0]);
      return [row[0],select('weather-zip').value,select('weather-outcome').value,labelOf('weather-outcome'),weatherDefinition(),'Categories overlap; do not sum category counts',...row.slice(1),panel.raw_source_present_by_date[i],panel.incomplete_export_by_date[i],panel.incomplete_export_by_date[i]?'INCOMPLETE_EXPORT_ABSENCE_NOT_CONFIRMED_ZERO_ARRESTS':'AGENCY_COMPLETENESS_UNVERIFIED',select('weather-zip').value==='all'?'Unweighted mean across selected ZIP representative points':'ZIP representative point modeled exposure','America/Los_Angeles civil date','Recorded date; incident/arrest timestamp equivalence unverified',panel.day_hours_by_date[i],'64 of 112 ZIPs; acquisition quota; nonrandom availability; original eligibility'];
    });
    csvDownload(weatherFile,headers,rows);
  });
}
