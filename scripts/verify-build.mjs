import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const output = 'dist';
if (!existsSync(output)) throw new Error('dist/ does not exist; run the build first');

const files = [];
function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(path);
  }
}
walk(output);

const htmlFiles = files.filter((file) => extname(file) === '.html');
if (htmlFiles.length === 0) throw new Error('build produced no HTML');
if (htmlFiles.length !== 14) throw new Error(`expected 14 HTML pages, found ${htmlFiles.length}`);

const failures = [];
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const label = relative(output, file);
  if (!/<title>[^<]+<\/title>/.test(html)) failures.push(label + ': missing title');
  if (!/<meta name="description" content="[^"]+">/.test(html)) failures.push(label + ': missing description');
  if (!/<link rel="canonical" href="https:\/\/boomerrawlings\.com\//.test(html)) failures.push(label + ': missing canonical');

  for (const [, href] of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    if (href.startsWith('/_astro/') || href === '/favicon.svg') continue;
    const target = href.endsWith('/') ? join(output, href, 'index.html') : join(output, href);
    if (!existsSync(target)) failures.push(label + ': broken local link ' + href);
  }
}

const writingHtml = readFileSync(join(output, 'writing', 'index.html'), 'utf8');
const publishedDateCount = (writingHtml.match(/<time datetime="[^"]+">Published /g) ?? []).length;
if (publishedDateCount !== 9) {
  failures.push('writing/index.html: expected 9 labeled publication dates, found ' + publishedDateCount);
}
if (!writingHtml.includes('aria-labelledby="writing-academic"')) {
  failures.push('writing/index.html: missing academic writing grouping');
}
if (!writingHtml.includes('aria-labelledby="writing-personal"')) {
  failures.push('writing/index.html: missing personal writing grouping');
}
if (writingHtml.includes('>Category<')) {
  failures.push('writing/index.html: obsolete category label remains');
}
if (!writingHtml.includes('Academic writing') || !writingHtml.includes('Personal writing')) {
  failures.push('writing/index.html: writing section headings are unclear');
}
if (!writingHtml.includes('Personal and academic writing published here and elsewhere')) {
  failures.push('writing/index.html: writing scope is not explicit');
}
if (!writingHtml.includes('href="/writing/attention-bias-modification-aggression/"')) {
  failures.push('writing/index.html: missing onsite academic writing link');
}
if (!writingHtml.includes('>This site<') || !writingHtml.includes('>Substack<')) {
  failures.push('writing/index.html: publication venues are not both labeled');
}
if (!writingHtml.includes('datetime="2026-05">Produced May 2026')) {
  failures.push('writing/index.html: partial production date is not preserved');
}
if (writingHtml.includes('All writing on Substack')) {
  failures.push('writing/index.html: incorrectly claims all writing is on Substack');
}

const academicHtml = readFileSync(
  join(output, 'writing', 'attention-bias-modification-aggression', 'index.html'),
  'utf8',
);
if (!academicHtml.includes('Student research proposal produced at Southwestern College')) {
  failures.push('academic writing page: missing provenance and study-status disclosure');
}
if (!academicHtml.includes('The study was not conducted')) {
  failures.push('academic writing page: missing unexecuted-study disclosure');
}
if (!academicHtml.includes('Editorial limitations note')) {
  failures.push('academic writing page: missing methodological limitations');
}
if (!academicHtml.includes('curator-guide--compact') || !academicHtml.includes('Read this as a proposal, not a completed study')) {
  failures.push('academic writing page: missing authored curator context');
}

const homeHtml = readFileSync(join(output, 'index.html'), 'utf8');
const allWorkHtml = readFileSync(join(output, 'all', 'index.html'), 'utf8');
const workHtml = readFileSync(join(output, 'work', 'index.html'), 'utf8');
const mediaLibraryHtml = readFileSync(
  join(output, 'work', 'organizing-icloud-media', 'index.html'),
  'utf8',
);
if (!homeHtml.includes('Organizing 31,550 Photos and Videos')) {
  failures.push('index.html: missing exact media-library project title');
}
if (!mediaLibraryHtml.includes('31,550 photos and videos out of iCloud')) {
  failures.push('media library page: missing verified project scope');
}
if (homeHtml.includes('Personal Archive') || mediaLibraryHtml.includes('Personal Archive')) {
  failures.push('media library project: obsolete project name remains');
}
if (!existsSync(join(output, 'images', 'portfolio-curator.webp'))) {
  failures.push('index.html: missing portfolio curator image asset');
}
if (!homeHtml.includes('class="portfolio-curator"')) {
  failures.push('index.html: missing portfolio curator interface');
}
if (!homeHtml.includes('Welcome—I’ll be your curator') || !homeHtml.includes('There are 6 projects and 9 pieces of writing here')) {
  failures.push('index.html: portfolio curator is not providing orientation');
}
const guidedSections = ['about', 'all', 'photography', 'research', 'work', 'writing'];
for (const section of guidedSections) {
  const html = readFileSync(join(output, section, 'index.html'), 'utf8');
  if (!html.includes('curator-guide--compact') || !html.includes('Your curator')) {
    failures.push(`${section}/index.html: missing contextual curator guidance`);
  }
}
if (homeHtml.includes('aria-current="page"')) {
  failures.push('index.html: homepage must not mark Projects as the current page');
}
if (allWorkHtml.includes('Undated') || allWorkHtml.includes('Work without a known date')) {
  failures.push('all/index.html: missing-date language is foregrounded');
}

const publicHtml = htmlFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
const obsoletePortfolioFraming = [
  'Public Archive',
  'private archive',
  'this public archive',
  'Substack archive',
  'Selected public records',
  '<h1>Archive</h1>',
];
for (const phrase of obsoletePortfolioFraming) {
  if (publicHtml.includes(phrase)) {
    failures.push(`public pages: obsolete portfolio framing remains: ${phrase}`);
  }
}

const featuredProjects = [
  'horizon',
  'paperfield',
  'workline',
  'research-publishing-systems',
  'organizing-icloud-media',
];
for (const slug of featuredProjects) {
  if (!homeHtml.includes(`href="/work/${slug}/"`)) {
    failures.push(`index.html: missing featured project ${slug}`);
  }
}
if (homeHtml.includes('href="/work/interactive-systems/"')) {
  failures.push('index.html: interactive experiments should remain off the homepage');
}
if (!workHtml.includes('href="/work/interactive-systems/"')) {
  failures.push('work/index.html: consolidated interactive project is missing');
}
if (homeHtml.includes('ledger-status') || homeHtml.includes('(public)')) {
  failures.push('index.html: redundant project-status language remains');
}

const workPagePaths = [
  'horizon',
  'paperfield',
  'workline',
  'research-publishing-systems',
  'organizing-icloud-media',
  'interactive-systems',
];
const workPages = workPagePaths.map((slug) =>
  readFileSync(join(output, 'work', slug, 'index.html'), 'utf8')
);
const discouragedProgressCopy = /Further documentation|intentionally provisional|incomplete|in progress|pending approval/i;
for (const [index, html] of workPages.entries()) {
  if (discouragedProgressCopy.test(html)) {
    failures.push(`work/${workPagePaths[index]}/: progress-report language remains`);
  }
}
if (workPages.some((html) => html.includes('HorizonOS'))) {
  failures.push('work pages: obsolete HorizonOS name remains');
}
if (workPages.some((html) => !html.includes('curator-guide--compact'))) {
  failures.push('work pages: one or more entries are missing authored curator context');
}

if (failures.length) throw new Error(failures.join('\n'));
console.log('Verified ' + htmlFiles.length + ' HTML pages: metadata and local links pass.');
