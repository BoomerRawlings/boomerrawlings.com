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
const unlistedContentPaths = new Set([
  join('aristotter', 'index.html'),
  join('swc', 'index.html'),
]);
const contentHtmlFiles = htmlFiles.filter(
  (file) => {
    const path = relative(output, file);
    return !redirectTargets.has(path) && !unlistedContentPaths.has(path);
  },
);
const unlistedHtmlFiles = htmlFiles.filter(
  (file) => unlistedContentPaths.has(relative(output, file)),
);
if (contentHtmlFiles.length !== 22 || unlistedHtmlFiles.length !== 2 || htmlFiles.length !== 28) {
  throw new Error(
    `expected 22 public pages, 2 unlisted pages, and 4 redirects; found ${contentHtmlFiles.length}, ${unlistedHtmlFiles.length}, and ${htmlFiles.length - contentHtmlFiles.length - unlistedHtmlFiles.length}`,
  );
}

const failures = [];

const aristotterPath = join(output, 'aristotter', 'index.html');
if (!existsSync(aristotterPath)) {
  failures.push('aristotter/index.html: unlisted page is missing');
} else {
  const aristotterHtml = readFileSync(aristotterPath, 'utf8');
  if (!aristotterHtml.includes('<meta name="robots" content="noindex,nofollow,noarchive,noimageindex">')
    || !aristotterHtml.includes('<meta name="referrer" content="no-referrer">')) {
    failures.push('aristotter/index.html: private-link metadata is incomplete');
  }
}
const swcPath = join(output, 'swc', 'index.html');
if (!existsSync(swcPath)) {
  failures.push('swc/index.html: unlisted handoff page is missing');
} else {
  const swcHtml = readFileSync(swcPath, 'utf8');
  if (!swcHtml.includes('<meta name="robots" content="noindex,nofollow,noarchive,noimageindex">')
    || !swcHtml.includes('<meta name="referrer" content="no-referrer">')) {
    failures.push('swc/index.html: private-link metadata is incomplete');
  }
  for (const anchor of ['#start', '#workflows', '#downloads', '#contacts', '#handoff', '#official-links']) {
    if (!swcHtml.includes(`href="${anchor}"`)) failures.push(`swc/index.html: missing section tab ${anchor}`);
  }
  for (const download of [
    '/documents/swc/yard-roster-template-pack.zip',
    '/documents/swc/yard-class-sign-in-template-pack.zip',
    '/documents/swc/pdf/swc-rising-scholar-resource-list.pdf',
    '/documents/swc/pdf/swc-chula-vista-campus-map-and-books-supplies.pdf',
    '/documents/swc/pdf/swc-rising-scholar-launch-checklist.pdf',
    '/documents/swc/pdf/swc-laptop-loaner-checkout-process.pdf',
    '/documents/swc/pdf/swc-rising-scholars-center-log.pdf',
    '/documents/swc/pdf/swc-laptop-loaner-program-student-agreement.pdf',
  ]) {
    if (!swcHtml.includes(`href="${download}" download`) || !existsSync(join(output, download))) {
      failures.push(`swc/index.html: missing download ${download}`);
    }
    if (swcHtml.split(`href="${download}"`).length - 1 !== 1) {
      failures.push(`swc/index.html: download must appear exactly once ${download}`);
    }
  }
  for (const retiredDownload of [
    '/documents/swc/yard-roster-template.xlsx',
    '/documents/swc/yard-class-sign-in-sheet.xlsx',
    '/documents/swc/swc-loaner-laptop-agreement.docx',
    '/documents/swc/swc-office-sign-in-sheet.xlsx',
    '/documents/swc/swc-event-sign-in-sheet.xlsx',
    '/documents/swc/swc-onboarding.docx',
    '/documents/swc/swc-resources.docx',
  ]) {
    if (swcHtml.includes(retiredDownload)) failures.push(`swc/index.html: retired substitute remains linked ${retiredDownload}`);
  }
  for (const [resourceTitle, href] of [
    ['SWC Letterhead', 'https://docs.google.com/document/d/1pS-xkTVeqI3PnUSKG9ZBryxfJSb4rD32/edit?usp=drivesdk&ouid=115571851172085175998&rtpof=true&sd=true'],
    ['SWC Bookstore List', 'https://docs.google.com/spreadsheets/d/1bUlSu97rNrwFdthF1Sju8ZKRKjnL_M5IFGzfhKzXjqw/edit?usp=drivesdk'],
    ['SWC Laptop List', 'https://docs.google.com/spreadsheets/d/17-M83tEj2t8McKN-9G3HXS-pZD_aqZ8igxpy1xQIkRQ/edit?usp=drivesdk'],
    ['SWC RJ Backpack List', 'https://docs.google.com/spreadsheets/d/1DE_i4nM10_J8s5GuFD-s-QLY2dz73QspT1R4fQzYJQE/edit?usp=drivesdk'],
  ]) {
    const escapedHref = href.replaceAll('&', '&amp;');
    if (!swcHtml.includes(resourceTitle)
      || !swcHtml.includes(`href="${escapedHref}" target="_blank" rel="noopener noreferrer"`)) {
      failures.push(`swc/index.html: missing Drive link ${resourceTitle}`);
    }
  }
  for (const contactName of [
    'Jeanne Kaufman',
    'Trina Eros',
    'Paola Duarte Vargas',
    'Manuel Burciaga Tarin',
    'Sandra Salazar',
    'Sarah Valdivia',
    'Elizabeth Sisco Parada',
    'Karen Sanchez Jimenez',
    'Enrique Velez',
    'Yessica Diaz Roman, DrPH',
  ]) {
    if (!swcHtml.includes(contactName)) failures.push(`swc/index.html: missing contact ${contactName}`);
  }
  for (const contactDetail of [
    'Basic Needs Project Technician',
    'HECNC Student Services',
    'Student Employment Services',
    'Instructional Lab Technician—Microcomputer',
    'SWC Cares office',
    'IT Help Desk',
    'WorkAbility III · Jenny Nominni',
    'CADTP registrant resources',
    'Registered SUD Counselor',
    'tel:+16194216700;ext=5334',
  ]) {
    if (!swcHtml.includes(contactDetail)) failures.push(`swc/index.html: missing verified contact detail ${contactDetail}`);
  }
  if (!swcHtml.includes('This page is public.')
    || !swcHtml.includes('Unofficial resource.')
    || !swcHtml.includes('Ctrl</kbd> + <kbd>F</kbd> searches everything')
    || !swcHtml.includes('Drive access may require your SWC account.')
    || !swcHtml.includes('Source-faithful files.')
    || !swcHtml.includes('Original source needed. No substitute form is being provided.')
    || !swcHtml.includes('Original wording preserved.')
    || !swcHtml.includes('never store passwords in shared or public copies')
    || !swcHtml.includes('Never upload completed copies here.')
    || swcHtml.includes('security-updated to remove password fields')) {
    failures.push('swc/index.html: source-fidelity, safety, access, or whole-page search guidance is missing');
  }
}
for (const file of contentHtmlFiles) {
  const html = readFileSync(file, 'utf8');
  const label = relative(output, file);
  if (/href=["'][^"']*\/aristotter\/?(?:[?#][^"']*)?["']/i.test(html)) {
    failures.push(`${label}: public page links to the unlisted Aristotter route`);
  }
  const supportWidgetCount = (html.match(/data-name="BMC-Widget"/g) ?? []).length;
  const supportFallbackCount = (html.match(/class="bmc-widget-fallback"/g) ?? []).length;
  if (supportWidgetCount !== 1
    || supportFallbackCount !== 1
    || !html.includes('src="https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js"')
    || !html.includes('defer')
    || !html.includes('data-id="BoomerRawlings"')
    || !html.includes('data-position="Right"')
    || !html.includes('data-y_margin="18"')
    || !html.includes('aria-label="Buy Boomer a coffee"')) {
    failures.push(`${label}: Buy Me a Coffee widget is missing, duplicated, or misplaced`);
  }
  if (/href=["'][^"']*\/swc\/?(?:[?#][^"']*)?["']/i.test(html)) {
    failures.push(`${relative(output, file)}: public page links to the unlisted SWC route`);
  }
}

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

const metadataValues = {
  title: new Map(),
  description: new Map(),
  canonical: new Map(),
};
const schemaByPage = new Map();
const expectedSitemapUrls = new Set();

function readImageMetadata(path) {
  const source = readFileSync(path);
  if (source.subarray(0, 3).toString('hex') === 'ffd8ff') {
    let offset = 2;
    const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    while (offset + 8 < source.length) {
      if (source[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      while (source[offset] === 0xff) offset += 1;
      const marker = source[offset];
      offset += 1;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (marker === 0xda) break;
      const length = source.readUInt16BE(offset);
      if (startOfFrame.has(marker)) {
        return {
          width: source.readUInt16BE(offset + 5),
          height: source.readUInt16BE(offset + 3),
          type: 'image/jpeg',
        };
      }
      offset += length;
    }
  }
  if (source.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
    return {
      width: source.readUInt32BE(16),
      height: source.readUInt32BE(20),
      type: 'image/png',
    };
  }
  if (source.subarray(0, 4).toString('ascii') === 'RIFF'
    && source.subarray(8, 12).toString('ascii') === 'WEBP') {
    const format = source.subarray(12, 16).toString('ascii');
    if (format === 'VP8X') {
      return {
        width: source.readUIntLE(24, 3) + 1,
        height: source.readUIntLE(27, 3) + 1,
        type: 'image/webp',
      };
    }
    if (format === 'VP8 ') {
      return {
        width: source.readUInt16LE(26) & 0x3fff,
        height: source.readUInt16LE(28) & 0x3fff,
        type: 'image/webp',
      };
    }
    if (format === 'VP8L') {
      const dimensions = source.readUInt32LE(21);
      return {
        width: (dimensions & 0x3fff) + 1,
        height: ((dimensions >>> 14) & 0x3fff) + 1,
        type: 'image/webp',
      };
    }
  }
  return undefined;
}

for (const file of contentHtmlFiles) {
  const html = readFileSync(file, 'utf8');
  const label = relative(output, file);
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = html.match(/<meta name="description" content="([^"]+)">/)?.[1];
  const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
  if (!title) failures.push(label + ': missing title');
  if (!description) failures.push(label + ': missing description');
  if (!canonical?.startsWith('https://boomerrawlings.com/')) failures.push(label + ': missing canonical');
  for (const [field, value] of Object.entries({ title, description, canonical })) {
    if (!value) continue;
    if (metadataValues[field].has(value)) {
      failures.push(`${label}: duplicate ${field} also used by ${metadataValues[field].get(value)}`);
    } else {
      metadataValues[field].set(value, label);
    }
  }
  if (!html.includes('http-equiv="Content-Security-Policy"')
    || !html.includes('name="referrer" content="strict-origin-when-cross-origin"')) {
    failures.push(label + ': missing portable security metadata');
  }
  if (!html.includes('<meta name="author" content="Boomer Rawlings">')
    || !html.includes('<link rel="author" href="/about/">')
    || !html.includes('<link rel="icon" type="image/svg+xml" href="/favicon.svg">')) {
    failures.push(label + ': missing author or favicon identity metadata');
  }
  const expectedRobots = label === join('photography', 'index.html')
    ? 'noindex,follow'
    : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
  if (!html.includes(`<meta name="robots" content="${expectedRobots}">`)) {
    failures.push(`${label}: incorrect robots directive`);
  }
  if (canonical && !expectedRobots.startsWith('noindex')) expectedSitemapUrls.add(canonical);
  for (const required of [
    '<meta property="og:site_name" content="Boomer Rawlings">',
    '<meta property="og:locale" content="en_US">',
    '<meta property="og:image" content="https://boomerrawlings.com/',
    '<meta property="og:image:secure_url" content="https://boomerrawlings.com/',
    '<meta property="og:image:type" content="image/',
    '<meta property="og:image:width" content="',
    '<meta property="og:image:height" content="',
    '<meta property="og:image:alt" content="',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="',
    '<meta name="twitter:description" content="',
    '<meta name="twitter:image" content="https://boomerrawlings.com/',
    '<meta name="twitter:image:alt" content="',
  ]) {
    if (!html.includes(required)) failures.push(`${label}: missing social metadata ${required}`);
  }
  const socialImage = html.match(/<meta property="og:image" content="([^"]+)">/)?.[1];
  if (socialImage) {
    const imagePath = new URL(socialImage).pathname.slice(1);
    const builtImagePath = join(output, imagePath);
    if (!existsSync(builtImagePath)) {
      failures.push(`${label}: social preview asset is missing: ${imagePath}`);
    } else {
      const actualImage = readImageMetadata(builtImagePath);
      const declaredImage = {
        type: html.match(/<meta property="og:image:type" content="([^"]+)">/)?.[1],
        width: Number(html.match(/<meta property="og:image:width" content="([^"]+)">/)?.[1]),
        height: Number(html.match(/<meta property="og:image:height" content="([^"]+)">/)?.[1]),
      };
      if (!actualImage
        || actualImage.type !== declaredImage.type
        || actualImage.width !== declaredImage.width
        || actualImage.height !== declaredImage.height) {
        failures.push(`${label}: declared social image metadata does not match ${imagePath}`);
      }
    }
  }
  const jsonLdMatches = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)];
  if (jsonLdMatches.length !== 1) {
    failures.push(`${label}: expected one JSON-LD graph, found ${jsonLdMatches.length}`);
  } else {
    try {
      const schema = JSON.parse(jsonLdMatches[0][1]);
      schemaByPage.set(label, schema);
      if (schema['@context'] !== 'https://schema.org' || !Array.isArray(schema['@graph'])) {
        failures.push(`${label}: JSON-LD is not a Schema.org graph`);
      }
    } catch {
      failures.push(`${label}: JSON-LD is not valid JSON`);
    }
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

const socialCardPath = join(output, 'images', 'boomer-rawlings-social.jpg');
const socialCardMetadata = existsSync(socialCardPath) ? readImageMetadata(socialCardPath) : undefined;
if (!socialCardMetadata
  || socialCardMetadata.width !== 1200
  || socialCardMetadata.height !== 630
  || socialCardMetadata.type !== 'image/jpeg'
  || statSync(socialCardPath).size > 200_000) {
  failures.push('social preview: 1200x630 JPEG is missing, invalid, or too large');
}

const sitemapPath = join(output, 'sitemap-0.xml');
if (!existsSync(sitemapPath)) {
  failures.push('sitemap: sitemap-0.xml is missing');
} else {
  const sitemapXml = readFileSync(sitemapPath, 'utf8');
  const sitemapUrls = new Set([...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
  const missingUrls = [...expectedSitemapUrls].filter((url) => !sitemapUrls.has(url));
  const extraUrls = [...sitemapUrls].filter((url) => !expectedSitemapUrls.has(url));
  if (missingUrls.length || extraUrls.length) {
    failures.push(`sitemap: canonical set mismatch; missing [${missingUrls.join(', ')}], extra [${extraUrls.join(', ')}]`);
  }
}

const writingHtml = readFileSync(join(output, 'writing', 'index.html'), 'utf8');
const publishedDateCount = (writingHtml.match(/<time datetime="[^"]+">Published /g) ?? []).length;
if (publishedDateCount !== 5) {
  failures.push('writing/index.html: expected 5 labeled publication dates, found ' + publishedDateCount);
}
if (!writingHtml.includes('aria-labelledby="writing-academic"')) {
  failures.push('writing/index.html: missing academic writing grouping');
}
if (!writingHtml.includes('aria-labelledby="writing-personal"')
  || !writingHtml.includes('>Personal essay</h2>')) {
  failures.push('writing/index.html: selected personal essay grouping is missing');
}
if (writingHtml.includes('>Category<')) {
  failures.push('writing/index.html: obsolete category label remains');
}
if (!writingHtml.includes('Academic writing')) {
  failures.push('writing/index.html: academic writing heading is missing');
}
if (!writingHtml.includes('Selected academic work and one short personal essay, with publication and original production dates kept distinct')) {
  failures.push('writing/index.html: selected writing scope is not explicit');
}
for (const route of [
  '/writing/the-age-of-curation/',
  '/writing/social-justice-through-financial-literacy/',
  '/writing/rhetorical-analysis-death-penalty/',
  '/writing/attention-bias-modification-aggression/',
  '/writing/self-inflicted-pain-error-correction/',
]) {
  if (!writingHtml.includes(`href="${route}"`)) {
    failures.push(`writing/index.html: missing onsite writing link ${route}`);
  }
}
if ((writingHtml.match(/href="https:\/\/boomerrawlings\.substack\.com\/"/g) ?? []).length !== 1
  || (writingHtml.match(/Substack/g) ?? []).length !== 1) {
  failures.push('writing/index.html: single quiet Substack reference is missing');
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
const selfInflictedPainHtml = readFileSync(
  join(output, 'writing', 'self-inflicted-pain-error-correction', 'index.html'),
  'utf8',
);
const ageOfCurationHtml = readFileSync(
  join(output, 'writing', 'the-age-of-curation', 'index.html'),
  'utf8',
);

for (const phrase of [
  'Information used to be scarce.',
  'The challenge is no longer simply finding information. It is deciding what deserves attention.',
  'subtraction becomes more important than addition',
  'What can I add?',
  'What is worth keeping?',
]) {
  if (!ageOfCurationHtml.includes(phrase)) {
    failures.push(`The Age of Curation: missing essay language: ${phrase}`);
  }
}
if (!writingHtml.includes('action="/writing/the-age-of-curation/"')
  || !ageOfCurationHtml.includes('action="/writing/social-justice-through-financial-literacy/"')
  || !ageOfCurationHtml.includes('Published August 27, 2026')
  || !ageOfCurationHtml.includes('Produced August 27, 2026')) {
  failures.push('The Age of Curation: index placement, guide trail, or dates are missing');
}

const academicDocuments = [
  {
    html: financialLiteracyHtml,
    label: 'financial literacy page',
    src: '/documents/social-justice-through-financial-literacy.pdf',
    pages: 11,
    provenance: 'Research essay produced for ENGL 115 at Southwestern College on May 26, 2025.',
    title: 'Social Justice through Financial Literacy',
    subject: 'A May 2025 research essay arguing that financial education should include real accounts, practical experience, and an honest discussion of unequal access.',
    keywords: 'financial literacy, education, social justice',
  },
  {
    html: deathPenaltyHtml,
    label: 'death penalty page',
    src: '/documents/rhetorical-analysis-death-penalty.pdf',
    pages: 6,
    provenance: 'Rhetorical analysis produced for ENGL C1001 at Southwestern College on December 8, 2025.',
    title: 'Rhetorical Analysis: Comparing Opposing Texts',
    subject: 'A December 2025 analysis comparing how the Federalist Society and Amnesty International argue opposing positions on the death penalty.',
    keywords: 'rhetoric, death penalty, critical writing',
  },
  {
    html: academicHtml,
    label: 'attention-bias proposal page',
    src: '/documents/attention-bias-modification-aggression.pdf',
    pages: 10,
    provenance: 'Original student research proposal produced at Southwestern College in May 2026.',
    title: 'The Effects of Attention Bias Modification on Aggression in Justice-Impacted Young Adults',
    subject: 'A May 2026 student proposal for testing whether attention-bias modification could reduce hostile attention bias and aggression among justice-impacted young adults.',
    keywords: 'psychology, justice-impacted populations, research methods',
  },
  {
    html: selfInflictedPainHtml,
    label: 'self-inflicted pain proposal page',
    src: '/documents/self-inflicted-pain-error-correction-research-proposal.pdf',
    pages: 53,
    provenance: 'Independent research proposal prepared August 27, 2026.',
    title: 'Self-Inflicted Pain as Error Correction in Childhood and Adolescence',
    subject: 'Independent research proposal',
    keywords: 'self-punishment, head banging, self-injury, adolescence, error correction, intervention research',
    language: 'en',
    viewerLabel: 'Independent research proposal',
  },
];

for (const {
  html,
  label,
  src,
  pages,
  provenance,
  title,
  subject,
  keywords,
  language = 'en-US',
  viewerLabel = 'Original paper',
} of academicDocuments) {
  const publicPdf = join(output, src);
  if (!existsSync(publicPdf)) {
    failures.push(`${label}: missing public PDF asset ${src}`);
  } else if (readFileSync(publicPdf).subarray(0, 5).toString() !== '%PDF-') {
    failures.push(`${label}: ${src} is not a valid PDF asset`);
  } else {
    const pdfSource = readFileSync(publicPdf).toString('latin1');
    for (const metadata of [
      `/Title(${title})`,
      '/Author(Boomer Rawlings)',
      `/Subject(${subject})`,
      `/Keywords(${keywords})`,
      `/Lang(${language})`,
    ]) {
      if (!pdfSource.includes(metadata)) {
        failures.push(`${label}: PDF discovery metadata is incomplete: ${metadata}`);
      }
    }
  }
  if (!html.includes(provenance) || !html.includes(`${viewerLabel} · ${pages} pages`)) {
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
if (!academicHtml.includes('action="/writing/self-inflicted-pain-error-correction/"')
  || academicHtml.includes('data-pip-terminal="true"')) {
  failures.push('attention-bias proposal page: next research proposal is not connected');
}
if (!selfInflictedPainHtml.includes('data-pip-terminal="true"')
  || !selfInflictedPainHtml.includes('The document presents a research plan, not completed findings.')
  || selfInflictedPainHtml.includes('data-pip-destination=')) {
  failures.push('self-inflicted pain proposal page: terminal research-plan context is missing');
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
const tritonTidepoolHtml = readFileSync(join(output, 'work', 'triton-tidepool', 'index.html'), 'utf8');
const pocketllmHtml = readFileSync(join(output, 'work', 'pocketllm', 'index.html'), 'utf8');
const aiSkillsStart = workHtml.indexOf('<section class="ai-skills"');
const aiSkillsHtml = aiSkillsStart >= 0
  ? workHtml.slice(aiSkillsStart, workHtml.indexOf('</section>', aiSkillsStart))
  : '';
let previousAiSkillOffset = -1;
for (const [name, href] of [
  ['Research Briefing Assistant', 'https://github.com/BoomerRawlings/research-briefing-assistant'],
  ['Printable', 'https://github.com/BoomerRawlings/Skills/tree/main/skills/printable'],
  ['BW Printable', 'https://github.com/BoomerRawlings/Skills/tree/main/skills/bw-printable'],
]) {
  const skillOffset = aiSkillsHtml.indexOf(`href="${href}"`);
  if (skillOffset <= previousAiSkillOffset
    || !aiSkillsHtml.includes(`aria-label="View ${name} on GitHub"`)) {
    failures.push(`work/index.html: AI skill ${name} is missing, misordered, or not directly linked`);
  }
  previousAiSkillOffset = skillOffset;
}
if (!aiSkillsHtml.includes('id="ai-skills-heading">AI Skills</h2>')
  || !aiSkillsHtml.includes('Reusable Codex workflows.')
  || !aiSkillsHtml.includes('claim-level reconciliation and auditable quality gates')
  || !aiSkillsHtml.includes('verified table of contents')
  || !aiSkillsHtml.includes('understandable in grayscale')
  || allWorkHtml.includes('github.com/BoomerRawlings/Skills/tree/main/skills/')) {
  failures.push('work/index.html: compact AI Skills section is incomplete or leaking into All Work');
}
if (!workHtml.includes('id="personal-search-router-heading">Personal Search Router</h2>')
  || !workHtml.includes('I made this small Firefox add-on for myself to streamline daily browsing.')
  || !workHtml.includes('href="https://addons.mozilla.org/en-US/firefox/addon/personal-search-router/"')
  || !workHtml.includes('href="https://github.com/BoomerRawlings/personal-search-router"')) {
  failures.push('work/index.html: Personal Search Router blurb or public links are missing');
}
const worklinePath = join(output, 'work', 'workline', 'index.html');
if (existsSync(worklinePath)) {
  failures.push('Workline page: hidden project still has a generated detail route');
}
const smallProjectsHtml = readFileSync(
  join(output, 'work', 'interactive-systems', 'index.html'),
  'utf8',
);
const schemaTypesFor = (path) => new Set(
  (schemaByPage.get(path)?.['@graph'] ?? []).flatMap((node) => node['@type'] ?? []),
);
const schemaNodeFor = (path, type) => (
  schemaByPage.get(path)?.['@graph'] ?? []
).find((node) => (Array.isArray(node['@type']) ? node['@type'] : [node['@type']]).includes(type));
const homeSchema = schemaByPage.get('index.html');
const homeSchemaText = JSON.stringify(homeSchema);
const websiteNode = schemaNodeFor('index.html', 'WebSite');
const personNode = schemaNodeFor('index.html', 'Person');
if (websiteNode?.name !== 'Boomer Rawlings'
  || websiteNode?.url !== 'https://boomerrawlings.com/'
  || websiteNode?.alternateName !== 'boomerrawlings.com'
  || personNode?.name !== 'Boomer Rawlings'
  || personNode?.['@id'] !== 'https://boomerrawlings.com/#person'
  || !homeSchemaText.includes('https://boomerrawlings.com/#person')
  || !homeSchemaText.includes('https://www.linkedin.com/in/boomerrawlings/')
  || !homeSchemaText.includes('https://github.com/BoomerRawlings')
  || !homeSchemaText.includes('https://orcid.org/0009-0000-5843-5750')
  || !homeSchemaText.includes('https://boomerrawlings.substack.com/')) {
  failures.push('index.html: canonical WebSite and Person identity graph is incomplete');
}
const aboutLabel = join('about', 'index.html');
const profileNode = schemaNodeFor(aboutLabel, 'ProfilePage');
const aboutPersonNode = schemaNodeFor(aboutLabel, 'Person');
if (profileNode?.mainEntity?.['@id'] !== 'https://boomerrawlings.com/#person'
  || aboutPersonNode?.name !== 'Boomer Rawlings') {
  failures.push('about/index.html: ProfilePage structured data is missing');
}
for (const [slug, academic] of [
  ['the-age-of-curation', false],
  ['social-justice-through-financial-literacy', true],
  ['rhetorical-analysis-death-penalty', true],
  ['attention-bias-modification-aggression', true],
  ['self-inflicted-pain-error-correction', true],
]) {
  const label = join('writing', slug, 'index.html');
  const types = schemaTypesFor(label);
  const articleNode = schemaNodeFor(label, 'Article');
  const html = readFileSync(join(output, label), 'utf8');
  if (!types.has('Article')
    || (academic && !types.has('ScholarlyArticle'))
    || (!academic && types.has('ScholarlyArticle'))
    || !types.has('BreadcrumbList')
    || !articleNode?.headline
    || articleNode?.author?.['@id'] !== 'https://boomerrawlings.com/#person'
    || !/^\d{4}-\d{2}-\d{2}$/.test(articleNode?.datePublished ?? '')
    || articleNode?.image
    || !html.includes('<span>By <a href="/about/" rel="author">Boomer Rawlings</a></span>')
    || !html.includes('<meta property="og:type" content="article">')) {
    failures.push(`${label}: article identity, breadcrumb, byline, or Open Graph type is missing`);
  }
}
for (const slug of [
  'horizon',
  'paperfield',
  'triton-tidepool',
  'pocketllm',
  'continuity-desk',
  'research-briefing-assistant',
  'research-publishing-systems',
  'organizing-icloud-media',
  'interactive-systems',
]) {
  const label = join('work', slug, 'index.html');
  const types = schemaTypesFor(label);
  if (!types.has('CreativeWork') || !types.has('BreadcrumbList')) {
    failures.push(`${label}: CreativeWork or breadcrumb structured data is missing`);
  }
}
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
  || !horizonHtml.includes('/media/projects/horizon/interface-tour-poster.webp')
  || !horizonHtml.includes('A moment of quiet before the work begins.')
  || !horizonHtml.includes('Capture, projects, and focus share one local workspace.')) {
  failures.push('Horizon page: clean startup sequence or guided interface tour is missing');
}
if (!horizonHtml.includes('width="1920" height="1080"')) {
  failures.push('Horizon page: startup sequence is not published at 1920×1080');
}
const publishingSystemsHtml = readFileSync(
  join(output, 'work', 'research-publishing-systems', 'index.html'),
  'utf8',
);
const continuityDeskHtml = readFileSync(
  join(output, 'work', 'continuity-desk', 'index.html'),
  'utf8',
);
const briefingAssistantHtml = readFileSync(
  join(output, 'work', 'research-briefing-assistant', 'index.html'),
  'utf8',
);
if (!publishingSystemsHtml.includes('href="/work/continuity-desk/"')
  || !publishingSystemsHtml.includes('95-page packet')
  || !publishingSystemsHtml.includes('Getting Connected at Southwestern College')
  || !publishingSystemsHtml.includes('Use Canvas, Word, Files, and Teacher Messages')
  || !publishingSystemsHtml.includes('from someone opening Canvas for the first time to a researcher managing dense source material')) {
  failures.push('Research and Publishing Systems page: Continuity Desk link or the SWC technology packet is incomplete');
}
const continuityPdf = join(output, 'documents', 'continuity-desk-sample-research-project-continuity.pdf');
if (!existsSync(continuityPdf)
  || readFileSync(continuityPdf).subarray(0, 5).toString() !== '%PDF-'
  || statSync(continuityPdf).size < 20_000) {
  failures.push('Continuity Desk page: public sample PDF is missing or invalid');
}
if (!continuityDeskHtml.includes('href="https://continuitydesk.io/"')
  || !continuityDeskHtml.includes('href="https://continuitydesk.io/sample"')
  || !continuityDeskHtml.includes('fictional and composite')
  || !continuityDeskHtml.includes('built by Boomer Rawlings through Rawlings Consulting LLC')
  || !continuityDeskHtml.includes('Public sample dossier · 8 pages')
  || !continuityDeskHtml.includes('<iframe src="/documents/continuity-desk-sample-research-project-continuity.pdf#view=FitH"')
  || !continuityDeskHtml.includes('contentUrl":"https://boomerrawlings.com/documents/continuity-desk-sample-research-project-continuity.pdf"')) {
  failures.push('Continuity Desk page: verified framing, source links, embedded sample, or PDF schema is missing');
}
if (!briefingAssistantHtml.includes('Work in progress')
  || !briefingAssistantHtml.includes('keeps ChatGPT and Gemini research passes separate until both are saved and hashed')
  || !briefingAssistantHtml.includes('standard-library Python validator')
  || !briefingAssistantHtml.includes('cannot decide whether a paper was interpreted correctly')
  || !briefingAssistantHtml.includes('href="https://github.com/BoomerRawlings/research-briefing-assistant"')
  || !briefingAssistantHtml.includes('creativeWorkStatus":"Work in progress"')) {
  failures.push('Research Briefing Assistant page: WIP scope, verified implementation, limits, source, or schema is missing');
}
if (!paperfieldHtml.includes('/media/projects/paperfield/research-workflow-v2.mp4')
  || !paperfieldHtml.includes('/media/projects/paperfield/research-workflow-poster.webp')
  || !paperfieldHtml.includes('A research library becomes a desk for arranging ideas and following connections.')) {
  failures.push('Paperfield page: DOI, library, search, connection, or PDF workflow is missing');
}
if (!tritonTidepoolHtml.includes('89 registered sources')
  || !tritonTidepoolHtml.includes('71 completed research records')
  || !tritonTidepoolHtml.includes('611 verified active-run artifacts')
  || !tritonTidepoolHtml.includes('A summary is not evidence')
  || !tritonTidepoolHtml.includes('page, paragraph, line, or timestamp')
  || !tritonTidepoolHtml.includes('These checks cannot prove that an interpretation is complete or correct')) {
  failures.push('Triton Tidepool page: dated scale, evidence verification, or limits are missing');
}
const tidepoolNoticeOffset = tritonTidepoolHtml.indexOf('class="entry-affiliation-notice"');
const tidepoolArticleOffset = tritonTidepoolHtml.indexOf('<article');
if (tidepoolNoticeOffset < tritonTidepoolHtml.indexOf('data-pip-guide')
  || tidepoolNoticeOffset > tidepoolArticleOffset
  || !tritonTidepoolHtml.includes('aria-label="Independence notice"')
  || !tritonTidepoolHtml.includes('Triton Tidepool is an independent project by Boomer Rawlings')
  || !tritonTidepoolHtml.includes('not affiliated with, endorsed by, sponsored by, or supported by UC San Diego, UC San Diego Athletics, or The Regents of the University of California')) {
  failures.push('Triton Tidepool page: the independence notice is missing or misplaced');
}
if (!pocketllmHtml.includes('/media/projects/pocketllm/interface-tour.mp4')
  || !pocketllmHtml.includes('/media/projects/pocketllm/interface-tour-poster.webp')
  || !pocketllmHtml.includes('width="1080" height="1440"')
  || !pocketllmHtml.includes('TXT, MD, CSV, TSV, and JSONL')
  || !pocketllmHtml.includes('.pocketkey')
  || !pocketllmHtml.includes('The originals stay put; working copies can be pseudonymized and restored locally.')
  || !pocketllmHtml.includes('not a compliance certification')) {
  failures.push('pocketLLM page: demo evidence, supported files, restoration key, or limits are missing');
}
if (!paperfieldHtml.includes('action="/work/triton-tidepool/"')
  || !tritonTidepoolHtml.includes('action="/work/pocketllm/"')
  || !pocketllmHtml.includes('action="/work/research-publishing-systems/"')
  || !publishingSystemsHtml.includes('action="/work/continuity-desk/"')
  || !continuityDeskHtml.includes('action="/work/research-briefing-assistant/"')
  || !briefingAssistantHtml.includes('action="/work/organizing-icloud-media/"')) {
  failures.push('project trail: Paperfield, Triton Tidepool, pocketLLM, publishing systems, Continuity Desk, Briefing Assistant, and media pipeline are not connected');
}
if (!smallProjectsHtml.includes('/media/projects/small-projects/the-unrendered-world.webp')) {
  failures.push('Small Projects page: The Unrendered World visual is missing');
}
if (smallProjectsHtml.includes('Axiom Maze')) {
  failures.push('Small Projects page: retired Axiom Maze name remains');
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
  || !deathPenaltyHtml.includes('action="/writing/attention-bias-modification-aggression/"')
  || !academicHtml.includes('action="/writing/self-inflicted-pain-error-correction/"')) {
  failures.push('guided trail: Small Projects and the academic papers are not connected in order');
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
if (!researchHtml.includes('href="/work/research-briefing-assistant/"')
  || !researchHtml.includes('href="/work/triton-tidepool/"')
  || !researchHtml.includes('href="/work/research-publishing-systems/"')
  || !researchHtml.includes('<span class="project-stage">Work in progress</span>')
  || !researchHtml.includes('href="/writing/attention-bias-modification-aggression/"')
  || !researchHtml.includes('href="/writing/self-inflicted-pain-error-correction/"')) {
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
  ['/work/triton-tidepool/', '2026-08', 'August 2026'],
  ['/work/pocketllm/', '2026-08', 'August 2026'],
  ['/work/research-briefing-assistant/', '2026-08', 'August 2026'],
  ['/work/research-publishing-systems/', '2026-05', 'May 2026'],
  ['/work/organizing-icloud-media/', '2026-08', 'August 2026'],
  ['/writing/social-justice-through-financial-literacy/', '2025-05', 'May 2025'],
  ['/writing/rhetorical-analysis-death-penalty/', '2025-12', 'December 2025'],
  ['/writing/attention-bias-modification-aggression/', '2026-05', 'May 2026'],
  ['/writing/self-inflicted-pain-error-correction/', '2026-08', 'August 2026'],
  ['/writing/the-age-of-curation/', '2026-08', 'August 2026'],
];
for (const [href, datetime, label] of datedEntries) {
  if (!allWorkRow(href).includes(`datetime="${datetime}">${label}</time>`)) {
    failures.push(`all/index.html: ${href} is missing its verified month and year`);
  }
}
const personalWritingCount = (allWorkHtml.match(/>Personal writing</g) ?? []).length;
const academicWritingCount = (allWorkHtml.match(/>Academic writing</g) ?? []).length;
if (personalWritingCount !== 1 || academicWritingCount !== 4) {
  failures.push(`all/index.html: expected 1 personal and 4 academic writing labels, found ${personalWritingCount} and ${academicWritingCount}`);
}
if (!workHtml.includes('Small Projects')
  || !allWorkHtml.includes('Small Projects')
  || !mediaLibraryHtml.includes('Small Projects')) {
  failures.push('project pages: Interactive Systems was not consistently renamed Small Projects');
}
if (!workHtml.includes('href="/work/continuity-desk/"')
  || !allWorkHtml.includes('href="/work/continuity-desk/"')) {
  failures.push('Continuity Desk: dedicated project is missing from Projects or All Work');
}

const publicHtml = contentHtmlFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
if (/>\s*boomerrawlings\.com\s*</i.test(publicHtml)) {
  failures.push('public pages: redundant visible domain label remains');
}
for (const oldCaption of [
  'Launching Horizon moves through its startup sequence before the local desktop workspace appears.',
  "The in-app guide moves through Horizon's core workflow",
  'One session searches across a 24-paper Library organized into six categories',
  'A fresh-launch demonstration: drag in two synthetic files',
]) {
  if (publicHtml.includes(oldCaption)) {
    failures.push(`project videos: literal old caption remains: ${oldCaption}`);
  }
}
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
  'triton-tidepool',
  'research-briefing-assistant',
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
if (!homeHtml.includes('>WIP project</span>')
  || !workHtml.includes('href="/work/research-briefing-assistant/"')
  || !workHtml.includes('<span class="project-stage">Work in progress</span>')
  || !allWorkHtml.includes('href="/work/research-briefing-assistant/"')
  || !allWorkRow('/work/research-briefing-assistant/').includes('>WIP project</span>')) {
  failures.push('Research Briefing Assistant: WIP project is not prominent across project indexes');
}
if (!aboutHtml.includes('2026 Student of Distinction Award')
  || !aboutHtml.includes('President’s List four times')) {
  failures.push('about/index.html: missing 2026 Student of Distinction recognition');
}
if (!aboutHtml.includes('href="/cv/"') || !aboutHtml.includes('View academics')) {
  failures.push('about/index.html: Academics page is not linked');
}
if (!aboutHtml.includes('Coffee &amp; conversation')
  || !aboutHtml.includes('href="https://www.buymeacoffee.com/BoomerRawlings"')
  || !aboutHtml.includes('href="mailto:boomerrawlings@gmail.com"')) {
  failures.push('about/index.html: warm support and contact invitation is missing');
}
if (!aboutHtml.includes('src="/images/boomer-rawlings-headshot.webp"')
  || !aboutHtml.includes('alt="Boomer Rawlings smiling outdoors."')
  || aboutHtml.includes('src="/images/boomer-rawlings-about.webp"')) {
  failures.push('about/index.html: approved headshot is missing, mislabeled, or replaced by the full-body portrait');
}
const photographyMain = photographyHtml.slice(
  photographyHtml.indexOf('<main'),
  photographyHtml.indexOf('</main>'),
);
if (photographyMain.includes('boomer-rawlings-headshot')
  || photographyMain.includes('boomer-rawlings-about')) {
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
  || !cvHtml.includes('Introduction to Programming Logic and Design Using Python')
  || !cvHtml.includes('href="/writing/self-inflicted-pain-error-correction/"')
  || !cvHtml.includes('August 2026 · Independent research proposal')) {
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
  ['About', '/about/'],
  ['All Work', '/all/'],
]) {
  const navOffset = primaryNav.indexOf(`href="${href}"`);
  if (navOffset <= previousNavOffset || !primaryNav.slice(navOffset, navOffset + 180).includes(label)) {
    failures.push(`primary navigation: ${label} is missing or out of order`);
  }
  previousNavOffset = navOffset;
}
if ((primaryNav.match(/class="nav-label" data-nav-label=/g) ?? []).length !== 5) {
  failures.push('primary navigation: signal-ready labels are incomplete');
}

const homeContents = homeHtml.slice(
  homeHtml.indexOf('<section class="contents"'),
  homeHtml.indexOf('</section>', homeHtml.indexOf('<section class="contents"')),
);
let previousContentsOffset = -1;
for (const [label, href] of [
  ['Academics', '/cv/'],
  ['Writing', '/writing/'],
  ['Projects', '/work/'],
  ['All Work', '/all/'],
]) {
  const contentsOffset = homeContents.indexOf(`href="${href}"`);
  if (contentsOffset <= previousContentsOffset
    || !homeContents.slice(contentsOffset, contentsOffset + 220).includes(label)) {
    failures.push(`home contents: ${label} is missing or out of order`);
  }
  previousContentsOffset = contentsOffset;
}
if (homeContents.includes('href="/research/"')
  || homeContents.includes('href="/about/"')
  || !homeContents.includes('>Overview</span>')
  || !homeContents.includes('aria-label="9 published projects"')) {
  failures.push('home contents: section overview is stale or project count is missing');
}
const homeGuideOffset = homeHtml.indexOf('data-pip-guide');
const homeContentsOffset = homeHtml.indexOf('<section class="contents"');
if (homeGuideOffset === -1 || homeContentsOffset === -1 || homeGuideOffset > homeContentsOffset) {
  failures.push('home contents: Pip is not positioned above the Contents overview line');
}
const portfolioMapStart = homeHtml.indexOf('<div class="portfolio-map" data-portfolio-map aria-hidden="true">');
const portfolioMapEnd = homeHtml.indexOf('</div>', portfolioMapStart);
const portfolioMapHtml = portfolioMapStart === -1 || portfolioMapEnd === -1
  ? ''
  : homeHtml.slice(portfolioMapStart, portfolioMapEnd);
if (!homeHtml.includes('<h1 class="sr-only">Projects, research, and writing by Boomer Rawlings.</h1>')
  || !portfolioMapHtml.includes('class="portfolio-map__graphic"')
  || !portfolioMapHtml.includes('aria-hidden="true" focusable="false"')
  || !portfolioMapHtml.includes('class="portfolio-map__pip"')
  || !portfolioMapHtml.includes('class="portfolio-curator"')
  || (homeHtml.match(/class="portfolio-curator"/g) ?? []).length !== 1) {
  failures.push('home map: Pip is not the single hidden visual center of the portfolio map');
}
for (const mapKey of ['academics', 'writing', 'projects', 'all-work']) {
  if ((homeContents.match(new RegExp(`data-map-target="${mapKey}"`, 'g')) ?? []).length !== 1
    || (portfolioMapHtml.match(new RegExp(`data-map-node="${mapKey}"`, 'g')) ?? []).length !== 1
    || (portfolioMapHtml.match(new RegExp(`data-map-branch="${mapKey}"`, 'g')) ?? []).length !== 2) {
    failures.push(`home map: ${mapKey} target, node, or branch is missing`);
  }
}

const workPagePaths = [
  'horizon',
  'paperfield',
  'triton-tidepool',
  'pocketllm',
  'continuity-desk',
  'research-briefing-assistant',
  'research-publishing-systems',
  'organizing-icloud-media',
  'interactive-systems',
];
const workPages = workPagePaths.map((slug) =>
  readFileSync(join(output, 'work', slug, 'index.html'), 'utf8')
);
const discouragedProgressCopy = /Further documentation|intentionally provisional|incomplete|in progress|pending approval/i;
for (const [index, html] of workPages.entries()) {
  if (workPagePaths[index] !== 'research-briefing-assistant' && discouragedProgressCopy.test(html)) {
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
  const pipCount = (
    html.match(/class="[^"]*\bportfolio-curator\b[^"]*"/g) ?? []
  ).length;
  if (!html.includes('data-pip-guide')) failures.push(`${label}: missing Pip guide`);
  if (pipCount !== 1) failures.push(`${label}: expected exactly one Pip, found ${pipCount}`);
  if (label === 'index.html' && !html.includes('curator-guide--home')) {
    failures.push('index.html: missing home Pip');
  }
  if (label !== 'index.html' && !html.includes('curator-guide--compact')) {
    failures.push(`${label}: missing compact Pip`);
  }
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
    || !pipScript.includes('step -= 1;\n    updateStep();\n    animatePip(guide)')
    || !pipScript.includes('backButton.hidden = step === 0')) {
    failures.push('Pip interaction script: Back does not restore the preceding note and speech state');
  }
  if (!pipScript.includes("form.addEventListener('submit'")
    || !pipScript.includes('step += 1;\n      updateStep();\n      animatePip(guide)')) {
    failures.push('Pip interaction script: Next does not advance the note with a speaking response');
  }
  if (!pipScript.includes("window.addEventListener('pageshow', (event) =>")
    || !pipScript.includes('delete form.dataset.pipNavigating')
    || !pipScript.includes('delete guide.dataset.pipNavigating')
    || !pipScript.includes("guide.classList.remove('is-departing')")
    || !pipScript.includes('if (event.persisted)')) {
    failures.push('Pip interaction script: browser history can restore a hidden or navigation-locked guide');
  }
  if (!pipScript.includes('submitButton.disabled = isTerminal && atLastStep')
    || !pipScript.includes("nextLabel.textContent = 'Tour complete'")
    || !pipScript.includes('nextSignal.hidden = isTerminal && atLastStep')
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
if (!builtCss.includes('pip-transfer-squish')
  || !builtCss.includes('view-transition-group(pip-curator)')
  || !builtCss.includes('view-transition-image-pair(pip-curator)')
  || !builtCss.includes('view-transition-old(pip-curator)')
  || !builtCss.includes('view-transition-new(pip-curator)')) {
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
if (!builtCss.includes('pip-feature-idle')
  || !builtCss.includes('pip-feature-talk')
  || !builtCss.includes('pip-ambient-slice')
  || !builtCss.includes('pip-cheer-response-slice')
  || !builtCss.includes('.curator-guide .portfolio-curator:before')) {
  failures.push('Pip is missing the shared cheerful cyan/yellow feature response');
}
if (!builtCss.includes('pip-hover-smile-in')
  || !builtCss.includes('pip-hover-smile-out')
  || !builtCss.includes('pip-hover-feature-glitch')) {
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
if (!builtCss.includes('.curator-guide .portfolio-curator:before,.curator-guide .portfolio-curator:after{opacity:0!important;transform:none!important}')) {
  failures.push('Pip feature layers remain visible when reduced motion is requested');
}
if (builtCss.includes('.signal-rail') || publicHtml.includes('data-signal-rail')) {
  failures.push('Signal rail: obsolete full-width signal treatment remains');
}
if (!builtCss.includes('pip-signal-breathe')
  || !builtCss.includes('pip-signal-speak')
  || !builtCss.includes('.pip-signal--next')) {
  failures.push('Pip signal: localized ambient and speaking treatments are missing');
}
if (!builtCss.includes('grid-template-columns:1.875rem auto 1.875rem')
  || !builtCss.includes('.curator-next [data-pip-next-label]')) {
  failures.push('Pip Next: label is not centered independently of its decorative signal');
}
if (!builtCss.includes('portfolio-map-flow')
  || !builtCss.includes('portfolio-map-pip-ring')
  || !builtCss.includes('.portfolio-map__pip')
  || !builtCss.includes('.portfolio-map__node[data-map-node=academics]')) {
  failures.push('Home map: Pip-centered ambient or Contents highlight behavior is missing');
}
if (!builtCss.includes('pip-map-signal-split')) {
  failures.push('Home map: Pip signal split is missing');
}
for (const reaction of ['academics', 'writing', 'projects', 'all-work']) {
  if (!builtCss.includes(`pip-map-react-${reaction}`)) {
    failures.push(`Home map: Pip's ${reaction} facial reaction is missing`);
  }
}
for (const file of contentHtmlFiles) {
  const html = readFileSync(file, 'utf8');
  const label = relative(output, file);
  const pipSignalCount = (html.match(/data-pip-signal=/g) ?? []).length;
  if (pipSignalCount !== 1
    || !html.includes('data-pip-signal="next" aria-hidden="true"')
    || html.includes('data-pip-arrow')) {
    failures.push(`${label}: expected one hidden Pip signal inside Next, found ${pipSignalCount}`);
  }
  if (!html.includes('data-wordmark="Boomer Rawlings" aria-hidden="true"')) {
    failures.push(`${label}: shared glitch wordmark is missing or exposed to assistive technology`);
  }
  for (const [navLabel, href] of [
    ['Academics', '/cv/'],
    ['Writing', '/writing/'],
    ['Projects', '/work/'],
    ['About', '/about/'],
    ['All Work', '/all/'],
  ]) {
    if (!html.includes(`href="${href}" aria-label="${navLabel}"`)
      || !html.includes(`data-nav-label="${navLabel}" aria-hidden="true"`)) {
      failures.push(`${label}: ${navLabel} glitch label is missing or not accessibly named`);
    }
  }
}
if (!homeHtml.includes('data-wordmark="Boomer Rawlings"')
  || !builtCss.includes('wordmark-glitch-body')
  || !builtCss.includes('wordmark-glitch-upper')
  || !builtCss.includes('wordmark-glitch-lower')
  || !builtCss.includes('portfolio-wordmark')
  || !builtCss.includes('nav-glitch-body')
  || !builtCss.includes('nav-glitch-upper')
  || !builtCss.includes('nav-glitch-lower')
  || !builtCss.includes('content:attr(data-wordmark)')) {
  failures.push('Header signal: wordmark continuity or left-to-right navigation glitch is missing');
}
if (!builtCss.includes('pip-curator-breathe') || !builtCss.includes('pip-panel-breathe')) {
  failures.push('Pip and the guide panel are missing their shared low-motion breathing treatment');
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
console.log(`Verified ${contentHtmlFiles.length} public pages, ${unlistedHtmlFiles.length} unlisted pages, and ${redirectTargets.size} redirects: metadata and local links pass.`);
