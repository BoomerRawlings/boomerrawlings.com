import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { test } from 'node:test';
import { assertFresh, parsePhotoTimestamp } from '../src/scripts/kem-freshness.js';

// Run the application itself against an in-memory DOM and camera. No network,
// recognizer weights, photos, or email provider are involved in this harness.
const source = readFileSync(new URL('../src/scripts/kem-application.js', import.meta.url), 'utf8')
  .replace(/^import .*from '\.\/kem-freshness\.js';\r?\n/m, '')
  .replace(/^import .*from '\.\/kem-detector\.js';\r?\n/m, '')
  .replace("import('exifr')", 'mockExif()');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function app() {
  let clock = Date.parse('2026-09-28T20:24:00Z');
  let recognition = async () => ({ isCat: true, confidence: 0.88 });
  let metadata = async () => ({ DateTimeOriginal: new Date(clock - 1000).toISOString() });
  let camera = async () => newStream();
  let send = async () => true;
  const deliveries = [], revoked = [], tracks = [], stored = new Map();
  function newStream() {
    const track = { stopped: false, stop() { this.stopped = true; } };
    tracks.push(track);
    return { getTracks: () => [track] };
  }
  class Element {
    constructor() { this.events = {}; this.hidden = false; this.disabled = false; this.value = ''; this.checked = true; this.textContent = ''; this.children = []; }
    addEventListener(name, handler) { (this.events[name] ??= []).push(handler); }
    async dispatch(name, event = {}) { for (const handler of this.events[name] ?? []) await handler({ preventDefault() {}, ...event }); }
    querySelectorAll() { return []; }
    querySelector() { return new Element(); }
    checkValidity() { return true; }
    closest() { return { textContent: 'Authorized declaration' }; }
    focus() {}
    scrollIntoView() {}
    replaceChildren() { this.children = []; }
    append(...children) { this.children.push(...children); }
    removeAttribute(name) { delete this[name]; }
    setAttribute(name, value) { this[name] = value; }
  }
  const nodes = new Map();
  function node(selector) { if (!nodes.has(selector)) nodes.set(selector, new Element()); return nodes.get(selector); }
  const steps = Array.from({ length: 5 }, (_, index) => Object.assign(new Element(), { dataset: { title: `Department ${index}` } }));
  node('#kem-form').querySelectorAll = selector => selector === '.kem-step' ? steps : [node('#kem-final')];
  node('#kem-form').reset = () => { node('#kem-statement').value = ''; node('#kem-photo-input').value = ''; };
  node('#kem-statement').value = 'This excellent applicant has a compelling case for a complete and timely report.';
  node('#kem-purpose').value = 'Routine feline vibe maintenance';
  node('#kem-capacity').value = 'Primary human';
  node('#kem-alias').value = 'Kem';
  node('#kem-score').textContent = '+6';
  Object.assign(node('#kem-video'), { videoWidth: 640, videoHeight: 480, play: async () => {} });
  node('#kem-report').hidden = true;
  const document = Object.assign(new Element(), {
    hidden: false,
    querySelector: node,
    createElement(tag) {
      if (tag !== 'canvas') return new Element();
      return { width: 0, height: 0, getContext: () => ({ drawImage() {} }), toBlob: callback => callback(new Blob(['reencoded portrait'], { type: 'image/jpeg' })) };
    },
  });
  const window = Object.assign(new Element(), {
    BoomerKarmaDelivery: { async send(...args) { deliveries.push(args); return send(...args); } },
  });
  class Clock extends Date { static now() { return clock; } }
  class MockImage {
    naturalWidth = 640;
    naturalHeight = 480;
    set src(value) { this.url = value; queueMicrotask(() => this.onload()); }
  }
  let urlCounter = 0;
  const context = createContext({
    document, window, navigator: { mediaDevices: { getUserMedia: (...args) => camera(...args) } },
    Date: Clock, Blob, File, Image: MockImage, console,
    URL: { createObjectURL: () => `blob:portrait-${++urlCounter}`, revokeObjectURL: value => revoked.push(value) },
    sessionStorage: { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) },
    assertFresh: timestamp => assertFresh(timestamp, clock),
    parsePhotoTimestamp: tags => parsePhotoTimestamp(tags, { now: clock }),
    detectCat: canvas => recognition(canvas),
    mockExif: async () => ({ default: { parse: (...args) => metadata(...args) } }),
  });
  runInContext(source, context);
  return {
    node, document, window, deliveries, revoked, tracks, stored, newStream,
    get now() { return clock; }, advance(milliseconds) { clock += milliseconds; },
    detect: handler => { recognition = handler; }, exif: handler => { metadata = handler; },
    camera: handler => { camera = handler; }, delivery: handler => { send = handler; },
    step: index => runInContext(`showStep(${index})`, context),
    upload: () => { context.fixturePhoto = new File(['fixture, never transmitted'], 'fixture.jpg', { type: 'image/jpeg' }); return runInContext('validateUpload(fixturePhoto)', context); },
    portrait: () => runInContext('photo', context),
    submit: () => node('#kem-form').dispatch('submit'),
  };
}

test('accepted uploads create a metadata-free attachment, then clear originals after delivery', async () => {
  const page = app();
  await page.upload();
  assert.equal(page.portrait().file.name, 'kemberton-portrait.jpg');
  assert.equal(await page.portrait().file.text(), 'reencoded portrait');
  page.step(4);
  await page.submit();
  assert.equal(page.deliveries.length, 1);
  assert.equal(page.deliveries[0][0], 'cat-report');
  assert.match(page.deliveries[0][1]['Timestamp source'], /EXIF DateTimeOriginal/);
  assert.equal(page.node('#kem-report').hidden, false);
  assert.equal(page.node('#kem-gate').hidden, true);
  assert.equal(page.portrait(), null);
  assert.equal(page.node('#kem-statement').value, '');
  assert.equal(page.stored.size, 1);
  assert.equal([...page.stored.values()][0], 'true');
});

test('rejecting a replacement cannot retain the earlier accepted portrait', async () => {
  const page = app();
  await page.upload();
  const oldPreview = page.node('#kem-preview').src;
  page.detect(async () => ({ isCat: false, confidence: 0.12 }));
  await page.upload();
  assert.equal(page.portrait(), null);
  assert.equal(page.node('#kem-preview').hidden, true);
  assert.ok(page.revoked.includes(oldPreview));
  page.step(3);
  await page.submit();
  assert.equal(page.deliveries.length, 0);
  assert.match(page.node('#kem-error').textContent, /pass inspection/);
});

test('stale metadata fails before recognition and retains no portrait', async () => {
  const page = app();
  let detected = false;
  page.exif(async () => ({ DateTimeOriginal: new Date(page.now - 300_001).toISOString() }));
  page.detect(async () => { detected = true; return { isCat: true, confidence: 0.99 }; });
  await page.upload();
  assert.equal(detected, false);
  assert.equal(page.portrait(), null);
  assert.match(page.node('#kem-photo-status').textContent, /last 5 minutes/);
});

test('recognition that outlasts the age window cannot accept an expired portrait', async () => {
  const page = app();
  page.detect(async () => { page.advance(300_000); return { isCat: true, confidence: 0.99 }; });
  await page.upload();
  assert.equal(page.portrait(), null);
  assert.match(page.node('#kem-photo-status').textContent, /last 5 minutes/);
});

test('final submission rechecks photo age and returns to portrait collection without sending', async () => {
  const page = app();
  await page.upload();
  page.step(4);
  page.advance(300_000);
  await page.submit();
  assert.equal(page.deliveries.length, 0);
  assert.equal(page.portrait(), null);
  assert.match(page.node('#kem-step-label').textContent, /Step 4 of 5/);
  assert.match(page.node('#kem-error').textContent, /last 5 minutes/);
});

test('failed sends preserve answers and portrait; concurrent requests cannot duplicate send', async () => {
  const page = app();
  await page.upload();
  page.step(4);
  const receipt = deferred();
  page.delivery(() => receipt.promise);
  const first = page.submit();
  await page.submit();
  assert.equal(page.deliveries.length, 1);
  receipt.reject(new Error('simulated offline, no provider called'));
  await first;
  assert.ok(page.portrait());
  assert.ok(page.node('#kem-statement').value.length);
  assert.equal(page.node('#kem-report').hidden, true);
  assert.equal(page.node('#kem-next').disabled, false);
  assert.match(page.node('#kem-error').textContent, /still here/);
});

test('camera capture stops all tracks and uses capture time instead of file dates', async () => {
  const page = app();
  await page.node('#kem-start-camera').dispatch('click');
  assert.equal(page.tracks[0].stopped, false);
  await page.node('#kem-capture').dispatch('click');
  assert.equal(page.tracks[0].stopped, true);
  assert.equal(page.portrait().capturedAt, page.now);
  assert.equal(page.portrait().source, 'Live bureau camera capture');
});

test('page restoration after an interrupted inspection leaves controls usable', async () => {
  const page = app();
  const detection = deferred();
  const entered = deferred();
  page.detect(() => { entered.resolve(); return detection.promise; });
  const upload = page.upload();
  await entered.promise;
  await page.window.dispatch('pagehide');
  await page.window.dispatch('pageshow', { persisted: true });
  detection.resolve({ isCat: true, confidence: 0.99 });
  await upload;
  assert.equal(page.portrait(), null);
  assert.equal(page.node('#kem-next').disabled, false);
  assert.equal(page.node('#kem-start-camera').disabled, false);
});

test('pending camera access cannot activate after page becomes hidden', async () => {
  const page = app();
  const permission = deferred();
  page.camera(() => permission.promise);
  const opening = page.node('#kem-start-camera').dispatch('click');
  page.document.hidden = true;
  await page.document.dispatch('visibilitychange');
  permission.resolve(page.newStream());
  await opening;
  assert.equal(page.tracks[0].stopped, true);
  assert.equal(page.node('#kem-video').hidden, true);
  assert.equal(page.node('#kem-start-camera').disabled, false);
});

test('a cancelled video play cannot reveal camera controls after restoration', async () => {
  const page = app();
  const playing = deferred();
  const entered = deferred();
  page.node('#kem-video').play = () => { entered.resolve(); return playing.promise; };
  const opening = page.node('#kem-start-camera').dispatch('click');
  await entered.promise;
  await page.window.dispatch('pagehide');
  await page.window.dispatch('pageshow', { persisted: true });
  playing.resolve();
  await opening;
  assert.equal(page.tracks[0].stopped, true);
  assert.equal(page.node('#kem-video').hidden, true);
  assert.equal(page.node('#kem-capture').hidden, true);
  assert.equal(page.node('#kem-start-camera').disabled, false);
});

test('unchanged retries retain first-send metadata while still rechecking freshness', async () => {
  const page = app();
  await page.upload();
  page.step(4);
  page.delivery(async () => { throw new Error('simulated lost receipt'); });
  await page.submit();
  page.advance(10_000);
  await page.submit();
  assert.equal(page.deliveries.length, 2);
  assert.deepEqual(page.deliveries[0][1], page.deliveries[1][1]);
  assert.match(page.deliveries[0][1]['Photo age at first send'], /^1 seconds/);
  page.advance(300_000);
  await page.submit();
  assert.equal(page.deliveries.length, 2);
  assert.equal(page.portrait(), null);
});

test('pagehide preserves a pending send lock until the delivery settles', async () => {
  const page = app();
  await page.upload();
  page.step(4);
  const receipt = deferred();
  page.delivery(() => receipt.promise);
  const sending = page.submit();
  await page.window.dispatch('pagehide');
  await page.window.dispatch('pageshow', { persisted: true });
  await page.submit();
  assert.equal(page.deliveries.length, 1);
  assert.equal(page.node('#kem-next').disabled, true);
  receipt.reject(new Error('simulated offline'));
  await sending;
  assert.equal(page.node('#kem-next').disabled, false);
  assert.ok(page.portrait());
});
