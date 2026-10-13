import assert from 'node:assert/strict';
import { nodeIdentity } from '../public/ACF/node-identity.js';
import { createIndex, graphData } from '../public/ACF/model.js';

let checks = 0;
function check(name, test) { test(); checks++; console.log(`ok ${checks} - ${name}`); }

check('source labels require an exact catalog-scoped match', () => {
  for (const [catalogId, label] of [['c4ss', 'C4SS'], ['c4ss', 'Center for a Stateless Society'],
    ['ieet', 'IEET'], ['ieet', 'Institute for Ethics and Emerging Technologies'],
    ['transhumanity', 'Transhumanity.net'], ['transhumanity', 'Institute for Ethics and Emerging Technologies'],
    ['technophany', 'Research Network for Philosophy and Technology'],
    ['network-cultures', 'Institute of Network Cultures'], ['network-cultures', 'INC'],
    ['aft-technoprog', 'Technoprog'], ['aft-technoprog', 'AFT Technoprog']]) {
    assert.equal(nodeIdentity({ kind: 'person', catalogId, label }).visualType, 'source');
  }
  assert.equal(nodeIdentity({ kind: 'person', catalogId: 'c4ss', label: '  c4ss  ' }).visualTypeBasis, 'catalog_source_label');
  for (const [catalogId, label] of [['imported', 'C4SS'], ['ieet', 'C4SS'], ['c4ss', 'C4SS contributor'], ['network-cultures', 'Vincenzo']]) {
    assert.equal(nodeIdentity({ kind: 'person', catalogId, label }).visualType, 'person');
  }
});

check('explicit organization metadata is used without upgrading ambiguous accounts', () => {
  for (const entityStatus of ['organization', 'organization_name_label']) {
    assert.equal(nodeIdentity({ kind: 'person', entityStatus, label: 'A credited group' }).visualTypeBasis, 'source_entity_status');
  }
  for (const entityStatus of ['unresolved_public_account_label', 'official_role_listing', 'person_in_official_affiliation_source', 'organization_candidate', undefined]) {
    assert.equal(nodeIdentity({ kind: 'person', label: 'David Kelley', entityStatus, role: 'publishing_account' }).visualType, 'person');
  }
});

check('record and theme categories do not use their labels to infer identity', () => {
  for (const type of ['journal', 'publication_series', 'publication_collection']) assert.equal(nodeIdentity({ kind: 'item', type }).visualType, 'source');
  for (const type of ['journal_article', 'journal_issue', 'article', 'book']) assert.equal(nodeIdentity({ kind: 'item', type }).visualType, 'work');
  assert.equal(nodeIdentity({ kind: 'item', catalogId: 'c4ss', label: 'C4SS' }).visualType, 'work');
  assert.equal(nodeIdentity({ kind: 'hub', label: 'Minds & machines' }).visualType, 'theme');
  assert.equal(nodeIdentity({ kind: 'person', label: 'An unresolved label' }).roleLabel, 'Credited name');
});

check('graph annotations preserve IDs, roles, source status, unique counts and filtering', () => {
  const catalog = {
    catalog: { id: 'c4ss', label: 'Center for a Stateless Society' },
    items: [{ id: 'work:a', title: 'Machines and politics', sourceUrls: [] }, { id: 'work:b', title: 'A second record', sourceUrls: [] }],
    people: [{ id: 'name:source', name: 'C4SS', entityStatus: 'unresolved_name_label' },
      { id: 'name:author', name: 'Kevin Carson', entityStatus: 'official_role_listing' }],
    credits: [{ itemId: 'work:a', personId: 'name:source', role: 'publisher', sourceUrls: [] },
      { itemId: 'work:a', personId: 'name:source', role: 'author', sourceUrls: [] },
      { itemId: 'work:b', personId: 'name:source', role: 'publishing_account', sourceUrls: [] },
      { itemId: 'work:a', personId: 'name:author', role: 'publishing_account', sourceUrls: [] }],
    relationships: [], affiliations: [],
  };
  const before = JSON.stringify(catalog), index = createIndex([catalog]), graph = graphData(index);
  const source = graph.nodes.find(node => node.id === 'name:source');
  assert.equal(source.kind, 'person');
  assert.equal(source.visualType, 'source');
  assert.equal(source.entityStatus, 'unresolved_name_label');
  assert.equal(source.count, 2);
  assert.equal(graph.nodes.find(node => node.id === 'name:author').visualType, 'person');
  assert.equal(graph.nodes.find(node => node.id === 'work:a').visualType, 'work');
  assert.equal(graph.nodes.find(node => node.id === '@theme:minds').visualType, 'theme');
  assert.equal(graph.edges.filter(edge => edge.type === 'credit').length, 4);
  assert.deepEqual(graph.edges.filter(edge => edge.type === 'credit').map(edge => edge.role), catalog.credits.map(credit => credit.role));
  const filtered = graphData(index, [index.byId.get('work:a')]);
  assert.equal(filtered.nodes.find(node => node.id === 'name:source').count, 1);
  assert.equal(filtered.nodes.find(node => node.id === 'name:source').visualType, 'source');
  assert.equal(JSON.stringify(catalog), before);
});

console.log(`${checks} node identity checks passed`);
