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

const redirectTargets = new Map([
  [join('archive', 'index.html'), '/all/'],
  [join('work', 'horizonos', 'index.html'), '/work/horizon/'],
  [join('work', 'icloud-media-archive', 'index.html'), '/work/organizing-icloud-media/'],
  [join('work', 'personal-archive', 'index.html'), '/work/organizing-icloud-media/'],
]);
const contentHtmlFiles = htmlFiles.filter(
  (file) => !redirectTargets.has(relative(output, file)),
);
if (contentHtmlFiles.length !== 17 || htmlFiles.length !== 21) {
  throw new Error(
    `expected 17 content pages and 4 redirects, found ${contentHtmlFiles.length} and ${htmlFiles.length - contentHtmlFiles.length}`,
  );
}

const failures = [];

for (const [path, target] of redirectTargets) {
  const file = join(output, path);
  if (!existsSync(file)) {
    failures.push(`${path}: missing legacy redirect`);
    continue;
  }
  const html = readFileSync(file, 'utf8');
  if (!html.includes(`http-equiv="refresh" content="0;url=${target}"`)
    || !html.includes(`href="${target}"`)
    || !html.includes(`href="https://boomerrawlings.com${target}"`)) {
    failures.push(`${path}: does not redirect and canonicalize to ${target}`);
  }
}

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

const mediaDiagramSource = readFileSync(join('src', 'diagrams', 'media-archive.mmd'), 'utf8');
if (!mediaDiagramSource.includes('source["01 / SOURCE"]')
  || !mediaDiagramSource.includes('identity["02 / IDENTIFY"]')
  || !mediaDiagramSource.includes('prepare["03 / PREPARE"]')
  || !mediaDiagramSource.includes('source --> identity --> prepare --> gate')
  || !mediaDiagramSource.includes('gate --> analyze --> commit --> catalog --> viewer')
  || !mediaDiagramSource.includes('gate{"04"}')
  || !mediaDiagramSource.includes('Uncertain state stops before a model call')
  || !mediaDiagramSource.includes('font-family:Arial Narrow')
  || !mediaDiagramSource.includes('viewer["08 / VIEW"]')) {
  failures.push('media archive diagram: source scale, fail-closed gate, evidence path, or protected viewer is missing');
}
if (/every (?:extracted )?video frame|videos\s*-->\s*frames/i.test(mediaDiagramSource)) {
  failures.push('media archive diagram: unsupported video-frame analysis claim remains');
}

for (const file of contentHtmlFiles) {
  const html = readFileSync(file, 'utf8');
  const label = relative(output, file);
  if (!/<title>[^<]+<\/title>/.test(html)) failures.push(label + ': missing title');
  if (!/<meta name="description" content="[^"]+">/.test(html)) failures.push(label + ': missing description');
  if (!/<link rel="canonical" href="https:\/\/boomerrawlings\.com\//.test(html)) failures.push(label + ': missing canonical');
  if (!html.includes('http-equiv="Content-Security-Policy"')
    || !html.includes('name="referrer" content="strict-origin-when-cross-origin"')) {
    failures.push(label + ': missing portable security metadata');
  }

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
  if (pipSteps && /\bI like\b/i.test(pipSteps)) {
    failures.push(label + ': Pip dialogue contains self-referential “I like” commentary');
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
if (publishedDateCount !== 3) {
  failures.push('writing/index.html: expected 3 labeled academic publication dates, found ' + publishedDateCount);
}
if (!writingHtml.includes('aria-labelledby="writing-academic"')) {
  failures.push('writing/index.html: missing academic writing grouping');
}
if (writingHtml.includes('aria-labelledby="writing-personal"')) {
  failures.push('writing/index.html: personal writing is still published onsite');
}
if (writingHtml.includes('>Category<')) {
  failures.push('writing/index.html: obsolete category label remains');
}
if (!writingHtml.includes('Academic writing')) {
  failures.push('writing/index.html: academic writing heading is missing');
}
if (!writingHtml.includes('Selected academic work, with publication and original production dates kept distinct')) {
  failures.push('writing/index.html: academic writing scope is not explicit');
}
for (const route of [
  '/writing/social-justice-through-financial-literacy/',
  '/writing/rhetorical-analysis-death-penalty/',
  '/writing/attention-bias-modification-aggression/',
]) {
  if (!writingHtml.includes(`href="${route}"`)) {
    failures.push(`writing/index.html: missing onsite academic writing link ${route}`);
  }
}
if (!writingHtml.includes('>BoomerRawlings.com<')
  || (writingHtml.match(/href="https:\/\/boomerrawlings\.substack\.com\/"/g) ?? []).length !== 1
  || (writingHtml.match(/Substack/g) ?? []).length !== 1) {
  failures.push('writing/index.html: onsite venue or single quiet Substack reference is missing');
}
if (!writingHtml.includes('datetime="2026-05">Produced May 2026')) {
  failures.push('writing/index.html: partial production date is not preserved');
}
if (writingHtml.includes('All writing on Substack')) {
  failures.push('writing/index.html: incorrectly claims all writing is on Substack');
}

const financialLiteracyHtml = readFileSync(
  join(output, 'writing', 'social-justice-through-financial-literacy', 'index.html'),
  'utf8',
);
const deathPenaltyHtml = readFileSync(
  join(output, 'writing', 'rhetorical-analysis-death-penalty', 'index.html'),
  'utf8',
);
const academicHtml = readFileSync(
  join(output, 'writing', 'attention-bias-modification-aggression', 'index.html'),
  'utf8',
);

const academicDocuments = [
  {
    html: financialLiteracyHtml,
    label: 'financial literacy page',
    src: '/documents/social-justice-through-financial-literacy.pdf',
    pages: 11,
    provenance: 'Research essay produced for ENGL 115 at Southwestern College on May 26, 2025.',
  },
  {
    html: deathPenaltyHtml,
    label: 'death penalty page',
    src: '/documents/rhetorical-analysis-death-penalty.pdf',
    pages: 6,
    provenance: 'Rhetorical analysis produced for ENGL C1001 at Southwestern College on December 8, 2025.',
  },
  {
    html: academicHtml,
    label: 'attention-bias proposal page',
    src: '/documents/attention-bias-modification-aggression.pdf',
    pages: 10,
    provenance: 'Original student research proposal produced at Southwestern College in May 2026.',
  },
];

for (const { html, label, src, pages, provenance } of academicDocuments) {
  const publicPdf = join(output, src);
  if (!existsSync(publicPdf)) {
    failures.push(`${label}: missing public PDF asset ${src}`);
  } else if (readFileSync(publicPdf).subarray(0, 5).toString() !== '%PDF-') {
    failures.push(`${label}: ${src} is not a valid PDF asset`);
  }
  if (!html.includes(provenance) || !html.includes(`Original paper · ${pages} pages`)) {
    failures.push(`${label}: paper provenance or page count is missing`);
  }
  if (!html.includes(`<iframe src="${src}#view=FitH"`)
    || !html.includes(`href="${src}" target="_blank" rel="noopener"`)
    || !html.includes(`href="${src}" download`)
    || !html.includes('>PDF</h2>')
    || !html.includes('>Open PDF ')
    || !html.includes('>Download PDF ')) {
    failures.push(`${label}: embedded reader, open control, or download control is missing`);
  }
  if (html.includes('Read the paper')
    || html.includes('The complete PDF is embedded here and available as a direct download.')) {
    failures.push(`${label}: redundant PDF introduction remains`);
  }
}

for (const officialSource of [
  'https://www.irs.gov/newsroom/working-families-tax-cuts-tax-deductions-for-working-americans-and-seniors',
  'https://www.irs.gov/newsroom/treasury-irs-issue-guidance-on-trump-accounts-established-under-the-working-families-tax-cuts-notice-announces-upcoming-regulations',
  'https://home.treasury.gov/news/press-releases/sb0554',
]) {
  if (!financialLiteracyHtml.includes(`href="${officialSource}"`)) {
    failures.push(`financial literacy page: missing official timeline source ${officialSource}`);
  }
}
if (!financialLiteracyHtml.includes('The classroom paper did not predict the statute')
  || !financialLiteracyHtml.includes('not a forecast or source for the law')
  || /policy prophet|predicted Trump Accounts/i.test(financialLiteracyHtml)) {
  failures.push('financial literacy page: timeline comparison overstates prediction or influence');
}
if (!academicHtml.includes('The study was designed but not conducted')
  || !academicHtml.includes('The evidence base is narrow, and the paper says so')) {
  failures.push('attention-bias proposal page: provenance and study-status disclosure are missing');
}
for (const obsoleteSection of [
  'Editorial limitations note',
  'Research question and rationale',
  'Proposed method',
  'Planned analysis and limitations',
]) {
  if (academicHtml.includes(obsoleteSection)) {
    failures.push(`attention-bias proposal page: obsolete full web edition remains: ${obsoleteSection}`);
  }
}
if (!academicHtml.includes('data-pip-terminal="true"')
  || !academicHtml.includes("This is the final stop in Pip's guided tour.")) {
  failures.push('attention-bias proposal page: Pip’s terminal proposal context is missing');
}
if (academicHtml.includes('action="/about/"')
  || academicHtml.includes('data-pip-destination="About"')) {
  failures.push('attention-bias proposal page: Pip’s terminal stop still loops to About');
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
if (!homeHtml.includes('iCloud Media Migration and Catalog')) {
  failures.push('index.html: missing media-pipeline project title');
}
if (!mediaLibraryHtml.includes('612.9 GiB')
  || !mediaLibraryHtml.includes('31,550 files')
  || !mediaLibraryHtml.includes('27,906 images')
  || !mediaLibraryHtml.includes('3,644 videos')) {
  failures.push('media library page: verified collection scale is missing');
}
if (!mediaLibraryHtml.includes('iCloud.com download interface allows up to 1,000')
  || !mediaLibraryHtml.includes('at least 32 separate selections')
  || !mediaLibraryHtml.includes('Each stage was added in response to the problem exposed by the stage before it')
  || !mediaLibraryHtml.includes('24,653 assets into 31,528 ordered inputs')
  || !mediaLibraryHtml.includes('Multi-frame MPO files are expanded')
  || !mediaLibraryHtml.includes('Videos remain cataloged as originals')) {
  failures.push('media library page: export constraint, development sequence, or static-image preparation is missing');
}
if (!mediaLibraryHtml.includes('supervised system built to export, verify, prepare, and search 31,550 iCloud media files')
  || !mediaLibraryHtml.includes('/media/projects/organizing-icloud-media/archive-catalog-pipeline.svg')
  || !mediaLibraryHtml.includes('width="1621" height="77"')
  || !mediaLibraryHtml.includes('evidence-figure--diagram')
  || !mediaLibraryHtml.includes('Swipe to follow')
  || mediaLibraryHtml.includes('Open full-size diagram')) {
  failures.push('media library page: high-level pipeline framing or process diagram is missing');
}
const mediaProcessOffset = mediaLibraryHtml.indexOf('id="organizing-icloud-media-process-evidence"');
const mediaArticleOffset = mediaLibraryHtml.indexOf('<article');
if (mediaProcessOffset === -1
  || mediaArticleOffset === -1
  || mediaProcessOffset > mediaArticleOffset
  || !mediaLibraryHtml.includes('>How it works</h2>')
  || !mediaLibraryHtml.includes('SHA-256 identity / 31,528 prepared inputs / 225 tests')
  || !mediaLibraryHtml.includes('It binds only to <code>127.0.0.1</code>')) {
  failures.push('media library page: detailed process evidence is missing or too distant from Pip’s introduction');
}
if (!mediaLibraryHtml.includes("iCloud's web download allows 1,000 items in one selection")
  || !mediaLibraryHtml.includes('Each file receives a SHA-256 identity')
  || !mediaLibraryHtml.includes('caught four pilot results that were not reliable enough')
  || !mediaLibraryHtml.includes('stopped before making new model calls')) {
  failures.push('media library page: Pip does not clearly connect the visitor to the deeper workflow');
}
if (/every frame of every video|video-frame record|tag every photo and every video frame/i.test(mediaLibraryHtml)) {
  failures.push('media library page: unsupported full video-frame analysis claim remains');
}
if (!mediaLibraryHtml.includes('strict JSON schema')
  || !mediaLibraryHtml.includes('database transaction')
  || !mediaLibraryHtml.includes('caught four low-fidelity pilot observations')
  || !mediaLibraryHtml.includes('127.0.0.1')
  || !mediaLibraryHtml.includes('225 named tests across 16 test modules')) {
  failures.push('media library page: fail-closed analysis, local viewer, or test evidence is incomplete');
}
for (const heading of [
  'Why the iCloud export needed its own system',
  '1. Track each download',
  '2. Identify and verify every file',
  '3. Prepare separate working copies',
  '4. Check the files before analysis',
  '5. Analyze one image at a time',
  '6. Record every attempt',
  '7. Build the search index',
  '8. Keep the viewer local',
  'Testing followed the pipeline',
]) {
  if (!mediaLibraryHtml.includes(heading)) {
    failures.push(`media library page: missing chronological heading ${heading}`);
  }
}
if (/Identity before interpretation|Deterministic preparation|Analysis that can refuse to continue|Search without exposing the collection/.test(mediaLibraryHtml)) {
  failures.push('media library page: abstract placeholder headings remain');
}
if (!horizonHtml.includes('/media/projects/horizon/startup-sequence-v2.mp4')
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
  || !publishingSystemsHtml.includes('Use Canvas, Word, Files, and Teacher Messages')
  || !publishingSystemsHtml.includes('from someone learning basic computer tasks to a doctoral candidate working through dense research')) {
  failures.push('Research and Publishing Systems page: Continuity Desk or the SWC technology packet is incomplete');
}
if (!paperfieldHtml.includes('/media/projects/paperfield/research-workflow-v2.mp4')
  || !paperfieldHtml.includes('/media/projects/paperfield/research-workflow-poster.webp')) {
  failures.push('Paperfield page: DOI, library, search, connection, or PDF workflow is missing');
}
if (!pocketllmHtml.includes('/media/projects/pocketllm/interface-tour.mp4')
  || !pocketllmHtml.includes('/media/projects/pocketllm/interface-tour-poster.webp')
  || !pocketllmHtml.includes('width="1080" height="1440"')
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
if (!smallProjectsHtml.includes('Cicada 3301-inspired sealed puzzle generated by AI and built to be AI-proof')
  || !smallProjectsHtml.includes('future stages remain encrypted until current proofs are solved and authenticated')) {
  failures.push('Small Projects page: The Silent Index is not explicitly described');
}
if (!horizonHtml.includes('first video shows its startup sequence')
  || !paperfieldHtml.includes('The video shows papers being grouped')
  || !pocketllmHtml.includes('This starts from a fresh launch')
  || !pocketllmHtml.includes("Oh! I'm not a touch screen!")
  || !pocketllmHtml.includes('finds their matching keys and creates restored copies')
  || !mediaLibraryHtml.includes('The originals remain read-only while supported images are prepared and analyzed')
  || !smallProjectsHtml.includes('The image comes from The Unrendered World')) {
  failures.push('project pages: Pip is not interpreting the new visual evidence');
}
if (!smallProjectsHtml.includes('action="/writing/social-justice-through-financial-literacy/"')
  || !financialLiteracyHtml.includes('action="/writing/rhetorical-analysis-death-penalty/"')
  || !deathPenaltyHtml.includes('action="/writing/attention-bias-modification-aggression/"')) {
  failures.push('guided trail: Small Projects and the three academic papers are not connected in order');
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
  || !homeHtml.includes('ABOUT will be our first stop')
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
const datedEntries = [
  ['/work/horizon/', '2026-03', 'March 2026'],
  ['/work/paperfield/', '2026-05', 'May 2026'],
  ['/work/pocketllm/', '2026-08', 'August 2026'],
  ['/work/research-publishing-systems/', '2026-05', 'May 2026'],
  ['/work/organizing-icloud-media/', '2026-08', 'August 2026'],
  ['/writing/social-justice-through-financial-literacy/', '2025-05', 'May 2025'],
  ['/writing/rhetorical-analysis-death-penalty/', '2025-12', 'December 2025'],
  ['/writing/attention-bias-modification-aggression/', '2026-05', 'May 2026'],
];
for (const [href, datetime, label] of datedEntries) {
  if (!allWorkRow(href).includes(`datetime="${datetime}">${label}</time>`)) {
    failures.push(`all/index.html: ${href} is missing its verified month and year`);
  }
}
const personalWritingCount = (allWorkHtml.match(/>Personal writing</g) ?? []).length;
const academicWritingCount = (allWorkHtml.match(/>Academic writing</g) ?? []).length;
if (personalWritingCount !== 0 || academicWritingCount !== 3) {
  failures.push(`all/index.html: expected 0 personal and 3 academic writing labels, found ${personalWritingCount} and ${academicWritingCount}`);
}
if (!workHtml.includes('Small Projects')
  || !allWorkHtml.includes('Small Projects')
  || !mediaLibraryHtml.includes('Small Projects')) {
  failures.push('project pages: Interactive Systems was not consistently renamed Small Projects');
}

const publicHtml = contentHtmlFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
for (const slug of [
  'a-quiet-place',
  'dear-moon',
  'false-loneliness',
  'in-focus',
  'may-4th-2026',
  'the-benefit-of-the-doubt',
  'the-sky-is-blue-and-the-trees-are-green',
  'tidal',
]) {
  if (existsSync(join(output, 'writing', slug, 'index.html'))
    || publicHtml.includes(`/writing/${slug}/`)) {
    failures.push(`personal writing: ${slug} is still published or linked onsite`);
  }
}
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
if (!aboutHtml.includes('src="/images/boomer-rawlings-about.webp"')
  || !aboutHtml.includes('alt="Boomer Rawlings standing outdoors beneath a covered walkway."')) {
  failures.push('about/index.html: approved full-length portrait is missing or lacks useful alternative text');
}
if (!existsSync(join(output, 'images', 'boomer-rawlings-about.webp'))
  || statSync(join(output, 'images', 'boomer-rawlings-about.webp')).size > 150_000) {
  failures.push('about/index.html: optimized full-length portrait asset is missing or too large');
}
if (photographyHtml.includes('boomer-rawlings-headshot')
  || photographyHtml.includes('boomer-rawlings-about')) {
  failures.push('photography/index.html: biographical portraits were incorrectly treated as photography work');
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
  || !cvHtml.includes('four separate semesters, making the President\'s List each time')
  || !cvHtml.includes('Fall 2026-2028 · Experimental Psychology B.S.')
  || !cvHtml.includes('University of California, San Diego')
  || !cvHtml.includes('Incoming psychology transfer with an intended focus on cognition and behavioral research')
  || !cvHtml.includes('href="mailto:llrawlings@ucsd.edu"')
  || !cvHtml.includes('src="/images/boomer-rawlings-headshot.webp"')
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
if (!publicHtml.includes('href="mailto:boomerrawlings@gmail.com"')
  || !publicHtml.includes('aria-label="Email Boomer Rawlings"')
  || !publicHtml.includes('class="footer-email"')
  || !publicHtml.includes('>Email</span>')
  || publicHtml.includes('>boomerrawlings@gmail.com</a>')
  || publicHtml.includes('boomer@boomerrawlings.com')) {
  failures.push('public pages: contact details are stale or incomplete');
}
if (!publicHtml.includes('aria-label="Professional profiles"')
  || !publicHtml.includes('href="https://www.linkedin.com/in/boomerrawlings/"')
  || !publicHtml.includes('href="https://github.com/BoomerRawlings"')
  || !publicHtml.includes('href="https://orcid.org/0009-0000-5843-5750"')
  || !publicHtml.includes('>LinkedIn</span>')
  || !publicHtml.includes('>GitHub</span>')
  || !publicHtml.includes('>ORCID</span>')) {
  failures.push('public pages: LinkedIn, GitHub, or ORCID footer links and icons are missing');
}

const primaryNav = homeHtml.slice(
  homeHtml.indexOf('<nav aria-label="Primary navigation">'),
  homeHtml.indexOf('</nav>', homeHtml.indexOf('<nav aria-label="Primary navigation">')),
);
let previousNavOffset = -1;
for (const [label, href] of [
  ['Academics', '/cv/'],
  ['Writing', '/writing/'],
  ['Projects', '/work/'],
  ['All Work', '/all/'],
  ['About', '/about/'],
]) {
  const navOffset = primaryNav.indexOf(`href="${href}"`);
  if (navOffset <= previousNavOffset || !primaryNav.slice(navOffset, navOffset + 180).includes(label)) {
    failures.push(`primary navigation: ${label} is missing or out of order`);
  }
  previousNavOffset = navOffset;
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

let terminalGuideCount = 0;
for (const file of contentHtmlFiles) {
  const html = readFileSync(file, 'utf8');
  const label = relative(output, file);
  const isTerminalGuide = html.includes('data-pip-terminal="true"');
  if (!html.includes('data-pip-guide')) failures.push(`${label}: missing Pip guide`);
  if (!html.includes('data-pip-progress')
    || !html.includes('data-pip-sound')
    || !html.includes('data-pip-back')) {
    failures.push(`${label}: missing Pip progress, sound, or Back control`);
  }
  if (html.indexOf('data-pip-back') < html.indexOf('data-pip-progress')) {
    failures.push(`${label}: Pip Back control is not presented beneath progress`);
  }
  if (isTerminalGuide) {
    terminalGuideCount += 1;
    if (html.includes('data-pip-destination=')) {
      failures.push(`${label}: terminal Pip guide still exposes a next destination`);
    }
  } else if (!html.includes('data-pip-destination=')) {
    failures.push(`${label}: nonterminal Pip guide is missing its destination`);
  }
  if (!html.includes('<script type="module" src="/scripts/pip.js"></script>')) {
    failures.push(`${label}: Pip interaction script is not same-origin and external`);
  }
}
if (terminalGuideCount !== 1) {
  failures.push(`Pip guide: expected one terminal page, found ${terminalGuideCount}`);
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
  if (!pipScript.includes("backButton.addEventListener('click'")
    || !pipScript.includes('step -= 1')
    || !pipScript.includes('backButton.hidden = step === 0')) {
    failures.push('Pip interaction script: Back does not restore the preceding note and speech state');
  }
  if (!pipScript.includes('submitButton.disabled = isTerminal && atLastStep')
    || !pipScript.includes("nextLabel.textContent = 'Tour complete'")
    || !pipScript.includes('nextArrow.hidden = isTerminal && atLastStep')
    || !pipScript.includes('if (isTerminal) {')) {
    failures.push('Pip interaction script: terminal tour state is not visibly complete and disabled');
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
if (!builtCss.includes('.evidence-figure--diagram .evidence-media')
  || !builtCss.includes('overscroll-behavior-inline:contain')
  || !builtCss.includes('width:80rem')
  || !builtCss.includes('.evidence-figure--diagram .evidence-pan-hint')
  || !builtCss.includes('.evidence-figure--diagram .evidence-caption>span:last-child')) {
  failures.push('Full-size diagrams are not readable through a contained mobile pan surface');
}
if (!builtCss.includes('@media (prefers-reduced-motion:reduce)') && !builtCss.includes('@media(prefers-reduced-motion:reduce)')) {
  failures.push('Pip motion does not respect reduced-motion preferences');
}

const cnamePath = join(output, 'CNAME');
if (!existsSync(cnamePath) || readFileSync(cnamePath, 'utf8').trim() !== 'boomerrawlings.com') {
  failures.push('GitHub Pages custom-domain marker is missing or incorrect');
}

const pagesWorkflow = readFileSync(join('.github', 'workflows', 'deploy-pages.yml'), 'utf8');
for (const required of ['withastro/action@e84f40bd8d2caa9e768ec82ad30dd81f0b280853', 'actions/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128', 'pages: write', 'id-token: write']) {
  if (!pagesWorkflow.includes(required)) failures.push(`GitHub Pages workflow: missing ${required}`);
}

if (failures.length) throw new Error(failures.join('\n'));
console.log(`Verified ${contentHtmlFiles.length} content pages and ${redirectTargets.size} redirects: metadata and local links pass.`);
