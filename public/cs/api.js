// A single data boundary: local SQLite API or versioned static research exports.
// No generated/fallback performance values exist in this module.
let mode = 'unknown';
let metadata;
let playerIndexPromise;
const partitions = new Map();
const dataUrl = filename => new URL(filename,new URL(metadata?.data_base_url||'./data/',import.meta.url));

async function json(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Data request failed (${response.status}).`);
  const type = response.headers.get('content-type') || '';
  if (type.includes('text/html')) throw new Error('Expected a research dataset, received a web page.');
  const bytes=new Uint8Array(await response.arrayBuffer());
  let text;
  if(bytes[0]===0x1f&&bytes[1]===0x8b){
    if(typeof DecompressionStream==='undefined')throw new Error('This browser cannot unpack the research data. Use a browser supporting gzip decompression streams.');
    text=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }else text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  // A CDN may already have decoded Content-Encoding; sniff bytes, not headers.
  return JSON.parse(text);
}

export async function getMeta() {
  if (metadata) return metadata;
  // Published GitHub Pages sites have no /api route. Avoid a needless request there.
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (local) {
    try {
      metadata = await json(new URL('/api/meta', location.origin));
      mode = 'api';
      return metadata;
    } catch { /* A local static server is also a supported distribution. */ }
  }
  metadata = await json(new URL('./data/meta.json', import.meta.url));
  mode = 'static';
  return metadata;
}

async function partition(params) {
  const key = `${params.game}-${params.quality}-${params.window}`;
  if (partitions.has(key)) {
    const cached=partitions.get(key);partitions.delete(key);partitions.set(key,cached);
    return cached;
  }
  const extension=metadata.data_compression==='gzip'?'.json.gz':'.json';
  const request = json(dataUrl(`${encodeURIComponent(key)}${extension}`));
  partitions.set(key, request);
  // Keep comparison toggles responsive without retaining every historical slice.
  while(partitions.size>4)partitions.delete(partitions.keys().next().value);
  request.catch(() => { if(partitions.get(key)===request)partitions.delete(key); });
  return request;
}
async function playerIndex() {
  const extension=metadata.data_compression==='gzip'?'.json.gz':'.json';
  playerIndexPromise ??= json(dataUrl(`players${extension}`)).catch(()=>({players:{},team_history:{}}));
  return playerIndexPromise;
}

const playerId = row => String(row.player_id ?? row.id ?? '');
const latestDate = (dates, target) => dates.filter(date => date <= target).sort().at(-1);
function hydrate(data, entries, metric) {
  const decoded = (entries || []).map((entry,index) => {
    if (typeof entry !== 'number') return entry;
    const values = data.rows?.[entry];
    if (!Array.isArray(values) || !Array.isArray(data.columns)) return null;
    const row = Object.fromEntries(data.columns.map((column,i) => [column,values[i] ?? null]));
    row.value = row[metric] ?? null;
    row.rank = index + 1;
    row.quality_flags ??= [...(data.default_quality_flags||[]),...(data.specification?.game==='both'?['cross_era_display']:[])];
    const source = metadata.sources?.find(item=>item.id===(row.game==='csgo'?'filipe':'ektarr'));
    row.provenance ??= { window_id:row.window_id ?? row.id, start_map_id:row.start_map_id, end_map_id:row.end_map_id, source_url:row.source_url??source?.url, model_id:row.model_id };
    return row;
  }).filter(Boolean);
  let previousValue,rank=0;
  return decoded.map((row,index)=>{
    const value=Number.isFinite(row.value)?row.value:row[metric];
    if(index===0||!Number.isFinite(value)||value!==previousValue)rank=index+1;
    previousValue=value;
    return {...row,rank};
  });
}
function attachObservedTeam(data,row,date,index,game) {
  const history = data.team_history?.[playerId(row)] || index.team_history?.[playerId(row)] || metadata.team_history?.[playerId(row)];
  if (!Array.isArray(history)) return row;
  const team = history.filter(item=>String(item.date)<=date&&(game==='both'||!item.game||item.game===game)).sort((a,b)=>String(a.date).localeCompare(String(b.date))).at(-1);
  return { ...row, team_id:team?.team_id??null, team_name:team?.team_name??null, team_observed_date:team?.date??null };
}

export async function query(endpoint, params = {}, options = {}) {
  await getMeta();
  if (mode === 'api') {
    const url = new URL(`/api/${endpoint}`, location.origin);
    Object.entries(params).forEach(([key, value]) => value !== undefined && url.searchParams.set(key, value));
    return json(url, options);
  }
  const [data,index] = await Promise.all([partition(params),playerIndex()]);
  const target = params.date || metadata.coverage?.max_date || '9999-12-31';
  if (endpoint === 'leaderboard') {
    const date = latestDate(Object.keys(data.snapshots || {}), target);
    const snapshot = data.snapshots?.[date]?.[params.mode || 'record'];
    let rows = hydrate(data,snapshot?.[params.metric],params.metric).map(row=>attachObservedTeam(data,row,date||target,index,params.game));
    if (params.q) rows = rows.filter(row => String(row.display_name || row.alias || '').toLocaleLowerCase().includes(params.q.toLocaleLowerCase()));
    return { date: date || target, rows: rows.slice(0, Number(params.limit) || 10), total: rows.length, specification: data.specification, notes: data.notes, search_scope:data.search_scope, source: 'versioned_static_export' };
  }
  if (endpoint === 'frontier') {
    const rows = hydrate(data,data.frontiers?.[params.metric],params.metric);
    return { records: rows.filter(row => String(row.date || row.end_date) <= target), specification: data.specification };
  }
  if (endpoint === 'player') {
    const embedded = data.players?.[params.id];
    if (embedded) return embedded;
    try {
      if (data.player_index_url && !data.player_details_url) throw new Error('This distribution provides monthly trajectories.');
      const detail = await json(dataUrl(`players/${encodeURIComponent(params.id)}.json`));
      return detail;
    } catch {
      // Monthly measured snapshots still provide a traceable, explicitly sparse trajectory.
      const windows = Object.entries(data.snapshots || {}).filter(([date])=>date<=target).sort(([a], [b]) => a.localeCompare(b)).flatMap(([date, snapshot]) => {
        const rows = hydrate(data,snapshot.active?.[params.metric],params.metric);
        const row = rows.find(row => playerId(row) === String(params.id));
        return row ? [{ ...row, snapshot_date: date }] : [];
      });
      const unique = [...new Map(windows.map(row => [`${row.start_date}|${row.end_date}`, row])).values()];
      return { player: { player_id: params.id, display_name: params.name || unique[0]?.display_name || params.id, ...index.players?.[params.id] }, windows: unique, notes: ['Trajectory includes only windows present in the published monthly snapshots. Missing points are not interpolated.'], sparse: true };
    }
  }
  throw new Error(`Unsupported dataset endpoint: ${endpoint}`);
}

export async function exportCsv(params, visibleRows) {
  await getMeta();
  if (mode === 'api') {
    const url = new URL('/api/export', location.origin);
    Object.entries(params).forEach(([key, value]) => value !== undefined && url.searchParams.set(key, value));
    const response = await fetch(url);
    if (!response.ok) throw new Error(`CSV export failed (${response.status}).`);
    return response.blob();
  }
  const columns = ['snapshot_date','rank','player_id','display_name','value','metric','mode','window','quality','game','start_date','end_date','maps','rounds','kpr','dpr','net_kpr','model_id','quality_flags','provenance','dataset_version','dataset_license','dataset_license_url','source_license','attribution','changes'];
  const cell = value => {
    const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    // Guard spreadsheet formula execution in source aliases and provenance text.
    const safe = /^[=+@\t\r]/.test(text) || /^-/.test(text)&&!/^-(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const attribution='Filipe Chaves de Macedo: https://www.kaggle.com/datasets/filipechavesdemacedo/counter-strike-competitive-data (v1, CC BY 4.0); Ektarr/Maxim: https://www.kaggle.com/datasets/ektarr/counter-strike-pro-matches (v12, CC BY-SA 4.0); transformations by APEX';
  const rows = visibleRows.map(row => ({ ...params, ...row, snapshot_date: params.date, dataset_version: metadata.dataset_version,
    dataset_license:metadata.dataset_license||'CC BY-SA 4.0',dataset_license_url:'https://creativecommons.org/licenses/by-sa/4.0/',
    source_license:(row.game||params.game)==='csgo'?'CC BY 4.0':(row.game||params.game)==='cs2'?'CC BY-SA 4.0':'See per-source attribution',
    attribution,changes:'APEX cleaned, validated, aggregated and normalized source observations. Source snapshots: Filipe v1; Ektarr v12. Incomplete historical coverage.' }));
  const csv = [columns.join(','), ...rows.map(row => columns.map(column => cell(row[column])).join(','))].join('\r\n');
  return new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
}
