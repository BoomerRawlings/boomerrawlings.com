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

export function selectedRows(data, {category='criminal_total', period='2024', measure='enrollment', scale=1000, group='all', search='', sort='name'}={}) {
  const query = search.trim().toLocaleLowerCase();
  const aliases = {'110680':'UCSD','110714':'UCSC','110705':'UCSB','110635':'UCB','110644':'UCD','110653':'UCI','110671':'UCR','445188':'UCM','110699':'UCSF','122409':'SDSU','215062':'UPenn Penn','211440':'CMU','145637':'UIUC','199120':'UNC','234076':'UVA','240444':'UW Madison','236948':'UW Seattle'};
  const rows = data.institutions.filter(inst => (group === 'all' || inst.group === group) && `${inst.name} ${inst.shortName} ${inst.officialName??''} ${aliases[inst.id]??''} ${inst.state}`.toLocaleLowerCase().includes(query))
    .map(institution => ({institution,...summarize(institution,category,period,measure,scale)}));
  return rows.sort((a,b) => {
    if (sort !== 'name') {
      if (a.rate === null && b.rate !== null) return 1;
      if (b.rate === null && a.rate !== null) return -1;
      if (a.rate !== null && b.rate !== null && a.rate !== b.rate) return sort === 'rateAsc' ? a.rate-b.rate : b.rate-a.rate;
    }
    return a.institution.name.localeCompare(b.institution.name,'en');
  });
}

export function csvText(rows) {
  return rows.map(row => row.map(value => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text;
  }).join(',')).join('\r\n')+'\r\n';
}
