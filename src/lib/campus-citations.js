import { parseFragment, serialize } from 'parse5';

const base = '/data-analysis/campus-safety/data/';

// Exact URLs retain each verified locator. Different page/section locators are
// distinct references even when they point into the same source document.
export const campusSourceTitles = new Map([
  ['https://ope.ed.gov/campussafety/api/dataFiles/file?fileName=Crime2025EXCEL.zip', 'U.S. Department of Education. Campus Safety and Security, 2025 collection: 2022–2024 bulk data files.'],
  ['https://ope.ed.gov/campussafety/#/datafile/list', 'U.S. Department of Education. Campus Safety and Security data download portal.'],
  ['https://nces.ed.gov/ipeds/use-the-data/download-access-database', 'National Center for Education Statistics. Integrated Postsecondary Education Data System complete files and data dictionaries; fall enrollment, 2022–2024.'],
  ['https://www.auditor.ca.gov/wp-content/uploads/2025/10/2024-111-Report.pdf#page=62', 'California State Auditor. Report 2024-111, Tables A.1–A.2, printed pp. 56–59 (PDF pp. 62–65): fall student-housing occupancy.'],
  ['https://www.police.ucsd.edu/docs/annualclery.pdf#page=142', 'University of California, San Diego. 2025 Annual Security Report, p. 142: reported crime statistics.'],
  ['https://police.sdsu.edu/_resources/files/annual-security-reports/2025-annual-security-report-finalized-08-18-25.pdf#page=7', 'San Diego State University. 2025 Annual Security Report, p. 7: main-campus reported crime statistics.'],
  ['https://bpb-us-w2.wpmucdn.com/wordpress.ucsc.edu/dist/d/120/files/2025/09/2025-UC-Santa-Cruz-ASFSR_online-3.pdf#page=12', 'University of California, Santa Cruz. 2025 Annual Security and Fire Safety Report, printed p. 11 (PDF p. 12), footnote 6.'],
  ['https://asir.sdsu.edu/Documents/CommonDataSets/CDS_2024-25.pdf#page=3', 'San Diego State University. Common Data Set 2024–2025, p. 3: enrollment.'],
  ['https://www.ecfr.gov/current/title-34/subtitle-B/chapter-VI/part-668/subpart-D/section-668.46#p-668.46(c)(3)', 'Code of Federal Regulations, title 34, § 668.46(c)(3): calendar-year reporting.'],
  ['https://www.ecfr.gov/current/title-34/subtitle-B/chapter-VI/part-668/subpart-D/section-668.46', 'Code of Federal Regulations, title 34, § 668.46(a), (c)(5): definitions and reporting geography.'],
  ['https://surveys.ope.ed.gov/csss2025/wwwroot/documents/Campus_Safety_Users_Guide.pdf', 'U.S. Department of Education. 2025 Campus Safety and Security Survey User’s Guide: offense categories and collection instructions.'],
  ['https://surveys.ope.ed.gov/csss2025/wwwroot/documents/Campus_Safety_Users_Guide.pdf#page=5', 'U.S. Department of Education. 2025 Campus Safety and Security Survey User’s Guide, printed pp. 2–3 (PDF pp. 5–6): reporting campuses.'],
  ['https://nces.ed.gov/programs/coe/indicator/a21', 'National Center for Education Statistics. Criminal Incidents at Postsecondary Institutions: scope and full-time-equivalent enrollment denominator.'],
  ['https://bjs.ojp.gov/content/pub/pdf/ccsvsftr.pdf#page=131', 'Bureau of Justice Statistics. Campus Climate Survey Validation Study: Final Technical Report, printed p. 110 (PDF p. 131): comparison with Clery reports.'],
  ...Object.entries({
    'PRESENTATION_REVISION.md': 'Campus safety presentation revision: abbreviation definitions, primary-source provenance and interface/source-navigation checks.',
    'PROTOCOL.md': 'Campus safety study protocol: fixed cohort, report years and comparison rules.',
    'source_manifest.json': 'Campus safety source manifest: exact source URLs, versions, retrieval dates and original-file hashes.',
    'dataset.json': 'Campus safety published dataset: source-derived counts, populations and reporting-campus scope.',
    'asr_federal_rape_comparison.csv': 'Campus safety source reconciliation: 36 rape cells from federal and institutional tables.',
    'DENOMINATORS.md': 'Campus safety denominator reconciliation: enrollment definitions, housing occupancy and unresolved differences.',
    'COVERAGE.md': 'Campus safety coverage audit: missingness, branch aggregation and housing applicability.',
    'category_dictionary.csv': 'Campus safety category dictionary: federal source fields and eleven-category criminal-offense total.',
    'campus_crosswalk.csv': 'Campus safety institution and reporting-campus crosswalk.',
    'enrollment_denominators.csv': 'Campus safety enrollment denominator records: source-derived fall headcounts, 2022–2024.',
    'annual_rates.csv': 'Campus safety annual rates: counts, population denominators, calculation results and availability.',
    'AMENDMENT.md': 'Campus safety protocol amendment: documented coverage and housing-applicability decisions.',
    'sources/clery/residential_applicability_2024_verification.json': 'Campus safety 2024 residential-applicability verification: numeric housing counts and explicit federal no-housing declarations.',
    'RESEARCH_REVIEW.md': 'Campus safety related-research review: study designs, populations, measures and interpretive limitations.',
    'INDEPENDENT_NUMERICAL_AUDIT.md': 'Campus safety independent numerical audit: source joins, counts, populations and rate calculations.',
    'CITATION_AUDIT.md': 'Campus safety separate source and citation audit: claim support, locators and interpretive qualifications.',
    'VISUAL_AUDIT.md': 'Campus safety website visual audit: mathematical notation, responsive layout and interaction checks.',
    'PDF_VISUAL_AUDIT.md': 'Campus safety report visual audit: seven-page PDF, mathematical notation and table checks.',
  }).map(([file, title]) => [base + file, title]),
]);

const attr = (node, name) => node.attrs?.find(attribute => attribute.name === name)?.value;
const hasAttr = (node, name) => node.attrs?.some(attribute => attribute.name === name);
const textContent = node => node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(textContent).join('');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** Build static citations from marked evidence links and methods source links. */
export function addCampusCitations(html) {
  const tree = parseFragment(html);
  const references = new Map();
  let study;
  function walk(node, inMethods = false, excluded = false) {
    if (hasAttr(node, 'data-campus-study')) study = node;
    const methods = inMethods || attr(node, 'id') === 'methods';
    const skip = excluded || ['script', 'style', 'noscript'].includes(node.tagName) || attr(node, 'id') === 'downloads';
    for (const child of [...(node.childNodes ?? [])]) {
      const href = attr(child, 'href');
      const isSource = child.tagName === 'a' && href && !hasAttr(child, 'data-citation-exempt') &&
        (hasAttr(child, 'data-campus-citation') || (methods && (href.startsWith('https://') || href.startsWith(base))));
      if (!skip && isSource) {
        const label = textContent(child).trim();
        let reference = references.get(href);
        if (!reference) {
          reference = { number: references.size + 1, href, title: campusSourceTitles.get(href) ?? label, occurrences: [] };
          references.set(href, reference);
        }
        const id = `campus-cite-${reference.number}-${reference.occurrences.length + 1}`;
        reference.occurrences.push(id);
        const replacement = parseFragment(`<sub class="campus-citation"><a id="${id}" href="#campus-source-${reference.number}" role="doc-noteref" aria-label="Source ${reference.number}: ${escape(reference.title)}" title="${escape(reference.title)}">[${reference.number}]</a></sub>`).childNodes[0];
        replacement.parentNode = node;
        node.childNodes[node.childNodes.indexOf(child)] = replacement;
      } else walk(child, methods, skip);
    }
  }
  walk(tree);
  if (!study) throw new Error('Campus citations require a data-campus-study container.');
  const entries = [...references.values()].map(reference => `<li id="campus-source-${reference.number}" tabindex="-1"><a class="campus-source-link" data-campus-verbatim href="${escape(reference.href)}">${escape(reference.title)}</a><span class="campus-source-backlinks">Return to ${reference.occurrences.map((id, index) => `<a href="#${id}" role="doc-backlink" aria-label="Return to citation ${index + 1} of source ${reference.number}">citation ${index + 1}</a>`).join(', ')}</span></li>`).join('');
  const bibliography = parseFragment(`<section id="sources" class="analysis-section campus-sources" role="doc-endnotes" aria-labelledby="campus-sources-heading"><div class="analysis-section-title"><span>06</span><div><h2 id="campus-sources-heading">Sources and references</h2><p>Numbered references link to the evidence. Return links lead back to each citation in the study.</p></div></div><ol class="campus-source-list">${entries}</ol></section>`).childNodes[0];
  bibliography.parentNode = study;
  study.childNodes.push(bibliography);
  return serialize(tree);
}
