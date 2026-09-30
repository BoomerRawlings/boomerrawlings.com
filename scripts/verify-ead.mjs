import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

// Static release checks only: browser behavior and live HTTP headers need separate checks.
const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'dist');
const page = join(output, 'ead', 'index.html');
if (!existsSync(page)) throw new Error('dist/ead/index.html is missing; build the site first');
const site = 'https://boomerrawlings.com';
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const text = (file) => readFileSync(file, 'utf8');
const attrs = (node) => Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]));
const body = (node) => (node.childNodes ?? []).map((child) => child.value ?? '').join('');
function* nodes(node) {
  yield node;
  for (const child of node.childNodes ?? []) yield* nodes(child);
  if (node.content) yield* nodes(node.content);
}
function* files(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else yield path;
  }
}
const urlFor = (file) => new URL(relative(output, file).split(sep).join('/'), `${site}/`);
const isEad = (url) => url.origin === site && /^\/ead(?:\/|$)/.test(url.pathname);
const parseUrl = (value, base) => { try { return new URL(value, base); } catch { return null; } };

const htmlNodes = [...nodes(parse(text(page), { sourceCodeLocationInfo: true }))];
const workspaceFile = join(output, 'ead', 'workspace.html');
if (!existsSync(workspaceFile)) throw new Error('dist/ead/workspace.html is missing; build the site first');
const workspaceNodes = [...nodes(parse(text(workspaceFile), { sourceCodeLocationInfo: true }))];
const shellNodes = new Set(htmlNodes);
const allNodes = [...htmlNodes, ...workspaceNodes];
const ids = allNodes.map(node => attrs(node).id).filter(Boolean);
check(new Set(ids).size === ids.length, 'EAD shell/workspace: duplicate IDs after insertion');
const workspace = htmlNodes.find(node => attrs(node).id === 'research-workspace');
check(workspace && Object.hasOwn(attrs(workspace), 'hidden') && Object.hasOwn(attrs(workspace), 'inert'), 'EAD shell: workspace must start hidden and inert');
check(workspace && [...nodes(workspace)].every(node => node === workspace || (!node.tagName && (node.nodeName !== '#text' || !node.value.trim()))), 'EAD shell: research markup must be deferred');
const initialScripts = htmlNodes.filter(node => node.tagName === 'script').map(node => attrs(node).src);
const initialStyles = htmlNodes.filter(node => node.tagName === 'link' && (attrs(node).rel ?? '').split(/\s+/).includes('stylesheet')).map(node => attrs(node).href);
check(JSON.stringify(initialScripts) === JSON.stringify(['./loader.js','./entry.js']), 'EAD shell: only loader.js and entry.js may execute initially, in that order');
check(JSON.stringify(initialStyles) === JSON.stringify(['./entry.css']), 'EAD shell: only entry.css may load initially');
for (const node of htmlNodes) {
  const a = attrs(node);
  const rel = (a.rel ?? '').split(/\s+/);
  if (rel.some(value => ['preload','prefetch','modulepreload'].includes(value))) check(a.as === 'font', 'EAD shell: do not preload deferred research');
  if (a.src) check(node.tagName === 'script' || (node.tagName === 'img' && /\/images\/lion-approved\.png$/.test(a.src)), 'EAD shell: unexpected initial research resource');
}
check(workspaceNodes.some(node => attrs(node).id === 'main'), 'EAD workspace: missing research content');
check(!workspaceNodes.some(node => ['script','style','link'].includes(node.tagName)), 'EAD workspace: scripts and styles belong in the deferred loader manifest');
for (const [name, expected] of [['robots','noindex'],['referrer','no-referrer']]) {
  const meta = workspaceNodes.find(node => node.tagName === 'meta' && attrs(node).name === name);
  check((attrs(meta ?? {}).content ?? '').split(/\s*,\s*/).includes(expected), `EAD workspace: missing ${name} metadata`);
}
const metadata = (name, value) => htmlNodes.filter((n) => n.tagName === 'meta' && attrs(n)[name]?.toLowerCase() === value);
const robots = metadata('name', 'robots');
check(robots.length === 1, 'EAD: require exactly one robots meta tag');
const robotRules = new Set((attrs(robots[0] ?? {}).content ?? '').toLowerCase().split(/\s*,\s*/));
check(robotRules.has('noindex') && robotRules.has('nofollow') && !robotRules.has('index'), 'EAD: robots must specify noindex,nofollow');
const referrer = metadata('name', 'referrer');
check(referrer.length === 1 && attrs(referrer[0]).content === 'no-referrer', 'EAD: require referrer=no-referrer');
const csp = metadata('http-equiv', 'content-security-policy');
check(csp.length === 1, 'EAD: require exactly one CSP meta tag');
const policy = new Map();
for (const directive of (attrs(csp[0] ?? {}).content ?? '').split(';').filter((part) => part.trim())) {
  const [name, ...values] = directive.trim().split(/\s+/);
  check(!policy.has(name), `EAD: duplicate CSP directive ${name}`);
  policy.set(name, values);
}
for (const [name, expected] of Object.entries({ 'script-src': "'self'", 'connect-src': "'self'", 'object-src': "'none'", 'base-uri': "'none'", 'form-action': "'none'" })) {
  check(policy.get(name)?.join(' ') === expected, `EAD: CSP ${name} must be ${expected}`);
}
check(["'self'", "'none'"].includes(policy.get('default-src')?.join(' ')), 'EAD: CSP default-src must be self or none');
for (const [name, values] of policy) {
  if (name.endsWith('-src') || name.startsWith('script-src-') || name.startsWith('style-src-')) {
    const allowed = new Set(["'self'", "'none'"]);
    if (name === 'style-src' || name === 'style-src-attr') allowed.add("'unsafe-inline'");
    if (name === 'img-src' || name === 'font-src') allowed.add('data:');
    check(values.length > 0 && values.every((value) => allowed.has(value)), `EAD: unexpected CSP source in ${name}`);
  }
}

const stylesheets = new Set();
function localResource(value, base, label, allowData = false) {
  if (allowData && value.startsWith('data:')) return;
  if (value.startsWith('#')) return;
  const url = parseUrl(value, base);
  if (!url || url.origin !== site) { failures.push(`${label}: resource must be self-hosted (${value})`); return; }
  let path;
  try { path = resolve(output, `.${decodeURIComponent(url.pathname)}`); }
  catch { failures.push(`${label}: malformed resource URL`); return; }
  const rel = relative(output, path);
  if (rel.startsWith('..') || !existsSync(path) || !statSync(path).isFile()) { failures.push(`${label}: built resource missing or outside dist (${value})`); return; }
  if (url.pathname.endsWith('.css')) stylesheets.add(path);
}
function cssResources(css, base, label) {
  for (const match of css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)|@import\s+(['"])(.*?)\3/gi)) {
    localResource(match[2] ?? match[4], base, label, true);
  }
}
for (const node of allNodes) {
  if (!node.tagName) continue;
  const a = attrs(node);
  const label = `EAD <${node.tagName}>`;
  check(!['base', 'iframe', 'object', 'embed'].includes(node.tagName), `${label}: unsupported embedded content or base URL`);
  for (const [name, value] of Object.entries(a)) {
    check(!name.startsWith('on'), `${label}: inline event handler ${name}`);
    if (['href', 'src', 'action', 'formaction', 'xlink:href'].includes(name)) {
      check(!/^\s*javascript:/i.test(value), `${label}: executable URL`);
    }
  }
  if (node.tagName === 'script') {
    const type = (a.type ?? '').toLowerCase();
    if (['application/json', 'application/ld+json'].includes(type)) {
      check(!a.src, `${label}: JSON blocks must be inline data`);
      try { JSON.parse(body(node)); } catch { failures.push(`${label}: invalid JSON data block`); }
    } else {
      check(['', 'module', 'text/javascript', 'application/javascript'].includes(type), `${label}: unrecognized script type`);
      check(Boolean(a.src) && !body(node).trim(), `${label}: executable code must use an external local file`);
    }
  }
  if (a.src) localResource(a.src, urlFor(page), label, ['img', 'source'].includes(node.tagName));
  if (a.poster) localResource(a.poster, urlFor(page), label);
  if (['image', 'use'].includes(node.tagName) && a.href) localResource(a.href, urlFor(page), label, node.tagName === 'image');
  if (a.srcset) {
    for (const candidate of a.srcset.split(',')) localResource(candidate.trim().split(/\s+/)[0], urlFor(page), label);
  }
  if (node.tagName === 'link') {
    const rel = (a.rel ?? '').toLowerCase().split(/\s+/);
    if (rel.some((value) => ['stylesheet', 'icon', 'preload', 'modulepreload', 'prefetch', 'preconnect', 'dns-prefetch'].includes(value))) {
      check(!rel.some((value) => ['preconnect', 'dns-prefetch'].includes(value)), `${label}: unnecessary connection hint`);
      if (a.href) localResource(a.href, urlFor(page), label);
    }
  }
  if (a.style) cssResources(a.style, urlFor(page), label);
  if (node.tagName === 'style') cssResources(body(node), urlFor(page), label);
  if (shellNodes.has(node) && (a.src || node.tagName === 'style' || (node.tagName === 'link' && a.href))) {
    const beforeResources = csp[0]?.sourceCodeLocation?.startOffset < node.sourceCodeLocation?.startOffset;
    check(beforeResources, 'EAD: CSP must precede resource-loading elements');
    check(referrer[0]?.sourceCodeLocation?.startOffset < node.sourceCodeLocation?.startOffset, 'EAD: referrer policy must precede resource-loading elements');
  }
}
const loader = text(join(output, 'ead', 'loader.js'));
const entryCss = text(join(output, 'ead', 'entry.css'));
check(!/@import\b/i.test(entryCss), 'EAD entry CSS: imports would bypass deferred loading');
for (const match of entryCss.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
  const url = parseUrl(match[2], urlFor(page));
  check(url?.origin === site && /^\/ead\/(?:fonts\/[^/]+|images\/lion-approved\.png)$/.test(url.pathname), 'EAD entry CSS: unexpected pre-entry resource');
}
for (const [name, extension, expected] of [
  ['styles','css',['style','oracle','implementation','atlas','plans','reveal']],
  ['scripts','js',['relevance','network-layout','app','atlas','implementation','plans','reveal']],
]) {
  const declaration = loader.match(new RegExp(`\\bconst\\s+${name}\\s*=\\s*\\[([^\\]]+)\\]`));
  const assets = declaration ? [...declaration[1].matchAll(/['"]([a-z-]+)['"]/g)].map(match => match[1]) : [];
  check(JSON.stringify(assets) === JSON.stringify(expected), `EAD loader: incomplete ${name} manifest`);
  for (const asset of assets) localResource(`./${asset}.${extension}`,urlFor(page),`EAD deferred ${name}`);
}
check(loader.includes("'./workspace.html'"), 'EAD loader: missing workspace fragment reference');
for (const file of stylesheets) cssResources(text(file), urlFor(file), relative(output, file));

// Parse URL-bearing attributes, not prose: titles containing "EAD" are harmless.
for (const file of files(output)) {
  if (file.endsWith('.html') && !relative(output, file).split(sep).join('/').startsWith('ead/')) {
    for (const node of nodes(parse(text(file)))) {
      const a = attrs(node);
      for (const name of ['href', 'src', 'action', 'formaction']) {
        const url = a[name] && parseUrl(a[name], urlFor(file));
        if (url && isEad(url)) failures.push(`${relative(output, file)}: incoming EAD ${name}`);
      }
      if (node.tagName === 'meta' && a['http-equiv']?.toLowerCase() === 'refresh') {
        const target = a.content?.match(/url\s*=\s*['"]?([^'"]+)/i)?.[1];
        const url = target && parseUrl(target.trim(), urlFor(file));
        if (url && isEad(url)) failures.push(`${relative(output, file)}: incoming EAD redirect`);
      }
    }
  }
  if (/^sitemap.*\.xml$/.test(file.split(sep).at(-1))) {
    for (const [, value] of text(file).matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)) {
      const url = parseUrl(value, `${site}/`);
      if (url && isEad(url)) failures.push(`${relative(output, file)}: EAD appears in sitemap`);
    }
  }
}

const data = (name) => JSON.parse(text(join(output, 'ead', 'data', `${name}.json`)));
const sources = data('sources');
const network = data('network');
const briefing = data('briefing');
const byId = (items, label) => {
  const map = new Map(items.map((item) => [item.id, item]));
  check(map.size === items.length && items.every((item) => typeof item.id === 'string' && item.id), `${label}: missing or duplicate IDs`);
  return map;
};
const papers = byId(sources.entries, 'sources');
const graph = byId(network.nodes, 'network nodes');
byId(network.edges, 'network edges');
const rows = sources.entries.flatMap((entry) => entry.sourceRows);
const reviewed = sources.entries.filter((entry) => entry.reviewed);
check(papers.size === 492 && reviewed.length === 23 && reviewed.filter((entry) => entry.status === 'withdrawn').length === 1, 'sources: expected 492 entries, 23 reviewed, one withdrawn review');
check(rows.length === 507, 'sources: expected 507 retained source rows');
for (const [kind, count] of Object.entries({ scholar_profile: 483, author_bibliography: 10, network_review: 14 })) {
  check(rows.filter((row) => row.kind === kind).length === count, `sources: expected ${count} ${kind} rows`);
}
check(sources.stats.catalogEntries === papers.size && sources.stats.reviewedEntries === reviewed.length && sources.stats.sourceRows === rows.length, 'sources: summary counts disagree with data');
check(graph.size === 43 && network.edges.length === 91, 'network: expected 43 nodes and 91 edges');
for (const [type, count] of Object.entries({ person: 17, paper: 23, objective: 3 })) {
  check(network.nodes.filter((node) => node.type === type).length === count, `network: expected ${count} ${type} nodes`);
}
check(network.stats.nodes === graph.size && network.stats.edges === network.edges.length
  && network.stats.people === 17 && network.stats.papers === 23 && network.stats.objectives === 3, 'network: summary counts disagree with data');
for (const node of network.nodes.filter((node) => node.type === 'paper')) {
  const paper = papers.get(node.sourceId);
  check(paper?.reviewed && paper.title === node.title && paper.status === node.status, `network ${node.id}: source mapping differs`);
}
for (const edge of network.edges) {
  const source = graph.get(edge.source);
  const target = graph.get(edge.target);
  check(source && target, `network ${edge.id}: missing endpoint`);
  check(edge.inferred === (edge.type === 'topic'), `network ${edge.id}: incorrect inference label`);
  check(edge.evidenceUrls?.length > 0 && edge.evidenceUrls.every((url) => /^https?:\/\//.test(url)), `network ${edge.id}: missing source URLs`);
  if (edge.type === 'authorship') check(papers.get(target?.sourceId)?.authors.includes(source?.label), `network ${edge.id}: author name mismatch`);
}
for (const section of ['observations', 'open_questions', 'design_principles']) {
  byId(briefing[section], `briefing ${section}`);
  for (const item of briefing[section]) {
    check(item.source_ids?.length > 0 && item.source_ids.every((id) => papers.get(id)?.reviewed), `briefing ${item.id}: unresolved or unreviewed source`);
  }
}

if (failures.length) throw new Error([...new Set(failures)].join('\n'));
console.log('Verified EAD static release: privacy metadata, local resources, unlisted links, and 492-entry research data. Browser/live-header checks remain separate.');
