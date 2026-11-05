import { copyFile, mkdir, lstat, rm } from 'node:fs/promises';
import { resolve, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, '.build/assets');
if (relative(root, output) !== `.build${sep}assets`) throw new Error('Unexpected build target');
// The resolved deletion target is confined to this app's generated output.
await rm(output, { recursive: true, force: true });
for (const name of ['gate.html', 'gate.css', 'gate.js', 'app.html', 'app.css', 'app.js']) {
  const source = resolve(root, 'client', name);
  const stat = await lstat(source);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw new Error('Unexpected client asset');
  const target = resolve(output, '_protected/client', name);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}
console.log('Packaged six generic client files. No directory data, passwords, or verifiers are packaged.');
