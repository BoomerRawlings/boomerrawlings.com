/** Descriptive rates. Missing numerators or denominators invalidate the full selection. */
export const measures = {
  enrollment: {label:'On campus / enrolled students', geography:'oncampus', denominator:'enrollment', population:'enrolled students'},
  housingEnrollment: {label:'Campus housing / enrolled students', geography:'residential', denominator:'enrollment', population:'enrolled students'},
  residents: {label:'Campus housing / documented residents', geography:'residential', denominator:'residents', population:'documented residents'},
};

export function summarize(institution, category, period='2024', measure='enrollment', scale=1000) {
  const definition = measures[measure];
  if (!definition) throw new Error('Unknown population measure');
  if (![1000,10000].includes(scale)) throw new Error('Unsupported rate scale');
  const wanted = period === 'pooled' ? [2022,2023,2024] : [Number(period)];
  const rows = wanted.map(year => institution.years.find(row => row.year === year));
  const validCount = rows.every(row => row && Number.isInteger(row.counts[definition.geography]?.[category]) && row.counts[definition.geography][category] >= 0);
  const validPopulation = rows.every(row => row && Number.isFinite(row[definition.denominator]) && row[definition.denominator] > 0);
  const count = validCount ? rows.reduce((sum,row) => sum + row.counts[definition.geography][category],0) : null;
  const population = validPopulation ? rows.reduce((sum,row) => sum + row[definition.denominator],0) : null;
  return {count, population, rate:count !== null && population !== null ? scale*count/population : null, years:wanted.length};
}

export function rateLabel(value) {
  if (value === null) return 'Unavailable';
  return value > 0 && value < .01 ? value.toFixed(3) : value.toFixed(2);
}

export const sortOrders = {
  name: {column:'institution', direction:'ascending', label:'Full institution name A–Z'},
  nameDesc: {column:'institution', direction:'descending', label:'Full institution name Z–A'},
  rateDesc: {column:'rate', direction:'descending', label:'Reported rate: high to low'},
  rateAsc: {column:'rate', direction:'ascending', label:'Reported rate: low to high'},
  countDesc: {column:'count', direction:'descending', label:'Reported count: high to low'},
  countAsc: {column:'count', direction:'ascending', label:'Reported count: low to high'},
  populationDesc: {column:'population', direction:'descending', label:'Population: high to low'},
  populationAsc: {column:'population', direction:'ascending', label:'Population: low to high'},
};

/** Numeric columns start highest first; names start A–Z. Repeated clicks reverse the order. */
export function nextSort(current, column) {
  const active = sortOrders[current] ?? sortOrders.name;
  const ascending = column === 'institution' ? 'name' : `${column}Asc`;
  const descending = column === 'institution' ? 'nameDesc' : `${column}Desc`;
  if (!sortOrders[ascending]) throw new Error('Unknown sort column');
  if (active.column !== column) return column === 'institution' ? ascending : descending;
  return active.direction === 'ascending' ? descending : ascending;
}

export const initialView = Object.freeze({category:'criminal_total', period:'2024', measure:'residents', scale:1000, group:'resident-covered', search:'', sort:'name'});

// Older shared views omitted enrollment/all because those were the defaults.
export function viewDefaults(params) {
  const legacyView = ['category','period','measure','scale','group','search','sort','first','second'].some(key => params.has(key));
  return legacyView ? {...initialView, measure:'enrollment', group:'all'} : {...initialView};
}

export function selectedRows(data, {category='criminal_total', period='2024', measure='enrollment', scale=1000, group='all', search='', sort='name'}={}) {
  const query = search.trim().toLocaleLowerCase();
  const aliases = {'110680':'UCSD','110714':'UCSC','110705':'UCSB','110635':'UCB','110644':'UCD','110653':'UCI','110671':'UCR','445188':'UCM','110699':'UCSF','122409':'SDSU','215062':'UPenn Penn','211440':'CMU','145637':'UIUC','199120':'UNC','234076':'UVA','240444':'UW Madison','236948':'UW Seattle'};
  const rows = data.institutions.filter(inst => (group === 'all' || inst.group === group || (group === 'resident-covered' && inst.years.some(year => year.residents > 0))) && `${inst.name} ${inst.shortName} ${inst.officialName??''} ${aliases[inst.id]??''} ${inst.state}`.toLocaleLowerCase().includes(query))
    .map(institution => ({institution,...summarize(institution,category,period,measure,scale)}));
  const order = sortOrders[sort] ?? sortOrders.name;
  return rows.sort((a,b) => {
    const names = (a.institution.officialName??a.institution.name).localeCompare(b.institution.officialName??b.institution.name,'en');
    if (order.column === 'institution' && names !== 0) return order.direction === 'ascending' ? names : -names;
    if (order.column !== 'institution') {
      const first = a[order.column], second = b[order.column];
      // An unavailable value is always last, including in descending order.
      if (first === null && second !== null) return 1;
      if (second === null && first !== null) return -1;
      if (first !== null && second !== null && first !== second) return order.direction === 'ascending' ? first-second : second-first;
    }
    return names || String(a.institution.id).localeCompare(String(b.institution.id),'en');
  });
}

export function csvText(rows) {
  return rows.map(row => row.map(value => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text;
  }).join(',')).join('\r\n')+'\r\n';
}
