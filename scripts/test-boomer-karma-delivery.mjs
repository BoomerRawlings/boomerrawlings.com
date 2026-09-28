import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';

const source = readFileSync(new URL('../public/scripts/boomer-karma-delivery.js', import.meta.url), 'utf8');
function client(hostname = 'boomerrawlings.com', search = '') {
  const calls = [];
  const notices = [];
  const homeLink = {href: '/BoomerKarma/', getAttribute(name) { return this[name]; }, setAttribute(name, value) { this[name] = value; }};
  const window = {};
  let respond = async () => ({ok: true, json: async () => ({success: 'true'})});
  runInNewContext(source, {
    window, location: {hostname, search}, URLSearchParams, Intl, Date, AbortSignal, Blob, File, FormData,
    crypto: {randomUUID}, console: {warn() {}},
    document: {
      createElement: () => ({}),
      querySelector: selector => selector === 'main' ? {prepend: notice => notices.push(notice.textContent)} : {value: ''},
      querySelectorAll: () => [homeLink],
    },
    fetch: async (url, options) => { const call = {url, ...options, body: typeof options.body === 'string' ? JSON.parse(options.body) : Object.fromEntries(options.body)}; calls.push(call); return respond(call); },
  });
  return {send: window.BoomerKarmaDelivery.send, calls, notices, homeLink, respond: handler => { respond = handler; }};
}
const answers = {'Submitted message': 'My exact words.\nA second line — with punctuation.', Purpose: 'Routine vibe maintenance'};

test('visitor messages have readable fields, Pacific time, unique subjects and no test label', async () => {
  const app = client();
  assert.equal(await app.send('report', answers), true);
  const first = app.calls[0];
  assert.match(first.body._subject, /^BoomerKarma \| Report request \| BK-\d{8}-[0-9A-F]{8}$/);
  assert.equal(first.body['Submitted message'], answers['Submitted message']);
  assert.equal(first.body.Purpose, answers.Purpose);
  assert.match(first.body['Submitted (Pacific time)'], /P[DS]T$/);
  assert.equal(first.body.Submission, 'Website submission — Report request');
  assert.equal(first.referrerPolicy, 'origin');
  assert.equal(first.credentials, 'omit');
  assert.equal('paperwork' in first.body, false);
  assert.equal(app.notices.length, 0);
  assert.equal(app.homeLink.href, '/BoomerKarma/');
  await app.send('report', answers);
  assert.notEqual(app.calls[1].body._subject, first.body._subject);
  assert.notEqual(app.calls[1].body.Reference, first.body.Reference);
});

test('localhost and explicit production tests have unmistakable subject, body and page notice', async () => {
  for (const [host, query] of [['127.0.0.1', ''], ['localhost', ''], ['boomerrawlings.com', '?test=1']]) {
    const app = client(host, query);
    await app.send('appeal', answers);
    assert.match(app.calls[0].body._subject, /^\[TEST ONLY\] BoomerKarma \| Points appeal/);
    assert.match(app.calls[0].body.Submission, /^TEST ONLY/);
    assert.match(app.calls[0].body['Action needed'], /delivery test/);
    assert.match(app.notices[0], /TEST MODE/);
    assert.equal(app.homeLink.href, '/BoomerKarma/?test=1');
  }
});

test('failed retries keep their reference; changing answers starts a new reference', async () => {
  const app = client();
  app.respond(async () => ({ok: true, json: async () => ({success: false})}));
  await assert.rejects(app.send('report', answers));
  await assert.rejects(app.send('report', answers));
  assert.equal(app.calls[0].body.Reference, app.calls[1].body.Reference);
  app.respond(async () => ({ok: true, json: async () => ({success: true})}));
  await app.send('report', {...answers, Purpose: 'Changed my answer'});
  assert.notEqual(app.calls[1].body.Reference, app.calls[2].body.Reference);
});

test('concurrent duplicates and malformed content never send another email', async () => {
  const app = client();
  let finish;
  app.respond(() => new Promise(resolve => { finish = resolve; }));
  const pending = app.send('report', answers);
  await assert.rejects(app.send('report', answers));
  assert.equal(app.calls.length, 1);
  finish({ok: true, json: async () => ({success: 'true'})});
  await pending;
  for (const value of ['', {}, {'Submitted message': '  '}, {'Submitted message': 'ok', _subject: 'override'}, {'Submitted message': 2}]) {
    await assert.rejects(app.send('report', value));
  }
  assert.equal(app.calls.length, 1);
});

test('cat reports require a JPEG attachment and send multipart without overriding its boundary', async () => {
  const app = client('boomerrawlings.com', '?test=1');
  await assert.rejects(app.send('cat-report', answers));
  await assert.rejects(app.send('cat-report', answers, {attachment: new Blob(['svg'], {type: 'image/svg+xml'})}));
  assert.equal(app.calls.length, 0);
  const file = new File(['test image bytes'], 'portrait.jpg', {type: 'image/jpeg'});
  app.respond(async call => ({ok: true, redirected: true, url: call.body._next}));
  assert.equal(await app.send('cat-report', answers, {attachment: file}), true);
  assert.match(app.calls[0].body._subject, /^\[TEST ONLY\] BoomerKarma \| Kemberton score request/);
  assert.equal(app.calls[0].body.attachment.type, 'image/jpeg');
  assert.equal(app.calls[0].body.attachment.size, file.size);
  assert.equal('Content-Type' in app.calls[0].headers, false);
  assert.equal(app.calls[0].body['Submitted message'], answers['Submitted message']);
  assert.equal(app.calls[0].url.includes('/ajax/'), false);
  assert.equal(app.calls[0].body._next, `https://formsubmit.co/?boomerkarma_receipt=${app.calls[0].body.Reference}`);
});

test('cat delivery requires its exact success redirect, not a 200 error page or AJAX success', async () => {
  const app = client();
  const attachment = new File(['image'], 'cat.jpg', {type: 'image/jpeg'});
  for (const response of [
    {ok: true, redirected: false, url: 'https://formsubmit.co/'},
    {ok: true, redirected: true, url: 'https://formsubmit.co/?boomerkarma_receipt=wrong'},
    {ok: true, json: async () => ({success: true})},
    {ok: false},
  ]) {
    app.respond(async () => response);
    await assert.rejects(app.send('cat-report', answers, {attachment}));
  }
  assert.equal(new Set(app.calls.map(call => call.body.Reference)).size, 1);
  app.respond(async call => ({ok: true, redirected: true, url: call.body._next}));
  assert.equal(await app.send('cat-report', answers, {attachment}), true);
});
