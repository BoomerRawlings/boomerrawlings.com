import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

// Exercise the actual routing functions with DOM/network boundaries replaced.
// No password, private collection, or browser persistence is needed.
const compile = async name => (await transform(await readFile(new URL(`../src/scripts/brain/${name}.ts`, import.meta.url), 'utf8'), { loader: 'ts', target: 'es2022' })).code;
const portal = await compile('portal');
const app = await compile('app');
function body(source, name) {
  const match = new RegExp(`(?:async )?function ${name}\\([^)]*\\)\\s*\\{`).exec(source);
  assert.ok(match, `${name} is available for behavioral checks`);
  const start = match.index + match[0].length;
  let depth = 1, quote = '', escaped = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return source.slice(start, i);
  }
  throw new Error(`Unclosed ${name}`);
}
const routeBody = body(portal, 'route');
const setModeBody = body(app, 'setMode');
function fixture(hash, room, access = false) {
  const f = { hash, room, access, redirects: [], history: [], opened: [], scopes: [] };
  f.location = {
    hash,
    replace(value) { f.redirects.push(value); },
    assign(value) { f.redirects.push(value); },
  };
  f.historyApi = { replaceState(_state, _title, value) { f.history.push(value); f.location.hash = value; } };
  return f;
}
async function runRoute(f) {
  const run = new Function('f', `
    const location = f.location, history = f.historyApi;
    const isLectureRoom = () => f.room, hasLectureAccess = () => f.access;
    const privateStudyMode = mode => ['lectures','practice','recall','paths'].includes(mode);
    const document = { getElementById: () => null, body: { classList: { add() {} } } };
    const window = { scrollTo() {} }, portal = {}, header = {}, back = {}, legacy = { hidden: true };
    const stage = { classList: { add() {}, remove() {} }, replaceChildren() {}, querySelector: () => null };
    let routeVersion = 0, pendingPrivateHash = '', unlocked = true, legacyReady, scene = {}, moving = false;
    const resetCloudMotion = () => {}, updateMotion = () => {};
    const showLegacy = async version => f.opened.push(version);
    const resolveStudyScope = () => ({ scope: null, blocked: false });
    const scopeMenu = course => f.scopes.push(course);
    const setTimeout = callback => callback();
    return (async () => { ${routeBody} })().then(() => ({ pendingPrivateHash }));
  `);
  return run(f);
}

test('old course and practice deep links move to the private lecture route', async () => {
  for (const hash of ['#study=105', '#study=108&scope=general&step=cards', '#mode=lectures', '#mode=practice', '#mode=paths']) {
    const f = fixture(hash, false);
    await runRoute(f);
    assert.deepEqual(f.redirects, [`/brain/lectures/${hash}`]);
    assert.deepEqual(f.scopes, []);
    assert.deepEqual(f.opened, []);
  }
});

test('private course deep links cannot render study tools before live unlock', async () => {
  for (const hash of ['#study=105', '#study=108&scope=general&step=cards', '#mode=practice']) {
    const f = fixture(hash, true);
    const result = await runRoute(f);
    assert.equal(result.pendingPrivateHash, hash);
    assert.equal(f.location.hash, '#mode=lectures');
    assert.equal(f.opened.length, 1);
    assert.deepEqual(f.scopes, []);
  }
});

test('a direct lecture visit opens the existing gate and a live unlock permits course tools', async () => {
  const closed = fixture('', true);
  await runRoute(closed);
  assert.equal(closed.location.hash, '#mode=lectures');
  assert.equal(closed.opened.length, 1);
  const opened = fixture('#study=108', true, true);
  await runRoute(opened);
  assert.deepEqual(opened.scopes, ['108']);
  assert.deepEqual(opened.redirects, []);
});

test('atlas study-mode controls cannot expose archived tools on the public route', () => {
  const call = new Function('f', 'nextMode', `
    const location = f.location, isLectureRoom = () => false;
    const privateStudyMode = mode => ['lectures','practice','recall','paths'].includes(mode);
    ${setModeBody}
  `);
  for (const mode of ['lectures', 'recall', 'paths']) {
    const f = fixture('', false);
    call(f, mode);
    assert.deepEqual(f.redirects, [`/brain/lectures/#mode=${mode === 'recall' ? 'practice' : mode}`]);
  }
});
