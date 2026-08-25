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
if (htmlFiles.length !== 15) throw new Error(`expected 15 HTML pages, found ${htmlFiles.length}`);

const failures = [];

const diagrams = [
  {
    source: join('src', 'diagrams', 'workline.mmd'),
    svg: join('public', 'media', 'projects', 'workline', 'handwriting-feedback-pipeline.svg'),
  },
  {
    source: join('src', 'diagrams', 'media-archive.mmd'),
    svg: join('public', 'media', 'projects', 'organizing-icloud-media', 'archive-catalog-pipeline.svg'),
  },
];
for (const diagram of diagrams) {
  if (!existsSync(diagram.source)) {
    failures.push(`${diagram.source}: missing Mermaid source`);
    continue;
  }
  if (!existsSync(diagram.svg)) {
    failures.push(`${diagram.svg}: missing rendered SVG`);
    continue;
  }
  const svg = readFileSync(diagram.svg, 'utf8');
  if (/<(?:script|foreignObject)\b/i.test(svg)) {
    failures.push(`${diagram.svg}: generated diagram contains executable or HTML content`);
  }
}

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

  for (const [, action] of html.matchAll(/action="(\/[^"#?]*)"/g)) {
    const target = action.endsWith('/') ? join(output, action, 'index.html') : join(output, action);
    if (!existsSync(target)) failures.push(label + ': broken local form action ' + action);
  }

  const pipSteps = html.match(/data-pip-steps="([^"]*)"/)?.[1];
  if (pipSteps && /[–—]/.test(pipSteps)) {
    failures.push(label + ': Pip dialogue contains an en or em dash');
  }

  for (const [, assetPath] of html.matchAll(/(?:src|poster)="(\/media\/[^"?#]+)"/g)) {
    if (!existsSync(join(output, assetPath))) {
      failures.push(`${label}: missing visual evidence asset ${assetPath}`);
    }
  }

  for (const video of html.match(/<video\b[^>]*>/g) ?? []) {
    if (!video.includes('controls') || !video.includes('playsinline')) {
      failures.push(label + ': evidence video must expose native controls and play inline');
    }
    if (/\s(?:autoplay|loop)(?=\s|=|>)/i.test(video)) {
      failures.push(label + ': evidence video must not autoplay or loop');
    }
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
if (!writingHtml.includes('Personal essays and academic work published here and elsewhere')) {
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
if (!academicHtml.includes('curator-guide--compact') || !academicHtml.includes('I like the restraint here')) {
  failures.push('academic writing page: missing Pip’s proposal context');
}
if (!academicHtml.includes('action="/about/"') || !academicHtml.includes('data-pip-destination="About"')) {
  failures.push('academic writing page: Pip’s trail does not continue beyond the Writing/ABM pair');
}

const homeHtml = readFileSync(join(output, 'index.html'), 'utf8');
const aboutHtml = readFileSync(join(output, 'about', 'index.html'), 'utf8');
const cvHtml = readFileSync(join(output, 'cv', 'index.html'), 'utf8');
const allWorkHtml = readFileSync(join(output, 'all', 'index.html'), 'utf8');
const workHtml = readFileSync(join(output, 'work', 'index.html'), 'utf8');
const mediaLibraryHtml = readFileSync(
  join(output, 'work', 'organizing-icloud-media', 'index.html'),
  'utf8',
);
const horizonHtml = readFileSync(join(output, 'work', 'horizon', 'index.html'), 'utf8');
const paperfieldHtml = readFileSync(join(output, 'work', 'paperfield', 'index.html'), 'utf8');
const pocketllmHtml = readFileSync(join(output, 'work', 'pocketllm', 'index.html'), 'utf8');
const worklinePath = join(output, 'work', 'workline', 'index.html');
if (existsSync(worklinePath)) {
  failures.push('Workline page: hidden project still has a generated detail route');
}
const smallProjectsHtml = readFileSync(
  join(output, 'work', 'interactive-systems', 'index.html'),
  'utf8',
);
if (!homeHtml.includes('Media Archiving and Cataloging Pipeline')) {
  failures.push('index.html: missing media-pipeline project title');
}
if (!mediaLibraryHtml.includes('31,550-item iCloud collection')) {
  failures.push('media library page: missing verified project scope');
}
if (!mediaLibraryHtml.includes('No single available tool handled') || !mediaLibraryHtml.includes('every frame of every video')) {
  failures.push('media library page: export difficulty or frame-level indexing is missing');
}
if (!mediaLibraryHtml.includes('supervised pipeline designed to reliably archive and catalog tens of thousands')
  || !mediaLibraryHtml.includes('/media/projects/organizing-icloud-media/archive-catalog-pipeline.svg')) {
  failures.push('media library page: high-level pipeline framing or process diagram is missing');
}
if (!horizonHtml.includes('/media/projects/horizon/startup-sequence.mp4')
  || !horizonHtml.includes('/media/projects/horizon/startup-poster.webp')
  || !horizonHtml.includes('/media/projects/horizon/interface-tour.mp4')
  || !horizonHtml.includes('/media/projects/horizon/interface-tour-poster.webp')) {
  failures.push('Horizon page: clean startup sequence or guided interface tour is missing');
}
if (!horizonHtml.includes('width="1920" height="1080"')) {
  failures.push('Horizon page: startup sequence is not published at 1920×1080');
}
const publishingSystemsHtml = readFileSync(
  join(output, 'work', 'research-publishing-systems', 'index.html'),
  'utf8',
);
if (!publishingSystemsHtml.includes('Continuity Desk')
  || !publishingSystemsHtml.includes('95-page packet')
  || !publishingSystemsHtml.includes('Getting Connected at Southwestern College')
  || !publishingSystemsHtml.includes('Use Canvas, Word, Files, and Teacher Messages')) {
  failures.push('Research and Publishing Systems page: Continuity Desk or the SWC technology packet is incomplete');
}
if (!paperfieldHtml.includes('/media/projects/paperfield/research-workflow.mp4')
  || !paperfieldHtml.includes('/media/projects/paperfield/research-workflow-poster.webp')) {
  failures.push('Paperfield page: DOI, library, search, connection, or PDF workflow is missing');
}
if (!pocketllmHtml.includes('/media/projects/pocketllm/interface-tour.mp4')
  || !pocketllmHtml.includes('/media/projects/pocketllm/interface-tour-poster.webp')
  || !pocketllmHtml.includes('TXT, MD, CSV, TSV, and JSONL')
  || !pocketllmHtml.includes('.pocketkey')
  || !pocketllmHtml.includes('not a compliance certification')) {
  failures.push('pocketLLM page: demo evidence, supported files, restoration key, or limits are missing');
}
if (!paperfieldHtml.includes('action="/work/pocketllm/"')
  || !pocketllmHtml.includes('action="/work/research-publishing-systems/"')) {
  failures.push('project trail: Paperfield must continue to pocketLLM, then Research and Publishing Systems');
}
if (!smallProjectsHtml.includes('/media/projects/small-projects/the-unrendered-world.webp')) {
  failures.push('Small Projects page: The Unrendered World visual is missing');
}
if (!horizonHtml.includes('first video shows its startup sequence')
  || !paperfieldHtml.includes('The video shows papers being grouped')
  || !pocketllmHtml.includes('the little face objects when the cursor clicks it')
  || !mediaLibraryHtml.includes('The diagram shows why this job needs a pipeline')
  || !smallProjectsHtml.includes('The image comes from The Unrendered World')) {
  failures.push('project pages: Pip is not interpreting the new visual evidence');
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
if (!homeHtml.includes('Pip says')
  || !homeHtml.includes("Hi! I'm Pip!")
  || !homeHtml.includes('About will be our first stop')
  || !homeHtml.includes('action="/about/"')) {
  failures.push('index.html: Pip is not providing named orientation');
}
if (homeHtml.includes('6 projects and 9 pieces of writing')) {
  failures.push('index.html: Pip is still reciting inventory counts');
}
const guidedSections = ['about', 'all', 'cv', 'photography', 'research', 'work', 'writing'];
for (const section of guidedSections) {
  const html = readFileSync(join(output, section, 'index.html'), 'utf8');
  if (!html.includes('curator-guide--compact') || !html.includes('Pip says') || !html.includes('data-pip-steps=')) {
    failures.push(`${section}/index.html: missing Pip’s multi-step guidance`);
  }
}
const researchHtml = readFileSync(join(output, 'research', 'index.html'), 'utf8');
const photographyHtml = readFileSync(join(output, 'photography', 'index.html'), 'utf8');
if (!researchHtml.includes('href="/work/research-publishing-systems/"')
  || !researchHtml.includes('href="/writing/attention-bias-modification-aggression/"')) {
  failures.push('research/index.html: curated research exhibits are missing');
}
if (photographyHtml.includes('organizing-icloud-media')
  || photographyHtml.includes('31,550')
  || !photographyHtml.includes('image-led side of the portfolio')
  || !photographyHtml.includes('data-pip-destination="All Work"')) {
  failures.push('photography/index.html: project/photography boundary is unclear');
}
if (homeHtml.includes('ledger-index') || homeHtml.includes('<span>No.</span>')) {
  failures.push('index.html: arbitrary project numbering remains');
}
if (homeHtml.includes('href="/photography/"')) {
  failures.push('index.html: empty photography section is still advertised');
}
if (homeHtml.includes('aria-current="page"')) {
  failures.push('index.html: homepage must not mark Projects as the current page');
}
if (allWorkHtml.includes('Undated') || allWorkHtml.includes('Work without a known date')) {
  failures.push('all/index.html: missing-date language is foregrounded');
}
const allWorkRow = (href) => {
  const start = allWorkHtml.indexOf(`href="${href}"`);
  const end = start === -1 ? -1 : allWorkHtml.indexOf('</a>', start);
  return start === -1 || end === -1 ? '' : allWorkHtml.slice(start, end);
};
const datedProjects = [
  ['/work/horizon/', '2026-03', 'March 2026'],
  ['/work/paperfield/', '2026-05', 'May 2026'],
  ['/work/organizing-icloud-media/', '2026-08', 'August 2026'],
];
for (const [href, datetime, label] of datedProjects) {
  if (!allWorkRow(href).includes(`datetime="${datetime}">${label}</time>`)) {
    failures.push(`all/index.html: ${href} is missing its verified month and year`);
  }
}
const personalWritingCount = (allWorkHtml.match(/>Personal writing</g) ?? []).length;
const academicWritingCount = (allWorkHtml.match(/>Academic writing</g) ?? []).length;
if (personalWritingCount !== 8 || academicWritingCount !== 1) {
  failures.push(`all/index.html: expected 8 personal and 1 academic writing labels, found ${personalWritingCount} and ${academicWritingCount}`);
}
if (!workHtml.includes('Small Projects')
  || !allWorkHtml.includes('Small Projects')
  || !mediaLibraryHtml.includes('Small Projects')) {
  failures.push('project pages: Interactive Systems was not consistently renamed Small Projects');
}

const publicHtml = htmlFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
if (publicHtml.includes('/work/workline/') || publicHtml.includes('>Workline<')) {
  failures.push('public pages: hidden Workline project is still linked or named');
}
if (publicHtml.includes('<span class="sr-only">Pip says: </span>')) {
  failures.push('public pages: Pip’s accessible label is duplicated inside each live message');
}
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
if (publicHtml.includes('Interactive Systems')) {
  failures.push('public pages: obsolete Interactive Systems title remains');
}

const featuredProjects = [
  'horizon',
  'paperfield',
  'pocketllm',
  'research-publishing-systems',
  'organizing-icloud-media',
];
for (const slug of featuredProjects) {
  if (!homeHtml.includes(`href="/work/${slug}/"`)) {
    failures.push(`index.html: missing featured project ${slug}`);
  }
}
const featuredProjectOffsets = featuredProjects.map((slug) =>
  homeHtml.indexOf(`href="/work/${slug}/"`)
);
if (featuredProjectOffsets.some((offset, index) => index > 0 && offset <= featuredProjectOffsets[index - 1])) {
  failures.push('index.html: featured projects are not in the intended guided order');
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
if (!aboutHtml.includes('2026 Student of Distinction Award')
  || !aboutHtml.includes('President’s List four times')) {
  failures.push('about/index.html: missing 2026 Student of Distinction recognition');
}
if (!aboutHtml.includes('href="/cv/"') || !aboutHtml.includes('View academics')) {
  failures.push('about/index.html: Academics page is not linked');
}
if (!aboutHtml.includes('src="/images/boomer-rawlings-headshot.webp"')
  || !aboutHtml.includes('alt="Boomer Rawlings smiling outdoors."')) {
  failures.push('about/index.html: approved headshot is missing or lacks useful alternative text');
}
if (!existsSync(join(output, 'images', 'boomer-rawlings-headshot.webp'))
  || statSync(join(output, 'images', 'boomer-rawlings-headshot.webp')).size > 150_000) {
  failures.push('about/index.html: optimized headshot asset is missing or too large');
}
if (photographyHtml.includes('boomer-rawlings-headshot')) {
  failures.push('photography/index.html: biographical headshot was incorrectly treated as photography work');
}
if (!aboutHtml.includes('completed Southwestern College’s Psychology for Transfer (AA-T) degree with honors in Spring 2026')) {
  failures.push('about/index.html: completed degree and honors status are unclear');
}
if (!cvHtml.includes('Four-time honoree for 4.0 semester academic performance')) {
  failures.push('cv/index.html: missing four-time President’s List recognition');
}
if (!cvHtml.includes('Psychology for Transfer (AA-T)')
  || !cvHtml.includes('Degree completed with honors in one year')
  || !cvHtml.includes('Spring 2026')
  || !cvHtml.includes('Introduction to Psychological Research')
  || !cvHtml.includes('Data Analysis in Psychology and Sociology')
  || !cvHtml.includes('Introduction to Programming Logic and Design Using Python')) {
  failures.push('cv/index.html: selected academic experience is incomplete');
}
if (!cvHtml.includes('Selected completed coursework · SPRING 2025 - SPRING 2026')
  || !cvHtml.includes('institution-southwestern-college')) {
  failures.push('cv/index.html: coursework is not clearly grouped under Southwestern College');
}
if (cvHtml.includes('2025–present') || cvHtml.includes('Academic CV')) {
  failures.push('cv/index.html: obsolete enrollment status or CV label remains');
}
if (!cvHtml.includes('The study was not conducted')
  || !cvHtml.includes('Research and Publishing Systems')) {
  failures.push('cv/index.html: selected academic work is incomplete or overstates the research proposal');
}
if (cvHtml.includes('TOTAL 16.00')) {
  failures.push('cv/index.html: transcript detail was published instead of a selected academic profile');
}

const workPagePaths = [
  'horizon',
  'paperfield',
  'pocketllm',
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
if (workPages.some((html) => !html.includes('curator-guide--compact') || !html.includes('Pip says'))) {
  failures.push('work pages: one or more entries are missing Pip’s authored context');
}

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const label = relative(output, file);
  if (!html.includes('data-pip-guide')) failures.push(`${label}: missing Pip guide`);
  if (!html.includes('data-pip-progress') || !html.includes('data-pip-sound')) {
    failures.push(`${label}: missing Pip progress or sound control`);
  }
  if (!html.includes('data-pip-destination=')) failures.push(`${label}: missing Pip destination`);
  if (!html.includes('<script type="module" src="/scripts/pip.js"></script>')) {
    failures.push(`${label}: Pip interaction script is not same-origin and external`);
  }
}

const pipScriptPath = join(output, 'scripts', 'pip.js');
if (!existsSync(pipScriptPath)) {
  failures.push('Pip interaction script is missing from the build');
} else {
  const pipScript = readFileSync(pipScriptPath, 'utf8');
  for (const behavior of ['AudioContext', 'sessionStorage', 'localStorage', 'pageshow', 'is-speaking', 'is-departing', 'is-arriving', 'prefers-reduced-motion', 'window.location.assign']) {
    if (!pipScript.includes(behavior)) failures.push(`Pip interaction script: missing ${behavior}`);
  }
  if (!pipScript.includes('step = 0') || pipScript.includes('writeStorage(window.sessionStorage, stepKey')) {
    failures.push('Pip interaction script: completed dialogue state can remain stuck across visits');
  }
  if (!pipScript.includes('pointerenter') || !pipScript.includes('is-smiling') || !pipScript.includes('is-smile-leaving')) {
    failures.push('Pip interaction script: hover expression does not animate in and out');
  }
}

const builtCss = files
  .filter((file) => extname(file) === '.css')
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');
if (!builtCss.includes('view-transition-name:pip-curator')) {
  failures.push('Pip does not persist visually between guided pages');
}
if (!builtCss.includes('pip-transfer-squish') || !builtCss.includes('view-transition-image-pair(pip-curator)')) {
  failures.push('Pip is missing the cross-page squish/glitch transition');
}
if (!builtCss.includes('page-transfer-scan-out')
  || !builtCss.includes('page-transfer-scan-in')
  || !builtCss.includes('clip-path:inset(100% 0 0)')) {
  failures.push('Pages are missing the fast directional scan transition');
}
if (!builtCss.includes('pip-fallback-depart') || !builtCss.includes('pip-feature-arrive')) {
  failures.push('Pip is missing the fallback departure or feature-level arrival motion');
}
if (!builtCss.includes('pip-hover-smile-in')
  || !builtCss.includes('pip-hover-smile-out')
  || !builtCss.includes('pip-hover-feature-glitch')
  || !builtCss.includes('background-position:97% 0')) {
  failures.push('Pip is missing the fine-pointer hover smile');
}
if (!builtCss.includes('@media (prefers-reduced-motion:reduce)') && !builtCss.includes('@media(prefers-reduced-motion:reduce)')) {
  failures.push('Pip motion does not respect reduced-motion preferences');
}

const netlifyConfig = readFileSync('netlify.toml', 'utf8');
if (!netlifyConfig.includes("script-src 'self'")) {
  failures.push('Netlify CSP does not allow the same-origin Pip script');
}

if (failures.length) throw new Error(failures.join('\n'));
console.log('Verified ' + htmlFiles.length + ' HTML pages: metadata and local links pass.');
