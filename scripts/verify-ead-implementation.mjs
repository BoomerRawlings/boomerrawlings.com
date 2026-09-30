import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'parse5';

// Built-artifact integrity, not an execution test of the illustrative agent design.
const output = new URL('../dist/ead/', import.meta.url);
const read = path => readFileSync(new URL(path, output), 'utf8');
const guide = JSON.parse(read('data/implementation.json'));
const catalogue = JSON.parse(read('data/sources.json'));
const papers = new Map(catalogue.entries.map(paper => [paper.id, paper]));
const requiredSteps = ['persona-contract', 'system-prompt', 'reviewed-examples', 'context-memory', 'tool-gate', 'synthetic-practice', 'measurement', 'versioned-release'];
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const unique = values => new Set(values).size === values.length;
const kinds = new Set(['CONFIG', 'PROMPT', 'PSEUDOCODE', 'EXPERIMENT']);

assert(nonempty(guide.title) && nonempty(guide.subtitle), 'Guide needs a title and scope description');
assert(Array.isArray(guide.steps) && guide.steps.length > 0, 'Guide needs steps');
assert(guide.steps.every(step => typeof step.id === 'string' && /^[a-z][a-z0-9-]*$/.test(step.id)), 'Step IDs must be safe, stable identifiers');
assert(unique(guide.steps.map(step => step.id)), 'Step IDs must be unique');
assert(unique(guide.steps.map(step => step.number)), 'Step numbers must be unique');
const steps = new Map(guide.steps.map(step => [step.id, step]));
for (const id of requiredSteps) assert(steps.has(id), `Missing guide section: ${id}`);

const configs = new Map();
let sourceRefs = 0, relatedRefs = 0;
for (const [index, step] of guide.steps.entries()) {
  assert.equal(step.number, index + 1, `${step.id}: display order and number must agree`);
  for (const field of ['title', 'plain', 'check', 'artifact', 'code', 'notes']) {
    assert(nonempty(step[field]), `${step.id}: missing ${field}`);
  }
  assert(kinds.has(step.kind), `${step.id}: unknown artifact kind`);
  assert(Array.isArray(step.source_ids) && step.source_ids.length > 0 && unique(step.source_ids), `${step.id}: source references must be nonempty and unique`);
  for (const id of step.source_ids) {
    const paper = papers.get(id);
    assert(paper?.reviewed, `${step.id}: missing or unreviewed source ${id}`);
    assert(!['withdrawn', 'identity_uncertain', 'not_target_author'].includes(paper.status), `${step.id}: flagged source needs separate caution treatment: ${id}`);
    sourceRefs++;
  }
  assert(Array.isArray(step.related_ids) && unique(step.related_ids), `${step.id}: related references must be an array without duplicates`);
  for (const id of step.related_ids) {
    assert(steps.has(id) && id !== step.id, `${step.id}: missing or redundant self-reference ${id}`);
    relatedRefs++;
  }
  if (step.kind === 'CONFIG') {
    let config;
    try { config = JSON.parse(step.code); }
    catch (error) { throw new Error(`${step.id}: CONFIG is not valid JSON: ${error.message}`); }
    assert(config && typeof config === 'object' && !Array.isArray(config), `${step.id}: CONFIG must be a JSON object`);
    configs.set(step.id, config);
  }
}

// Check declared status, not a broad keyword scan that confuses proposals with completed tests.
assert(/proposed/i.test(guide.subtitle), 'Scope must identify the guide as proposed');
assert(/do not validate this architecture/i.test(guide.subtitle), 'Scope must distinguish cited research from architecture validation');
assert(/not executed model tests/i.test(steps.get('synthetic-practice').notes), 'Practice fixtures must be identified as unexecuted model-test specifications');
assert(/not an implementation/i.test(steps.get('tool-gate').code), 'Gateway sample must be labeled illustrative pseudocode');
assert.equal(configs.get('persona-contract')?.review_status, 'pending', 'Persona template must not claim completed review');
assert.equal(configs.get('reviewed-examples')?.review_status, 'pending', 'Example template must not claim completed review');
assert.equal(configs.get('measurement')?.scope, 'synthetic_lab', 'Evaluation plan must retain its synthetic scope');
assert.equal(configs.get('measurement')?.owner_set_acceptance_limits, null, 'Owner acceptance limits remain unresolved');
const candidate = configs.get('versioned-release');
assert.equal(candidate?.status, 'unvalidated', 'Candidate must not claim validation');
assert.equal(candidate?.environment, 'synthetic_only', 'Candidate must retain its synthetic scope');
for (const field of ['model', 'runtime', 'evaluation_report', 'approved_by']) {
  assert.equal(candidate?.[field], null, `Candidate ${field} must remain an unresolved placeholder`);
}

const fixtures = read('data/practice-scenarios.jsonl').split(/\r?\n/).filter(line => line.trim()).map((line, index) => {
  try { return JSON.parse(line); }
  catch (error) { throw new Error(`Practice fixture line ${index + 1}: ${error.message}`); }
});
assert.equal(fixtures.length, 60, 'Download must contain the 60 synthetic practice specifications');
assert(fixtures.every(fixture => nonempty(fixture.id)), 'Practice fixtures need IDs');
assert(unique(fixtures.map(fixture => fixture.id)), 'Practice fixture IDs must be unique');
for (const fixture of fixtures) {
  assert(fixture.trusted_fixture && typeof fixture.trusted_fixture === 'object', `${fixture.id}: missing trusted mock state`);
  assert(Array.isArray(fixture.conversation) && fixture.conversation.length > 0, `${fixture.id}: missing conversation`);
}

const nodes = [parse(read('workspace.html'))];
for (let index = 0; index < nodes.length; index++) nodes.push(...(nodes[index].childNodes ?? []));
const attrs = node => Object.fromEntries((node.attrs ?? []).map(({name, value}) => [name, value]));
const hasClass = (node, name) => (attrs(node).class ?? '').split(/\s+/).includes(name);
const within = (node, ancestor) => {
  for (let parent = node.parentNode; parent; parent = parent.parentNode) if (parent === ancestor) return true;
  return false;
};
const ids = nodes.map(node => attrs(node).id).filter(Boolean);
assert(unique(ids), 'Built HTML contains duplicate IDs');
for (const id of ['implementation-view', 'implementation-search', 'implementation-board', 'implementation-lines', 'implementation-rows', 'implementation-index', 'implementation-clear', 'implementation-download', 'implementation-count', 'implementation-empty', 'implementation-status']) {
  assert(ids.includes(id), `Built page is missing ${id}`);
}
const explorer = nodes.find(node => attrs(node).id === 'atlas-view');
const implementation = nodes.find(node => attrs(node).id === 'implementation-view');
assert.equal(explorer?.tagName, 'section', 'Network needs its outer view section');
assert(hasClass(explorer, 'view'), 'Network must remain a navigable view');
assert.equal(implementation.tagName, 'section', 'Implementation must remain a labeled section');
assert.equal(implementation.parentNode, explorer.parentNode, 'Implementation must be a peer of the Atlas view');
assert(hasClass(implementation, 'view'), 'Implementation must be a separate view');
assert(Object.hasOwn(attrs(implementation), 'hidden'), 'Implementation starts closed behind its tab');
for (const id of ['implementation-plans','implementation-guide']) assert(ids.includes(id), `Missing plan launcher contract: ${id}`);

const tabs = nodes.filter(node => node.tagName === 'nav' && hasClass(node, 'tabs'));
assert.equal(tabs.length, 1, 'Research needs one top-level view navigation');
const navViews = nodes.filter(node => node.tagName === 'button' && within(node, tabs[0])).map(node => attrs(node)['data-view']);
assert.deepEqual(navViews, ['atlas', 'implementation', 'observations', 'sources'], 'Top navigation must contain Atlas, Implementation, Findings and Catalogue');
assert(!ids.includes('connections-view'), 'Removed evidence-map view must not remain in the built page');
assert(!nodes.some(node => ['connections', 'explorer'].includes(attrs(node)['data-view'])), 'Replaced views must not retain navigation controls');

const implementationSearch = nodes.find(node => attrs(node).id === 'implementation-search');
assert.equal(implementationSearch.tagName, 'input', 'Implementation needs its own search input');
assert.equal(attrs(implementationSearch).type, 'search', 'Implementation search must expose search semantics');
assert(within(implementationSearch, implementation), 'Implementation search must belong to the embedded guide');
assert(nodes.some(node => node.tagName === 'button' && within(node, implementation) && attrs(node)['data-view'] === 'design'), 'Embedded guide must retain access to the architecture view');
const design = nodes.find(node => attrs(node).id === 'design-view');
assert.equal(design?.tagName, 'section', 'Architecture view must remain available');
assert(nodes.some(node => node.tagName === 'button' && within(node, design) && attrs(node)['data-view'] === 'implementation' && attrs(node)['data-jump'] === 'implementation-title'), 'Architecture return control must reopen the selected implementation guide');
const status = nodes.find(node => attrs(node).id === 'implementation-status');
assert.equal(attrs(status).role, 'status', 'Guide feedback needs a status region');
assert.equal(attrs(status)['aria-live'], 'polite', 'Guide feedback must announce politely');

const plans=JSON.parse(read('data/plans.json')).plans;
assert.equal(plans.length,4,'Four implementation plans expected');
assert(unique(plans.map(plan=>plan.id)),'Plan IDs must be unique');
for(const plan of plans) {
  if(plan.steps===null) { assert.equal(plan.status,'guide'); continue; }
  assert.equal(plan.status,'outline');
  const ids=new Set(plan.steps.map(step=>step.id));
  assert.equal(ids.size,plan.steps.length,'Outline step IDs must be unique');
  for(const step of plan.steps) {
    for(const field of ['title','plain','check','artifact','code','notes']) assert(nonempty(step[field]),`${plan.id}: missing ${field}`);
    assert(step.related_ids.every(id=>ids.has(id)),`${plan.id}: broken step link`);
    assert(step.source_ids.every(id=>papers.get(id)?.reviewed),`${plan.id}: missing reviewed evidence`);
    if(step.kind==='CONFIG') JSON.parse(step.code);
  }
}
console.log(`Verified implementation: ${steps.size} foundation steps, ${configs.size} JSON templates, ${sourceRefs} evidence references, ${relatedRefs} related-step references, ${fixtures.length} practice specifications and four selectable plans.`);
