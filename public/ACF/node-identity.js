// Presentation categories only. Never resolve identity or merge source labels.
const sourceLabels = new Map([
  ['c4ss', ['C4SS', 'Center for a Stateless Society']],
  ['ieet', ['IEET', 'Institute for Ethics and Emerging Technologies']],
  ['transhumanity', ['Transhumanity.net', 'Institute for Ethics and Emerging Technologies']],
  ['technophany', ['Research Network for Philosophy and Technology']],
  ['network-cultures', ['Institute of Network Cultures', 'INC']],
  ['aft-technoprog', ['Technoprog', 'AFT Technoprog']],
].map(([catalog, names]) => [catalog, new Set(names.map(fold))]));

function fold(value) { return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US'); }

/** Roles such as publishing_account also belong to named authors, so they do
 * not classify a node. Unknown names remain names, without asserting a human. */
export function nodeIdentity({ kind, catalogId, label, entityStatus, type } = {}) {
  if (kind === 'hub') return { visualType: 'theme', roleLabel: 'Inferred subject', visualTypeBasis: 'title_keyword_group' };
  if (kind === 'item' && ['journal', 'publication_series', 'publication_collection'].includes(type)) return { visualType: 'source', roleLabel: 'Publication', visualTypeBasis: 'record_type' };
  if (kind !== 'person') return { visualType: 'work', roleLabel: 'Source record', visualTypeBasis: 'record' };
  if (entityStatus === 'organization' || entityStatus === 'organization_name_label') {
    return { visualType: 'source', roleLabel: 'Source or group', visualTypeBasis: 'source_entity_status' };
  }
  if (sourceLabels.get(catalogId)?.has(fold(label))) {
    return { visualType: 'source', roleLabel: 'Source or group', visualTypeBasis: 'catalog_source_label' };
  }
  return { visualType: 'person', roleLabel: 'Credited name', visualTypeBasis: 'catalog_name_label' };
}
