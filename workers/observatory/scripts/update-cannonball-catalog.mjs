import fs from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configuredCatalog } from '../catalog.mjs';

const privateDirectory = resolve(fileURLToPath(new URL('../.private/', import.meta.url)));
const maximumBytes = 20000;
const replacement = Object.freeze({
  id: 'cannonball',
  title: 'Cannonball',
  kicker: 'Campus time trial',
  description: 'North Point to Gilman Gateway. Explore the course, submit a run, and compare verified times.',
  href: 'https://ucsdcannonball.com/',
  accent: '#ffcd00',
  symbol: 'race',
});

function validCatalog(value) {
  try { return Boolean(configuredCatalog(JSON.stringify(value))); }
  catch { return false; }
}

export function migrateCannonballCatalog(source) {
  if (!validCatalog(source)) throw new Error('Invalid source catalog.');
  const targets = source.destinations.filter(item => item.id === 'brain');
  if (targets.length !== 1) throw new Error('Expected exactly one target destination.');
  if (source.destinations.some(item => item.id === 'cannonball')) throw new Error('Destination identifier already exists.');
  const result = {
    ...source,
    destinations: source.destinations.map(item => item.id === 'brain' ? { ...replacement } : { ...item }),
  };
  if (!validCatalog(result)) throw new Error('Invalid output catalog.');
  return result;
}

function isWithin(directory, file) {
  const child = relative(directory, file);
  return child !== '' && child !== '..' && !child.startsWith('..\\') && !child.startsWith('../') && !isAbsolute(child);
}

function samePath(left, right) {
  return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
}

export async function prepareCatalogFile(input, output) {
  if (typeof input !== 'string' || !input || typeof output !== 'string' || !output) throw new Error('Input and output paths are required.');
  const sourcePath = resolve(input);
  const outputPath = resolve(output);
  if (!isWithin(privateDirectory, outputPath)) throw new Error('Output must be inside the ignored private directory.');
  let text;
  try {
    const sourceStat = await fs.lstat(sourcePath);
    if (!sourceStat.isFile() || sourceStat.isSymbolicLink() || sourceStat.size > maximumBytes) throw new Error();
    if (!samePath(await fs.realpath(sourcePath), sourcePath)) throw new Error();
    text = await fs.readFile(sourcePath, 'utf8');
    if (Buffer.byteLength(text, 'utf8') > maximumBytes) throw new Error();
  } catch { throw new Error('Input must be a regular, non-linked catalog file no larger than 20 KB.'); }
  let source;
  try { source = JSON.parse(text); }
  catch { throw new Error('Invalid source catalog.'); }
  const result = migrateCannonballCatalog(source);
  const serialized = JSON.stringify(result, null, 2) + '\n';
  if (Buffer.byteLength(serialized, 'utf8') > maximumBytes || !configuredCatalog(serialized)) throw new Error('Invalid output catalog.');
  try {
    const directoryStat = await fs.lstat(privateDirectory);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) throw new Error();
    const actualDirectory = await fs.realpath(privateDirectory);
    const actualParent = await fs.realpath(dirname(outputPath));
    if (!samePath(actualParent, actualDirectory) && !isWithin(actualDirectory, actualParent)) throw new Error();
  } catch { throw new Error('Output must use an existing directory inside the ignored private directory.'); }
  let file;
  try { file = await fs.open(outputPath, 'wx', 0o600); }
  catch { throw new Error('Output could not be created exclusively; existing files are never overwritten.'); }
  try { await file.writeFile(serialized, 'utf8'); }
  catch { throw new Error('Output write failed; verify the prepared file before use.'); }
  finally {
    try { await file.close(); }
    catch { throw new Error('Output close failed; verify the prepared file before use.'); }
  }
}

async function main(args) {
  if (args.length !== 4 || args[0] !== '--input' || !args[1] || args[2] !== '--output' || !args[3]) {
    throw new Error('Usage: node scripts/update-cannonball-catalog.mjs --input PATH --output .private/NEW_FILE.json');
  }
  await prepareCatalogFile(args[1], args[3]);
  process.stdout.write('Prepared the local catalog update. No remote configuration was changed.\n');
}

if (process.argv[1] && samePath(resolve(process.argv[1]), fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
