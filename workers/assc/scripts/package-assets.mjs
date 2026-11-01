import { copyFile, mkdir, readdir, lstat, rm, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, '.build/assets');
if (relative(root, output) !== `.build${sep}assets`) throw new Error('Unexpected build target');
// The checked absolute target is confined to this app's generated assets.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const manifest = [];
const corpus = JSON.parse(await readFile(resolve(root, '.private/corpus.json'), 'utf8'));
const portraitNames = new Set([...(corpus.people || []), ...(corpus.nodes || [])].map(row => typeof row.portrait === 'string' ? row.portrait : row.portrait?.url).filter(Boolean).map(url => {
  if (!/^\/ASSC\/portraits\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(url)) throw new Error('Invalid protected portrait path');
  return url.split('/').pop();
}));
async function copy(name) {
  const source = resolve(root, name), local = relative(root, source);
  if (local.startsWith('..') || local.split(sep).includes('auth.json')) throw new Error('Disallowed asset');
  const stat = await lstat(source);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Asset is not a regular file: ${name}`);
  if (stat.size > 24 * 1024 * 1024) throw new Error(`Asset exceeds Worker asset limit: ${name}`);
  const destination = resolve(output, '_protected', name.replace(/^\.private\//, 'private/'));
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
  const bytes = await readFile(destination);
  manifest.push({ path: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
for (const name of ['gate.html','gate.css','gate.js','assc-logo.png','app.html','app.css','app.js','graph.js','graph.css','timeline.js','timeline.css']) await copy(`client/${name}`);
for (const name of ['corpus.json','transcripts.json']) await copy(`.private/${name}`);
for (const [directory, pattern] of [
  ['portraits', /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/],
  ['originals', /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,160}$/],
  ['transcripts', /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,160}\.json$/]
]) {
  let entries;
  try { entries = await readdir(resolve(root, '.private', directory)); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  for (const name of entries.sort()) {
    if (directory === 'portraits' && !portraitNames.has(name)) continue;
    if (!pattern.test(name) || /\.(map|env)$/i.test(name) || name === 'auth.json') throw new Error(`Unapproved private asset filename: ${directory}/${name}`);
    await copy(`.private/${directory}/${name}`);
  }
}
await writeFile(resolve(root, '.build/assets-manifest.json'), JSON.stringify({ version: 1, files: manifest }, null, 2) + '\n');
console.log(`Packaged ${manifest.length} protected assets. No credentials or source maps included.`);
