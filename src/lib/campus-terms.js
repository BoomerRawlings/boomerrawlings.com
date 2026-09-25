/** Presentation definitions; source records and numerical values are never changed. */
const definitions = [
  ['UC', 'University of California', ['UCs'], 'University of California institutions'],
  ['VAWA', 'Violence Against Women Act'],
  ['ASR', 'annual security report', ['ASRs', 'annual security reports'], 'annual security reports'],
  ['IPEDS', 'Integrated Postsecondary Education Data System'],
  ['UNITID', 'unique institution identifier in the Integrated Postsecondary Education Data System'],
  ['NCES', 'National Center for Education Statistics'],
  ['FTE', 'full-time equivalent', ['full-time-equivalent']],
  ['BJS', 'Bureau of Justice Statistics'],
  ['API', 'application programming interface'],
  ['CFR', 'Code of Federal Regulations'],
  ['PDF', 'Portable Document Format'],
  ['CSV', 'comma-separated values'],
  ['JSON', 'JavaScript Object Notation'],
  ['ZIP', 'compressed archive format'],
  ['URL', 'Uniform Resource Locator', ['URLs'], 'Uniform Resource Locators'],
  ['SHA-256', 'Secure Hash Algorithm with a 256-bit digest'],
  ['U.S.', 'United States', ['US']],
  ['MBL', 'Marine Biological Laboratory'],
  ['DRCLAS', 'David Rockefeller Center for Latin American Studies'],
  ['UNDERC', 'University of Notre Dame Environmental Research Center'],
  ['IFAS', 'Institute of Food and Agricultural Sciences'],
  ['CALS', 'College of Agricultural and Life Sciences'],
  ['NCEF', 'Naples Children & Education Foundation'],
  ['SAIS', 'School of Advanced International Studies'],
  ['UTLA', 'University of Texas Semester in Los Angeles Program'],
  ['LBJ', 'Lyndon B. Johnson'],
  ['MBA', 'Master of Business Administration'],
  ['REEF', 'Research and Engineering Education Facility'],
  ['D.C.', 'District of Columbia', ['DC']],
  ['Md.', 'Maryland'],
];
const institutionAliases = {
  '110680':['UCSD'], '110714':['UCSC'], '110705':['UCSB'], '110635':['UCB'],
  '110644':['UCD'], '110653':['UCI'], '110671':['UCR'], '445188':['UCM'],
  '110699':['UCSF'], '122409':['SDSU'], '215062':['UPenn'], '211440':['CMU'],
  '145637':['UIUC'], '199120':['UNC'], '234076':['UVA'], '144050':['UChicago'],
  '190150':['CU'], '134130':['UF'], '162928':['JHU'], '228778':['UT'],
};
export const stateNames = {RI:'Rhode Island',CA:'California',PA:'Pennsylvania',IL:'Illinois',NY:'New York',NH:'New Hampshire',NC:'North Carolina',FL:'Florida',DC:'District of Columbia',GA:'Georgia',MA:'Massachusetts',MD:'Maryland',MI:'Michigan',IN:'Indiana',OH:'Ohio',NJ:'New Jersey',TX:'Texas',VA:'Virginia',WA:'Washington',WI:'Wisconsin',CT:'Connecticut'};
export const escapeHtml = text => String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

export function campusTerms(institutions = []) {
  const terms = definitions.map(([short,full,aliases=[],plural])=>({id:short,short,full,aliases:[short,full,...aliases],plural}));
  for(const inst of institutions) {
    const full=inst.officialName.replace(/^University of California-/, 'University of California, ');
    terms.push({id:inst.id,short:inst.name,full,aliases:[inst.name,inst.officialName,full,...(institutionAliases[inst.id]??[])]});
  }
  const lookup=new Map();
  for(const term of terms)for(const alias of term.aliases)lookup.set(alias,term);
  const escapeRegex=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const pattern=[...lookup.keys()].sort((a,b)=>b.length-a.length).map(escapeRegex).join('|');
  return {lookup,pattern:new RegExp(`(?<![\\p{L}\\p{N}])(${pattern})(?![\\p{L}\\p{N}])`,'gu')};
}

export function termParts(text, dictionary) {
  const parts=[];let cursor=0;
  for(const match of text.matchAll(dictionary.pattern)) {
    if(match.index>cursor)parts.push({text:text.slice(cursor,match.index)});
    const term=dictionary.lookup.get(match[0]);
    const plural=term.plural && (match[0].endsWith('s') && match[0]!==term.full);
    parts.push({text:match[0],term,full:plural?term.plural:term.full,short:plural?`${term.short}s`:term.short});
    cursor=match.index+match[0].length;
  }
  if(cursor<text.length)parts.push({text:text.slice(cursor)});
  return parts;
}

export function fullTerms(text,dictionary) {
  return termParts(text,dictionary).map(part=>part.term?part.full:part.text).join('');
}

export function termMarkup(text,dictionary,seen,{interactive=false,verbatim=false}={}) {
  return termParts(text,dictionary).map(part=>{
    if(!part.term)return escapeHtml(part.text);
    // Preserve formal titles and frozen campus names; annotate only actual shorthand there.
    if(verbatim && (part.text===part.full || !/[A-Z]{2}|^Caltech$/.test(part.text)))return escapeHtml(part.text);
    const first=!seen.has(part.term.id);if(!verbatim)seen.add(part.term.id);
    const label=verbatim?part.text:part.short;
    // Use a real abbr/title plus a focus/touch tooltip; never nest a focus target inside a link/button.
    const abbr=`<abbr class="campus-abbreviation" title="${escapeHtml(part.full)}" data-definition="${escapeHtml(part.full)}"${interactive?'':' tabindex="0"'}>${escapeHtml(label)}</abbr>`;
    const value=first&&!verbatim?`${escapeHtml(part.full)} (${abbr})`:abbr;
    return `<span data-campus-term="${escapeHtml(part.term.id)}" data-original="${escapeHtml(part.text)}">${value}</span>`;
  }).join('');
}
