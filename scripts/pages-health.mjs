import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const origin = 'https://boomerrawlings.com';
const markerPattern = /^\d{1,20}:\d{1,6}:[a-f0-9]{40}$/;

export async function observe(get = getPage) {
  const marker = (await get('/pages-release.txt'))?.trim();
  if (!markerPattern.test(marker ?? '')) return { marker: null, healthy: false };
  const [home, skillPage, skill] = await Promise.all([
    get('/'), get('/do-i-understand/'), get('/do-i-understand/SKILL.md'),
  ]);
  return {
    marker,
    healthy: Boolean(home?.includes('data-pip-guide')
      && skillPage?.includes('href="./SKILL.md" download')
      && /^---\r?\nname: do-i-understand\r?\n/.test(skill ?? '')),
  };
}

export function classify(observation, expected) {
  if (observation.marker !== expected) return 'unconfirmed';
  return observation.healthy ? 'healthy' : 'unhealthy';
}

async function getPage(path) {
  const url = new URL(path, origin);
  url.searchParams.set('pages_check', [process.env.GITHUB_RUN_ID ?? 'local', Date.now()].join('-'));
  try {
    const res = await fetch(url, {
      redirect: 'error', signal: AbortSignal.timeout(8000),
      headers: { 'Cache-Control': 'no-cache' },
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

async function main() {
  const [command, expected] = process.argv.slice(2);
  if (command === 'baseline') {
    const state = await observe();
    if (state.healthy) console.log('marker=' + state.marker);
    return;
  }
  if (command !== 'verify' || !markerPattern.test(expected ?? '')) throw new Error('Expected a valid Pages release marker');
  let result;
  let consecutiveUnhealthy = 0;
  for (let attempt = 0; attempt < 12; attempt++) {
    result = classify(await observe(), expected);
    if (result === 'healthy') {
      console.log('Verified public Pages release ' + expected);
      return;
    }
    consecutiveUnhealthy = result === 'unhealthy' ? consecutiveUnhealthy + 1 : 0;
    if (attempt < 11) await new Promise(resolve => setTimeout(resolve, 10000));
  }
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, 'rollback=' + (consecutiveUnhealthy >= 3) + '\n');
  }
  throw new Error('Public Pages release ' + expected + ' failed verification (' + result + '); rollback requires repeated observation of the new release marker.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
