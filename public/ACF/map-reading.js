import { THEMES } from './model.js?v=mapfirst-20261015';
import { ROUTE_STYLES, routeStyle } from './route-style.js?v=mapfirst-20261015';

const number = value => Number(value).toLocaleString('en-US');
const recordCount = (count, qualifier = '') => `${number(count)} ${qualifier}${count === 1 ? 'record' : 'records'}`;
const uniqueRecords = records => [...new Map(records.map(record => [record.id, record])).values()];
const themeName = id => THEMES.find(theme => theme[0] === id)?.[1] || 'Selected territory';

// Literal matches already supplied by the catalog model. Count each word once
// per record, including shared records with more than one matching theme.
function matchedTerms(records, themeIds) {
  const totals = new Map();
  for (const record of uniqueRecords(records)) {
    const terms = new Set((record.themeEvidence || [])
      .filter(evidence => themeIds.includes(evidence.themeId))
      .flatMap(evidence => evidence.terms || [])
      .map(term => String(term).toLocaleLowerCase('en-US')));
    for (const term of terms) totals.set(term, (totals.get(term) || 0) + 1);
  }
  return [...totals].map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term, 'en'))
    .slice(0, 4);
}

const routeDescriptions = {
  credit: 'Cyan · source-listed roles connect a credited name to a record: author, editor, speaker and other roles. Fastest flow.',
  relationship: 'Green · a relationship recorded between source records, including editorial related links. It is not necessarily a citation. Steady flow.',
  inferred: 'Violet · a proposed or inferred record relationship; its basis needs inspection. Slower flow.',
  theme: 'Amber · a subject anchor connects to a literal title-keyword match. These spokes explain grouping. Slowest flow.',
};

function routeKey(comparison, layers) {
  const counts = comparison ? Object.fromEntries(Object.keys(ROUTE_STYLES).map(id => [id, 0])) : null;
  if (counts) for (const edge of comparison.edges) counts[routeStyle(edge).id]++;
  return Object.values(ROUTE_STYLES).map(style => {
    const layer = style.inferred ? 'inferred' : 'relationships';
    const hidden = !comparison && (layers[layer] === false || (style.id === 'theme' && layers.regions === false) || (style.id === 'credit' && layers.names === false));
    return { id: style.id, label: style.label, count: counts?.[style.id] ?? null,
      body: routeDescriptions[style.id] + (hidden ? ' This layer is off.' : '') };
  });
}

/** An explanation of the current selection, without DOM, network or new
 * classifications. Route totals describe comparison data, not screen culling. */
export function mapReading(index, { comparison = null, region = null, records = [], scope = null, layers = {} } = {}) {
  const cards = [], selected = uniqueRecords(records);
  let caption;
  if (comparison) {
    const group = (side, ids) => {
      const rows = comparison.records.filter(record => ids.has(record.id));
      return { id: side === comparison.left ? 'left' : 'right', eyebrow: 'Matches one of this pair',
        title: side.label, value: recordCount(ids.size), regionId: side.id,
        body: 'Matches this subject, not the other selected subject. A record can still belong to other territories.',
        terms: matchedTerms(rows, [side.id]) };
    };
    const cross = comparison.relationships;
    const documented = cross.filter(edge => !edge.inferred).length;
    const inferred = cross.filter(edge => edge.inferred).length;
    cards.push(group(comparison.left, comparison.leftOnly), {
      id: 'shared', eyebrow: 'Between the clusters', title: 'Shared records', value: `${number(comparison.shared.size)} shown once`,
      body: `Titles match both selected subjects. Each shared record appears once. Separately, ${number(documented)} recorded and ${number(inferred)} inferred record links cross the exclusive sides or pass through a shared record.`,
      terms: matchedTerms(comparison.sharedRecords, [comparison.left.id, comparison.right.id]),
    }, group(comparison.right, comparison.rightOnly), {
      id: 'junctions', eyebrow: 'Read the junctions', title: 'Sources, names & subject anchors',
      value: `${number(comparison.sharedPeople.length)} names credited in both territories`,
      body: `Hollow subject anchors mark title-keyword groups. Hexagonal source accounts and diamond name labels carry source credits. Names between clusters have credits in both territories; ${number(comparison.bridgePersonIds.size)} have credits on distinct records in both exclusive sides. Shared records alone can also bring a name into the middle. Names stay separate across catalogs.`,
    });
    caption = `${recordCount(comparison.memberIds.size, 'unique ')} · title words define the groups. “Only” means within this selected pair; it does not mean a record has no other subjects.`;
  } else {
    const regionId = region?.id || region?.regionId || (scope?.kind === 'theme' ? scope.id : null);
    if (regionId) {
      const unmatched = regionId === 'unmatched';
      cards.push({ id: 'territory', eyebrow: unmatched ? 'Titles outside the current rules' : 'Why these records are grouped',
        title: unmatched ? 'No current title-keyword match' : themeName(regionId),
        value: recordCount(selected.length, 'selected '), regionId,
        body: unmatched ? 'These titles do not match the current English keyword rules. They may use other languages, different wording, or have no usable title; they still have subjects.'
          : 'Literal title words place records here. Membership can overlap other subjects. The boundary sketches the cluster; it does not establish affiliation, agreement or influence.',
        terms: unmatched ? [] : matchedTerms(selected, [regionId]) });
      caption = 'The selected records are highlighted in the full field. Choose a second territory to separate the pair and see their overlap.';
    } else if (scope?.kind === 'person') {
      const person = index.people.get(scope.id);
      cards.push({ id: 'credits', eyebrow: 'Why these records are together', title: person?.name || 'Selected credited name',
        value: recordCount(selected.length, 'selected '),
        body: 'These records carry source credits for this catalog-local name. A credit may mean author, editor, speaker or another role. Matching names in other catalogs stay separate.' });
      caption = 'This view follows a source-listed name and its credited records. Hover keeps the individual record and source context available.';
    } else {
      cards.push({ id: 'field', eyebrow: 'Every small star', title: 'A source record', value: `${recordCount(selected.length)} in this view`,
        body: 'Stars represent catalog records: articles, papers, books, events and other material. Hover for the record; select it to follow its sources.' },
      { id: 'territories', eyebrow: 'Why subjects cluster', title: 'Overlapping title-word territories', value: `${THEMES.length} subject groups`,
        body: 'Literal title keywords determine membership. A record can match several groups, or none. The soft shapes illustrate the layout; distance and overlap are not evidence of a relationship.' });
      caption = 'Read the map through records, title-word groups and source connections. Select two subject territories for a separated comparison.';
    }
    cards.push({ id: 'junctions', eyebrow: 'Read the junctions', title: 'Sources, names & subject anchors', value: 'Different shapes, different roles',
      body: 'Hexagonal beacons identify known source or group labels. Diamonds represent authors and other credited names, including unresolved labels. Hollow rings mark inferred title subjects. Names stay separate across catalogs.' });
  }
  const routes = routeKey(comparison, layers);
  const note = (comparison ? 'Route counts cover this whole comparison, including links inside each cluster; they are not counts of links crossing between clusters. ' : '')
    + 'Flow speed distinguishes evidence categories; it is not a confidence score or a measure of influence. Matched-word counts use unique records in each group.';
  const nodeNote = 'Within each type, brighter and larger points have more unique linked neighbors in the current view. Size is bounded. Hexagons also include publishing accounts; catalog-local names stay separate. Title-group spokes are excluded; brightness does not measure readership or influence.';
  const model = { caption, cards, routes, note, nodeNote };
  return { key: JSON.stringify(model), ...model };
}
