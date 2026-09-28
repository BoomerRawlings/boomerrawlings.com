import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext, runInContext} from 'node:vm';
import {test} from 'node:test';
import {parseFragment} from 'parse5';

// Exercise the real forms and application scripts with deterministic bureau
// decisions. No visitor storage, recognizer, camera, or email provider is used.
class Element {
  constructor(tag = 'div', attrs = {}) {
    this.tagName = tag; this.attrs = {...attrs}; this.children = []; this.events = {};
    this.value = attrs.value || ''; this.checked = 'checked' in attrs;
    this.disabled = 'disabled' in attrs; this.hidden = 'hidden' in attrs;
    this.required = 'required' in attrs; this.type = attrs.type || '';
    this.name = attrs.name || ''; this.id = attrs.id || ''; this.className = attrs.class || '';
    this.dataset = Object.fromEntries(Object.entries(attrs).filter(([key]) => key.startsWith('data-')).map(([key, value]) => [key.slice(5), value]));
    this.elements = {namedItem: name => this.querySelector(`[name="${name}"]`)};
  }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  get textContent() { return this.text ?? this.children.map(node => node.textContent).join(''); }
  set textContent(value) { this.text = value; this.children = []; }
  get innerText() { return this.textContent; }
  get valueAsNumber() { return Number(this.value); }
  matches(selector) {
    const attrs = [...selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];
    const base = selector.replace(/\[[^\]]+\]/g, '');
    if (base.startsWith('#') && this.id !== base.slice(1)) return false;
    if (base.startsWith('.') && !this.className.split(' ').includes(base.slice(1))) return false;
    if (base && !base.startsWith('#') && !base.startsWith('.') && this.tagName !== base) return false;
    return attrs.every(([, name, value]) => value === undefined ? Object.hasOwn(this.attrs, name) : String(this[name] ?? this.attrs[name]) === value);
  }
  querySelectorAll(selector) {
    const choices = selector.split(',').map(value => value.trim().split(/\s+/));
    const descendants = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
    if (selector === '*') return descendants;
    return descendants.filter(node => choices.some(parts => {
      if (!node.matches(parts.at(-1))) return false;
      let parent = node.parent;
      for (let index = parts.length - 2; index >= 0; index--) {
        while (parent && !parent.matches(parts[index])) parent = parent.parent;
        if (!parent) return false;
        parent = parent.parent;
      }
      return true;
    }));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { let node = this; while (node && !node.matches(selector)) node = node.parent; return node; }
  addEventListener(type, callback) { (this.events[type] ??= []).push(callback); }
  async dispatch(type) { for (const callback of this.events[type] || []) await callback({preventDefault() {}}); }
  setAttribute(name, value) { this.attrs[name] = value; }
  removeAttribute(name) { delete this.attrs[name]; }
  focus() { this.focused = true; }
  scrollIntoView() {}
  checkValidity() { return !this.required || (this.type === 'checkbox' ? this.checked : Boolean(this.value)); }
  reportValidity() { return this.checkValidity() && this.querySelectorAll('input, select, textarea').every(field => field.checkValidity()); }
  setCustomValidity(value) { this.customValidity = value; }
  reset() { for (const field of this.querySelectorAll('input, select, textarea')) { field.value = ''; field.checked = false; } }
  close() {}
  cloneNode() { const copy = new Element(this.tagName, this.attrs); copy.textContent = this.textContent; return copy; }
}

function documentFrom(html) {
  function convert(source) {
    const node = new Element(source.tagName || 'text', Object.fromEntries((source.attrs || []).map(attr => [attr.name, attr.value])));
    if (source.nodeName === '#text') node.textContent = source.value;
    for (const child of source.childNodes || []) node.append(convert(child));
    return node;
  }
  const document = convert(parseFragment(html));
  document.createElement = tag => new Element(tag);
  return document;
}

const requirement = id => ({id, title: `Form ${id}`, prompt: 'Explain the administrative interest', options: ['Here for the vibes', 'Just checking'], attestation: `I acknowledge ${id} adds zero points.`});
function application(division, required = []) {
  const feline = division === 'feline';
  const appeal = division === 'appeal';
  const filename = feline ? '../src/pages/BoomerKarma/Kemberton/index.astro' : appeal ? '../src/pages/BoomerKarma/index.astro' : '../src/components/KarmaApplication.astro';
  const document = documentFrom(readFileSync(new URL(filename, import.meta.url), 'utf8'));
  const score = new Element('span'); score.id = 'karma-score'; score.textContent = '20'; document.append(score);
  const report = new Element('div'); report.id = 'report'; document.append(report);
  const inspections = [], deliveries = [], stored = new Map();
  let requirements = required;
  let delivery = async () => true;
  const window = Object.assign(new Element(), {
    BoomerKarmaBureau: {inspect: (...args) => inspections.push(args), requirements: () => requirements},
    BoomerKarmaDelivery: {send: async (...args) => { deliveries.push(args); return delivery(...args); }},
  });
  let source = readFileSync(new URL(feline ? '../src/scripts/kem-application.js' : appeal ? '../public/scripts/boomer-karma.js' : '../public/scripts/karma-application.js', import.meta.url), 'utf8');
  if (feline) source = source.replace(/^import .*;\r?\n/gm, '');
  else if (!appeal) source = source.replace(/\}\)\(\);\s*$/, 'window.harness = {showStep, completedPaperwork};})();');
  const context = createContext({document, window, navigator: {}, console, Date, File, Blob, URL, sessionStorage: {getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value)}, assertFresh: timestamp => { assert.ok(Date.now() - timestamp < 300000); }});
  runInContext(source, context);
  const form = document.querySelector(feline ? '#kem-form' : appeal ? '#appeal-form' : '#application-form');
  return {
    document, window, context, form, deliveries, inspections, stored,
    node: selector => document.querySelector(selector),
    requirements: value => { requirements = value; }, delivery: value => { delivery = value; },
    step: index => feline ? runInContext(`showStep(${index})`, context) : window.harness.showStep(index),
    current: () => feline ? runInContext('step', context) : Number(document.querySelector('#application-progress').value) - 1,
    submit: () => form.dispatch('submit'),
    fillSupplements() { for (const field of document.querySelectorAll('.bureau-supplements select')) field.value = 'Here for the vibes'; for (const field of document.querySelectorAll('.bureau-supplements input')) field.checked = true; },
  };
}

test('first ordinary human report requires no supplemental paperwork', () => {
  const page = application('human'); page.step(6);
  assert.equal(page.node('#application-supplements').hidden, true);
  assert.equal(page.document.querySelectorAll('.bureau-supplements select').length, 0);
  assert.equal(page.inspections[0][2], 'human');
});

test('human supplements block incomplete answers and retain answers on back navigation', async () => {
  const page = application('human', [requirement('repeat')]); page.step(6);
  for (const field of page.form.querySelectorAll('input[type="checkbox"]')) field.checked = true;
  await page.submit(); assert.equal(page.current(), 6);
  page.fillSupplements(); await page.submit(); assert.equal(page.current(), 7);
  page.step(6); assert.equal(page.node('#human-supplement-repeat').value, 'Here for the vibes');
  page.requirements([requirement('escalated')]); page.step(6);
  assert.equal(page.node('#human-supplement-repeat'), null);
  assert.equal(page.node('#human-supplement-escalated').value, '');
});

test('human email includes supplemental answers and attestation once only', () => {
  const page = application('human', [requirement('repeat')]); page.step(6); page.fillSupplements();
  const answers = page.window.harness.completedPaperwork();
  assert.match(answers['Additional paperwork'], /Form repeat\n.*: Here for the vibes\nYes — I acknowledge repeat/);
  assert.doesNotMatch(answers.Declarations, /I acknowledge repeat/);
  page.step(7); assert.equal(page.node('#review-supplements').textContent, answers['Additional paperwork']);
});

test('cat paperwork appears before portraits and blocks until every supplement is complete', async () => {
  const page = application('feline', [requirement('repeat'), requirement('optimizer')]); page.step(2);
  page.node('#kem-statement').value = 'I am making a perfectly normal request for this extremely distinguished domestic cat today.';
  for (const field of page.form.querySelectorAll('input[type="checkbox"]')) field.checked = true;
  await page.submit(); assert.equal(page.current(), 2);
  assert.equal(page.document.querySelectorAll('.bureau-supplements select').length, 2);
  assert.match(page.node('#kem-error').textContent, /additional department/);
  await page.submit(); assert.equal(page.current(), 2);
  page.fillSupplements(); await page.submit(); assert.equal(page.current(), 3);
  page.step(2); await page.submit(); assert.equal(page.current(), 3);
  assert.equal(page.node('#feline-supplement-repeat').value, 'Here for the vibes');
  assert.equal(page.deliveries.length, 0);
  assert.equal(page.inspections[0][2], 'feline');
});

test('cat failed delivery retains supplements and retries send each attestation once', async () => {
  const page = application('feline', [requirement('optimizer')]); page.step(2);
  await page.submit(); page.fillSupplements();
  page.node('#kem-statement').value = 'This applicant requests an official report for his records and appreciates the committee today.';
  runInContext("photo = {capturedAt: Date.now(), confidence: .9, source: 'QA, no portrait sent', file: new File(['fixture'], 'fixture.jpg', {type: 'image/jpeg'})}", page.context);
  page.step(4); page.node('#kem-final').checked = true;
  page.delivery(async () => { throw new Error('Offline fixture'); });
  await page.submit(); assert.equal(page.node('#feline-supplement-optimizer').value, 'Here for the vibes');
  assert.match(page.deliveries[0][1]['Additional paperwork'], /Yes — I acknowledge optimizer/);
  assert.doesNotMatch(page.deliveries[0][1].Declarations, /I acknowledge optimizer/);
  page.delivery(async () => true); await page.submit();
  assert.equal(page.deliveries.length, 2);
  assert.equal(page.deliveries[0][1]['Additional paperwork'], page.deliveries[1][1]['Additional paperwork']);
  assert.equal(page.node('#kem-report').hidden, false);
});

test('cat repeat requests reset paperwork while keeping access to the issued report', async () => {
  const page = application('feline', [requirement('repeat')]); page.step(2);
  await page.submit(); page.fillSupplements();
  page.stored.set('boomerkarma-kemberton-issued-v1', 'true');
  page.node('#kem-statement').value = 'Earlier statement';
  await page.node('#kem-request-again').dispatch('click');
  assert.equal(page.current(), 0);
  assert.equal(page.node('#kem-statement').value, '');
  assert.equal(page.node('#kem-supplements').hidden, true);
  assert.equal(page.node('#kem-report').hidden, true);
  assert.equal(page.node('#kem-return-issued').hidden, false);
  assert.equal(page.stored.get('boomerkarma-kemberton-issued-v1'), 'true');
  await page.node('#kem-return-issued').dispatch('click');
  assert.equal(page.node('#kem-report').hidden, false);
  assert.equal(page.node('#kem-gate').hidden, true);
  assert.equal(page.deliveries.length, 0);
});

test('appeal detects ambition, requires new answers, and preserves them after a delivery failure', async () => {
  const page = application('appeal', [requirement('ambition')]);
  page.node('#appeal-reason').value = 'I would simply like more points.';
  page.node('#appeal-statement').value = 'I would like to maximize my very official score, please.';
  page.node('#appeal-points').value = '99';
  page.form.querySelector('input[type="checkbox"]').checked = true;
  await page.submit(); assert.equal(page.deliveries.length, 0);
  assert.deepEqual(page.inspections[0], [page.node('#appeal-statement').value, 99, 'human']);
  await page.submit(); assert.equal(page.deliveries.length, 0);
  page.form.querySelector('[name="appeal-ambition"]').value = 'Here for the vibes';
  page.form.querySelector('[name="appeal-ambition-confirmed"]').checked = true;
  page.delivery(async () => { throw new Error('Offline fixture'); });
  await page.submit(); assert.equal(page.deliveries.length, 1);
  assert.equal(page.form.hidden, false);
  assert.match(page.node('#appeal-send-status').textContent, /still here/);
  page.delivery(async () => true); await page.submit();
  assert.equal(page.deliveries.length, 2);
  assert.equal(page.deliveries[0][1]['Additional paperwork'], page.deliveries[1][1]['Additional paperwork']);
  assert.match(page.deliveries[1][1]['Additional paperwork'], /Yes — I acknowledge ambition/);
  assert.doesNotMatch(page.deliveries[1][1].Acknowledgment, /I acknowledge ambition/);
  assert.equal(page.form.hidden, true);
  assert.equal(page.node('#appeal-result').hidden, false);
  assert.match(page.node('#appeal-receipt').value, /Additional paperwork:/);
});
