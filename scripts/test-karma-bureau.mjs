import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';

const source = readFileSync(new URL('../public/scripts/boomer-karma-bureau.js', import.meta.url), 'utf8');
const visitorKey = 'boomerkarma-bureau-v1';
const testKey = `${visitorKey}-test`;
const plain = value => JSON.parse(JSON.stringify(value));

function client({values = new Map(), hostname = 'boomerrawlings.com', search = '', blocked = false, quota = false} = {}) {
  const handlers = {};
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem(key, value) { if (quota) throw new Error('Quota exceeded'); values.set(key, value); },
    removeItem: key => values.delete(key),
  };
  const window = {addEventListener: (name, callback) => { handlers[name] = callback; }};
  Object.defineProperty(window, 'localStorage', {get() { if (blocked) throw new Error('Blocked'); return storage; }});
  runInNewContext(source, {window, location: {hostname, search}, URLSearchParams, Date});
  return {bureau: window.BoomerKarmaBureau, values, storage, change: event => handlers.storage(event)};
}

test('fresh file has no extra paperwork; snapshots cannot modify the ledger', () => {
  const {bureau} = client();
  const first = bureau.snapshot();
  assert.equal(first.tier, 0);
  assert.equal(first.storageAvailable, true);
  assert.deepEqual(plain(first.counts), {requests: 0, checks: 0, appeals: 0, simulations: 0, petitions: 0});
  assert.deepEqual(plain(bureau.requirements()), []);
  first.counts.requests = 1000;
  first.flags.push('Invented');
  first.history.push({action: 'request'});
  assert.equal(bureau.snapshot().counts.requests, 0);
  assert.equal(bureau.snapshot().flags.length, 0);
  assert.equal(bureau.snapshot().history.length, 0);
});

test('successful repeated report requests cross all five levels at the documented thresholds', () => {
  const {bureau} = client();
  const expected = new Map([[1, 0], [2, 1], [4, 1], [5, 2], [10, 2], [11, 3], [20, 3], [21, 4]]);
  for (let count = 1; count <= 21; count++) {
    const result = bureau.record('request');
    if (expected.has(count)) assert.equal(result.tier, expected.get(count), `request ${count}`);
    assert.equal(result.counts.requests, count);
    assert.ok(bureau.requirements().length <= 3);
  }
  assert.match(bureau.snapshot().title, /committee/i);
  assert.equal(bureau.requirements().at(-1).id, 'human-appendix-omega');
  assert.equal(bureau.snapshot().flags.includes('Repeat report requests'), true);
  assert.match(bureau.describe(), /21 reports/);
  assert.match(bureau.describe(), /No score change or identity verification/);
});

test('checks, appeals, simulations, and petitions contribute real local activity without changing scores', () => {
  const {bureau} = client();
  for (const action of ['check', 'appeal', 'simulation', 'petition']) {
    bureau.record(action);
    bureau.record(action);
    bureau.record(action);
  }
  const {counts, flags, tier} = bureau.snapshot();
  assert.equal(tier, 3);
  assert.deepEqual(plain(counts), {requests: 0, checks: 3, appeals: 3, simulations: 3, petitions: 3});
  for (const flag of ['Frequent score checks', 'Appeal spiral', 'Simulation enthusiasm', 'Petition proliferation']) assert.ok(flags.includes(flag));
  assert.equal('score' in bureau.snapshot(), false);
});

test('named signals detect explicit optimization while ordinary points and unrelated optimization do not', () => {
  const {bureau, values} = client();
  for (const text of ['Please explain my points.', 'I am testing the library theory.', 'I optimize a bedtime routine.', 'His ears are pointy.', 'I ate a delicious farm apple.']) {
    assert.equal(bureau.inspect(text).flags.length, 0, text);
  }
  assert.ok(bureau.inspect('I want to min—max my score.').flags.includes('Optimization language'));
  assert.ok(bureau.inspect('Time to farm some points.').flags.includes('Point farming'));
  assert.ok(bureau.inspect('I am hunting a loophole.').flags.includes('Loophole scouting'));
  assert.ok(bureau.inspect('I am an overachiever.').flags.includes('Overachiever declaration'));
  assert.ok(bureau.inspect('PRIVATE-CONTENT-MUST-NOT-PERSIST', 87654).flags.includes('Ambitious adjustment'));
  assert.equal(bureau.snapshot().tier, 2);
  assert.equal(bureau.snapshot().history.length, 0);
  assert.equal(Object.values(bureau.snapshot().counts).every(count => count === 0), true);
  const saved = values.get(visitorKey);
  for (const forbidden of ['PRIVATE-CONTENT-MUST-NOT-PERSIST', '87654', 'min—max', 'farm some points', 'hunting a loophole']) assert.equal(saved.includes(forbidden), false);
  assert.deepEqual(Object.keys(JSON.parse(saved)).sort(), ['feline', 'history', 'human', 'version']);
});

test('signal inspection is idempotent and large adjustment needs a finite numeric value', () => {
  const {bureau} = client();
  let updates = 0;
  bureau.subscribe(() => { updates++; });
  bureau.inspect('How can I improve my score?');
  const first = bureau.snapshot();
  bureau.inspect('How can I improve my score?');
  assert.equal(updates, 1);
  assert.deepEqual(plain(bureau.snapshot()), plain(first));
  for (const value of ['100', NaN, Infinity, -50, 9]) assert.equal(bureau.inspect('', value).flags.includes('Ambitious adjustment'), false);
  assert.equal(bureau.inspect('', 10).flags.includes('Ambitious adjustment'), true);
  assert.equal(updates, 2);
});

test('human and feline histories stay separate, with an explicitly local household connection', () => {
  const {bureau} = client();
  bureau.record('request');
  bureau.record('appeal', 'cat');
  bureau.inspect('I wish to farm points.', 0, 'Feline division');
  const human = bureau.snapshot();
  const cat = bureau.snapshot('feline');
  assert.equal(human.counts.requests, 1);
  assert.equal(human.counts.appeals, 0);
  assert.equal(cat.counts.requests, 0);
  assert.equal(cat.counts.appeals, 1);
  assert.equal(human.flags.includes('Point farming'), false);
  assert.equal(cat.flags.includes('Point farming'), true);
  assert.ok(human.flags.includes('Household portfolio activity'));
  assert.ok(cat.flags.includes('Household portfolio activity'));
  assert.equal(human.tier, 0);
  assert.equal(cat.history[0].division, 'feline');
  assert.equal(bureau.snapshot('Kemberton').counts.appeals, 1);
  assert.match(bureau.describe('feline'), /^Feline division/);
});

test('supplements have stable IDs, bounded depth, and admissible not-applicable answers', () => {
  for (const division of ['human', 'feline']) {
    const {bureau} = client();
    for (let count = 1; count <= 21; count++) {
      bureau.record('request', division);
      const {tier} = bureau.snapshot(division);
      const supplements = bureau.requirements(division);
      assert.equal(supplements.length, Math.min(tier, 3));
      assert.deepEqual(plain(supplements), plain(bureau.requirements(division)));
      assert.equal(new Set(supplements.map(item => item.id)).size, supplements.length);
      for (const item of supplements) {
        for (const field of ['id', 'title', 'prompt', 'attestation']) assert.equal(typeof item[field], 'string');
        assert.ok(item.options.includes('Not applicable; I am here for the vibes.'));
        assert.ok(item.options.length >= 2);
        assert.equal(item.id.startsWith(`${division}-`), true);
      }
    }
  }
});

test('storage persists across page visits and corruption is sanitized without retaining unknown data', () => {
  const values = new Map();
  client({values}).bureau.record('request');
  assert.equal(client({values}).bureau.snapshot().counts.requests, 1);
  values.set(visitorKey, '{broken');
  assert.equal(client({values}).bureau.snapshot().counts.requests, 0);
  values.set(visitorKey, JSON.stringify({version: 1, human: {counts: {requests: 10000000, checks: -3, appeals: 1.9, simulations: 'secret'}, flags: ['Point farming', 'private leaked text']}, secret: 'private', history: [{action: 'request', division: 'human', at: 'private'}, {action: 'request', division: 'human', at: '2026-09-28T13:00:00.000Z', text: 'private'}]}));
  const {bureau} = client({values});
  assert.deepEqual(plain(bureau.snapshot().counts), {requests: 9999, checks: 0, appeals: 1, simulations: 0, petitions: 0});
  assert.deepEqual(plain(bureau.snapshot().flags.filter(flag => flag === 'private leaked text')), []);
  bureau.record('check');
  assert.equal(values.get(visitorKey).includes('private'), false);
  assert.equal(bureau.record('request').counts.requests, 9999);
  values.set(visitorKey, JSON.stringify({version: 99, human: {counts: {requests: 50}}}));
  assert.equal(client({values}).bureau.snapshot().counts.requests, 0);
});

test('blocked storage and full storage keep working in memory and clearly report the limitation', () => {
  for (const options of [{blocked: true}, {quota: true}]) {
    const {bureau} = client(options);
    bureau.record('request');
    bureau.record('check');
    bureau.inspect('min-max');
    const value = bureau.snapshot();
    assert.equal(value.storageAvailable, false);
    assert.equal(value.counts.requests, 1);
    assert.equal(value.counts.checks, 1);
    assert.ok(value.flags.includes('Optimization language'));
    assert.match(bureau.describe(), /counts last only on this page/);
    bureau.reset();
    assert.equal(bureau.snapshot().counts.requests, 0);
    assert.equal(bureau.snapshot().flags.length, 0);
  }
});

test('history is bounded and contains only action, division, and timestamp', () => {
  const {bureau, values} = client();
  for (let count = 0; count < 60; count++) bureau.record('check', count % 2 ? 'human' : 'feline');
  const saved = JSON.parse(values.get(visitorKey));
  assert.equal(saved.history.length, 40);
  assert.equal(bureau.snapshot().history.length, 20);
  assert.equal(bureau.snapshot('feline').history.length, 20);
  assert.equal(bureau.snapshot().counts.checks, 30);
  for (const event of saved.history) {
    assert.deepEqual(Object.keys(event).sort(), ['action', 'at', 'division']);
    assert.ok(Number.isFinite(Date.parse(event.at)));
  }
});

test('test activity never changes visitor history; reset only removes the active app key', () => {
  const values = new Map([['unrelated-preference', 'keep']]);
  const visitor = client({values});
  visitor.bureau.record('request');
  for (const options of [{hostname: 'localhost'}, {hostname: '127.0.0.1'}, {search: '?test=1'}]) client({values, ...options}).bureau.record('petition');
  assert.equal(visitor.bureau.snapshot().counts.petitions, 0);
  assert.equal(client({values, search: '?test=1'}).bureau.snapshot().counts.petitions, 3);
  visitor.bureau.reset();
  assert.equal(values.has(visitorKey), false);
  assert.equal(values.has(testKey), true);
  assert.equal(values.get('unrelated-preference'), 'keep');
  assert.equal(visitor.bureau.snapshot().counts.requests, 0);
});

test('subscribers receive local and cross-tab updates, can unsubscribe, and cannot break completed actions', () => {
  const values = new Map();
  const first = client({values});
  const second = client({values});
  let updates = 0;
  first.bureau.subscribe(() => { throw new Error('Broken view'); });
  const unsubscribe = first.bureau.subscribe(() => { updates++; });
  first.bureau.record('request');
  assert.equal(updates, 1);
  second.bureau.record('check');
  first.change({key: visitorKey, newValue: values.get(visitorKey), storageArea: first.storage});
  assert.equal(updates, 2);
  assert.equal(first.bureau.snapshot().counts.checks, 1);
  first.change({key: testKey, newValue: null});
  first.change({key: visitorKey, newValue: null, storageArea: {}});
  assert.equal(updates, 2);
  values.delete(visitorKey);
  first.change({key: null, newValue: null, storageArea: first.storage});
  assert.equal(updates, 3);
  assert.equal(first.bureau.snapshot().counts.requests, 0);
  unsubscribe();
  first.bureau.record('check');
  assert.equal(updates, 3);
});

test('invalid actions and subscribers fail safely before any data is written', () => {
  const {bureau, values} = client();
  for (const action of ['constructor', '__proto__', 'score', 'upload', null]) assert.throws(() => bureau.record(action), /Unknown bureau action/);
  assert.throws(() => bureau.subscribe('not a callback'), /must be a function/);
  assert.equal(values.size, 0);
});
