import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/scripts/karma-bureau-desk.js', import.meta.url), 'utf8');
const component = readFileSync(new URL('../src/components/KarmaBureau.astro', import.meta.url), 'utf8');
const ids = [...component.matchAll(/id="(bureau-[^"]+)"/g)].map(match => match[1]);

function fixture(division = 'human') {
  let focused = '';
  let resets = 0;
  const subscriptions = [];
  class Node {
    constructor(id = '') { this.id = id; this.value = ''; this.checked = false; this.disabled = false; this.hidden = false; this.open = false; this.textContent = ''; this.dataset = {}; this.events = {}; }
    addEventListener(type, fn) { (this.events[type] ||= []).push(fn); }
    async emit(type) {
      const event = {preventDefault() { this.defaultPrevented = true; }};
      await Promise.all((this.events[type] || []).map(fn => fn(event)));
      return event;
    }
    focus() { focused = this.id; }
    replaceChildren(...children) { this.children = children; }
    showModal() { this.open = true; }
    close() { this.open = false; return this.emit('close'); }
  }
  const nodes = Object.fromEntries(ids.map(id => [id, new Node(id)]));
  const get = name => nodes[`bureau-${name}`];
  const fields = ['petition-reason', 'petition-message', 'petition-declaration', 'petition-acceptance', 'petition-send'].map(get);
  get('petition-form').querySelectorAll = () => fields;
  get('petition-form').reset = () => {
    resets++;
    fields.forEach(field => { field.value = ''; field.checked = false; });
  };
  get('forecast').hidden = true;
  get('projected-score').textContent = '+0';
  const counters = ['requests', 'checks', 'appeals', 'simulations', 'petitions'].map(name => {
    const node = new Node(); node.dataset.bureauCount = name; return node;
  });
  const root = new Node();
  root.dataset = {division, score: division === 'feline' ? '6' : '20'};
  root.querySelector = selector => nodes[selector.slice(1)] || null;
  root.querySelectorAll = () => counters;
  const state = {counts: {requests: 0, checks: 0, appeals: 0, simulations: 0, petitions: 0}, tier: 0, title: 'Routine oversight', notice: 'A normal amount of interest.', flags: [], storageAvailable: true};
  const records = [], inspections = [], sends = [];
  let delivery = async () => true;
  const engine = {
    snapshot: () => structuredClone(state),
    subscribe(fn) { subscriptions.push(fn); },
    record(action, selectedDivision) { records.push([action, selectedDivision]); if (action === 'simulation') state.counts.simulations++; subscriptions.forEach(fn => fn()); },
    inspect(...args) { inspections.push(args); return structuredClone(state); },
    reset() { Object.keys(state.counts).forEach(key => { state.counts[key] = 0; }); subscriptions.forEach(fn => fn()); },
  };
  const window = {BoomerKarmaBureau: engine, BoomerKarmaDelivery: {async send(...args) { sends.push(args); return delivery(...args); }}};
  const context = vm.createContext({window, document: {querySelector: () => root, createElement: () => new Node()}, console});
  vm.runInContext(source, context);
  function validPetition() {
    get('petition-reason').value = 'I would like a review of the review.';
    get('petition-message').value = 'I respectfully request a review of this elaborate review because the paperwork has become impressively recursive.';
    get('petition-declaration').checked = true;
    get('petition-acceptance').checked = true;
  }
  return {get, root, state, records, inspections, sends, fields, validPetition, context,
    setDelivery(fn) { delivery = fn; }, focused: () => focused, resets: () => resets};
}

const tests = [];
const test = (name, body) => tests.push([name, body]);

test('forecast never reveals the actual score and repeated simulations record only local activity', async () => {
  const f = fixture();
  assert.equal(f.get('forecast').hidden, true);
  assert.match(component, /id="bureau-projected-score">\+0<\/strong>/);
  assert.doesNotMatch(component, />\{score\}</);
  f.get('action').value = 'spreadsheet'; f.get('effort').value = 'committed'; f.get('motive').value = 'maximum';
  for (let i = 0; i < 4; i++) await f.get('simulator').emit('submit');
  assert.equal(f.get('projected-score').textContent, '+0');
  assert.equal(f.get('forecast').hidden, false);
  assert.equal(f.state.counts.simulations, 4);
  assert.deepEqual(f.records, Array.from({length: 4}, () => ['simulation', 'human']));
  assert.equal(f.get('model-reasons').children.length, 4);
  assert.match(f.get('model-reasons').children[3].textContent, /Simulation 4/);
  assert.equal(f.sends.length, 0);
  assert.match(f.inspections[0][0], /min max/);
});

test('feline forecast retains +0 and rejects unknown selection values', async () => {
  const f = fixture('feline');
  f.get('action').value = 'bowtie'; f.get('effort').value = 'extreme'; f.get('motive').value = 'curiosity';
  await f.get('simulator').emit('submit');
  assert.equal(f.get('projected-score').textContent, '+0');
  assert.match(f.get('model-reasons').children[0].textContent, /Second Bow Tie/);
  assert.equal(f.records[0][1], 'feline');
  f.get('action').value = '<script>';
  await f.get('simulator').emit('submit');
  assert.equal(f.records.length, 1);
});

test('review recursion stops, returns keyboard focus, and does not send anything', async () => {
  const f = fixture();
  for (let i = 0; i < 9; i++) await f.get('review-deeper').emit('click');
  assert.equal(f.get('review-level').textContent, 'Review depth 4 of 4');
  assert.match(f.get('review-title').textContent, /swivel chair/);
  assert.equal(f.get('review-deeper').hidden, true);
  assert.equal(f.focused(), 'bureau-review-start');
  await f.get('review-start').emit('click');
  assert.equal(f.focused(), 'bureau-review-deeper');
  assert.equal(f.get('review-level').textContent, 'Review depth 0 of 4');
  assert.equal(f.sends.length, 0);
});

test('petitions require a reason, twelve words and both declarations', async () => {
  const f = fixture();
  await f.get('petition-form').emit('submit');
  assert.equal(f.focused(), 'bureau-petition-reason');
  f.validPetition(); f.get('petition-message').value = 'Please reconsider.';
  await f.get('petition-form').emit('submit');
  assert.equal(f.focused(), 'bureau-petition-message');
  f.validPetition(); f.get('petition-declaration').checked = false;
  await f.get('petition-form').emit('submit');
  assert.equal(f.focused(), 'bureau-petition-declaration');
  f.validPetition(); f.get('petition-acceptance').checked = false;
  await f.get('petition-form').emit('submit');
  assert.equal(f.focused(), 'bureau-petition-acceptance');
  assert.equal(f.sends.length, 0);
  assert.equal(f.inspections.length, 0);
});

test('strict success, complete answers and stable failed retries', async () => {
  const f = fixture('feline');
  f.validPetition();
  await f.get('petition-open').emit('click');
  f.setDelivery(async () => 'true');
  await f.get('petition-form').emit('submit');
  assert.equal(f.resets(), 0);
  assert.equal(f.get('petition-dialog').open, true);
  assert.equal(f.get('petition-error').hidden, false);
  assert.match(f.get('petition-message').value, /respectfully request/);
  const [kind, answers] = f.sends[0];
  assert.equal(kind, 'bureau-petition');
  assert.equal(answers.Division, 'Feline division');
  assert.equal(answers['Current score (unchanged)'], '6');
  assert.equal(answers['Submitted message'], f.get('petition-message').value);
  assert.equal(answers['Paperwork declaration'], 'Confirmed');
  assert.equal(answers['Delivery is not a ruling'], 'Acknowledged');
  assert.equal(answers['Procedural concern'], f.get('petition-reason').value);
  f.state.counts.checks = 20;
  f.setDelivery(async () => { throw new Error('offline'); });
  await f.get('petition-form').emit('submit');
  assert.strictEqual(f.sends[1][1], answers);
  assert.equal(f.get('petition-message').value, answers['Submitted message']);
  f.setDelivery(async () => true);
  await f.get('petition-form').emit('submit');
  assert.strictEqual(f.sends[2][1], answers);
  assert.equal(f.resets(), 1);
  assert.equal(f.get('petition-dialog').open, false);
  assert.equal(f.focused(), 'bureau-petition-open');
  assert.equal(f.get('petition-message').value, '');
  assert.equal(f.inspections.length, 1);
  assert.equal(f.records.filter(([action]) => action === 'petition').length, 0);
  assert.match(f.get('petition-status').textContent, /Petition delivered/);
});

test('pending delivery disables edits, blocks duplicates and prevents closing', async () => {
  const f = fixture();
  f.validPetition();
  await f.get('petition-open').emit('click');
  let finish;
  f.setDelivery(() => new Promise(resolve => { finish = resolve; }));
  const pending = f.get('petition-form').emit('submit');
  assert.ok(f.fields.every(field => field.disabled));
  assert.equal(f.get('petition-close').disabled, true);
  await f.get('petition-form').emit('submit');
  assert.equal(f.sends.length, 1);
  const cancel = await f.get('petition-dialog').emit('cancel');
  assert.equal(cancel.defaultPrevented, true);
  await f.get('petition-close').emit('click');
  assert.equal(f.get('petition-dialog').open, true);
  finish(false); await pending;
  assert.ok(f.fields.every(field => !field.disabled));
  assert.equal(f.get('petition-close').disabled, false);
  assert.equal(f.focused(), 'bureau-petition-send');
  await f.get('petition-close').emit('click');
  assert.equal(f.focused(), 'bureau-petition-open');
});

test('reset affects bureau history only and duplicate script initialization is harmless', async () => {
  const f = fixture();
  f.state.counts.requests = 5;
  f.get('forecast').hidden = false;
  vm.runInContext(source, f.context);
  assert.equal(f.get('reset').events.click.length, 1);
  await f.get('reset').emit('click');
  assert.equal(f.state.counts.requests, 0);
  assert.equal(f.root.dataset.score, '20');
  assert.equal(f.get('forecast').hidden, true);
  assert.match(f.get('reset-status').textContent, /actual score and issued reports are unchanged/);
  assert.equal(f.resets(), 0);
});

for (const [name, body] of tests) { await body(); console.log(`PASS ${name}`); }
console.log(`${tests.length} bureau desk behavior checks passed; no messages sent.`);
