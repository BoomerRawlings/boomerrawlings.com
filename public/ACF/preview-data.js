import { label, THEMES } from './model.js?v=glyphs-20261013';

const value = input => typeof input === 'string' ? input.trim() : '';
const count = input => Number.isFinite(input) && input >= 0 ? Math.floor(input) : null;
const number = input => input.toLocaleString('en-US');
const collectionFor = (record, index) => value(index.catalogById.get(record?.catalogId)?.label) || 'Collection unspecified';
const roleOrder = role => ['author', 'editor', 'translator', 'host', 'speaker', 'organizer', 'participant'].indexOf(role);

function creditContext(item, index) {
  const credits = index.byItem.get(item.id) || [];
  const unique = new Map();
  for (const credit of credits) {
    const name = value(index.people.get(credit.personId)?.name) || 'Unresolved name label';
    const role = value(credit.role) || 'role unspecified';
    unique.set(JSON.stringify([credit.personId, role]), { name, role });
  }
  const entries = [...unique.values()].sort((a, b) => {
    const left = roleOrder(a.role), right = roleOrder(b.role);
    return (left < 0 ? 99 : left) - (right < 0 ? 99 : right);
  });
  if (!entries.length) return 'No usable source credit in this snapshot. No author has been inferred.';
  const text = entries.slice(0, 3).map(credit => `${credit.name} · ${label(credit.role)}`).join('; ');
  return text + (entries.length > 3 ? `; +${number(entries.length - 3)} more source credits.` : '.');
}

/** Public metadata for a node, without fetching, identity inference, or DOM work. */
export function previewInfo(node, index) {
  if (node?.scope?.kind === 'theme') {
    const amount = count(node.count);
    return {
      kind: 'theme',
      title: value(THEMES.find(theme => theme[0] === node.scope.id)?.[1]) || value(node.label) || 'Title keyword group',
      collection: 'Loaded collections',
      meta: `${amount === null ? 'Matching' : number(amount)} title records in this view · Inferred theme`,
      context: 'Grouped by title keywords only. These are inferred thematic matches, not source-documented affiliation, membership or agreement.',
      actionLabel: 'Explore matching records',
    };
  }
  const item = index.byId.get(node?.id);
  if (item) {
    const unknownTitle = !value(item.title) || item.qualityFlags?.includes('title_missing_in_source');
    const date = value(item.date) || value(item.dateRaw);
    const details = [label(item.type), date || 'Date unknown'];
    if (value(item.dateKind)) details.push(label(item.dateKind));
    if (date && value(item.datePrecision)) details.push(`${value(item.datePrecision)} precision`);
    if (value(item.eventStatus)) details.push(`Event: ${label(item.eventStatus)}`);
    if (value(item.publicationStatus)) details.push(`Publication: ${label(item.publicationStatus)}`);
    return {
      kind: 'item',
      title: unknownTitle ? 'Untitled source record' : item.title,
      collection: collectionFor(item, index),
      meta: details.join(' · '),
      context: [unknownTitle ? 'Title unavailable in the source.' : '', creditContext(item, index)].filter(Boolean).join(' '),
      actionLabel: 'Open record and sources',
    };
  }
  const personId = node?.scope?.kind === 'person' ? node.scope.id : node?.id;
  const person = index.people.get(personId);
  if (person) {
    const credits = index.byPerson.get(personId) || [];
    const total = new Set(credits.map(credit => credit.itemId)).size;
    const roles = [...new Set(credits.map(credit => value(credit.role)).filter(Boolean))];
    const amount = count(node.count);
    const details = [`${number(total)} ${total === 1 ? 'record' : 'records'} with source credits`];
    if (amount !== null && amount !== total) details.push(`${number(amount)} in this view`);
    if (roles.length) details.push(roles.slice(0, 5).map(label).join(', ') + (roles.length > 5 ? `; +${number(roles.length - 5)} more roles` : ''));
    return {
      kind: 'person',
      title: value(person.name) || 'Unresolved name label',
      collection: collectionFor(person, index),
      meta: details.join(' · '),
      context: `${label(person.entityStatus || 'unresolved_name_label')}. A credited name label may represent a person, group or publishing account; matching names in other collections are kept separate.`,
      actionLabel: 'Explore credited records',
    };
  }
  return {
    kind: 'unknown', title: value(node?.label) || 'Record unavailable', collection: 'Collection unavailable',
    meta: 'Metadata unavailable in the loaded collections', context: 'This node may belong to a collection that is no longer loaded.', actionLabel: 'Return to the collection',
  };
}

/** Local CSS pixels only: the caller transforms canvas/world coordinates first. */
export function previewPlacement(anchor, cardSize, stageSize) {
  const margin = 8, gap = 12;
  const dimension = input => Number.isFinite(input) ? Math.max(0, input) : 0;
  const width = dimension(stageSize?.width), height = dimension(stageSize?.height);
  const cardWidth = dimension(cardSize?.width), cardHeight = dimension(cardSize?.height);
  const anchorX = Number.isFinite(anchor?.x) ? anchor.x : width / 2;
  const anchorY = Number.isFinite(anchor?.y) ? anchor.y : height / 2;
  const maxX = Math.max(margin, width - cardWidth - margin), maxY = Math.max(margin, height - cardHeight - margin);
  let x = anchorX + gap, y = anchorY + gap;
  if (x + cardWidth > width - margin) x = anchorX - gap - cardWidth;
  if (y + cardHeight > height - margin) y = anchorY - gap - cardHeight;
  return { x: Math.max(margin, Math.min(maxX, x)), y: Math.max(margin, Math.min(maxY, y)) };
}
