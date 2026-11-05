import { mkdir, writeFile } from 'node:fs/promises';
import { createAuthConfig } from '../auth.mjs';

const directory = new URL('../.private/', import.meta.url);
const mode = process.argv.includes('--exact') ? 'exact' : 'riddle';
if (process.argv.slice(2).some(argument => argument !== '--exact')) throw new Error('Usage: npm run configure [-- --exact]');
if (process.stdin.isTTY) {
  process.stdout.write(mode === 'riddle' ? 'Enter the riddle answer (one word, 3-40 letters; input hidden): ' : 'Enter the exact password (12-128 characters; input hidden): ');
  process.stdin.setRawMode(true);
}
let value = '';
let complete = false;
process.stdin.setEncoding('utf8');
process.stdin.on('data', async chunk => {
  if (complete) return;
  if (chunk.includes('\u0003')) process.exit(130);
  for (const character of chunk) {
    if (character === '\n' || character === '\r') { complete = true; break; }
    if (character === '\b' || character === '\u007f') value = value.slice(0, -1);
    else value += character;
  }
  if (!complete) return;
  process.stdin.pause();
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  try {
    const config = await createAuthConfig(value, { mode });
    value = '';
    await mkdir(directory, { recursive: true });
    await writeFile(new URL('auth.json', directory), JSON.stringify(config), { mode: 0o600 });
    process.stdout.write('\nVerifier saved to ignored .private/auth.json. The answer was not saved.\n');
    process.exit(0);
  } catch (error) { process.stderr.write(`\n${error.message}\n`); process.exit(1); }
});
