"""Record the separately performed source/content audit; no production imports.

This script records reviewed claims and checks artifact identities/table rendering.
It does not itself perform the interpretive source reading or visual inspection.
Run only after re-reviewing any changed publication prose or PDF.
Supports the source project and the standalone package's website/ layout while
retaining the original logical provenance keys in the recorded audit.
"""
from pathlib import Path
import hashlib
import json
import re
from pypdf import PdfReader

HERE = Path(__file__).resolve().parent
STUDY = HERE.parent
ROOT = STUDY.parent
ledger_path = HERE / 'citation_claim_ledger.json'
if ledger_path.exists() and json.loads(ledger_path.read_text(encoding='utf-8')).get('presentation_revisions'):
    raise SystemExit('Historical audit recorder stopped: presentation revisions exist. Preserve the revision ledger and follow PRESENTATION_REVISION.md; this script cannot certify or overwrite later reviews.')
PDF = STUDY / 'output/pdf/campus-safety-report.pdf'
EXPECTED_PDF = '8a0efc6be9634ac85d7fe815c153961e721ac24e714fe66e8cdd5df05eceaa88'
WEBSITE = STUDY / 'website' if (STUDY / 'website').is_dir() else ROOT / 'boomerrawlings.com'

def provenance_path(key):
    """Map stable project-relative audit keys to either supported disk layout."""
    study_prefix = 'campus_safety_analysis/'
    website_prefix = 'boomerrawlings.com/'
    if key.startswith(study_prefix):
        return STUDY / key[len(study_prefix):]
    if key.startswith(website_prefix):
        return WEBSITE / key[len(website_prefix):]
    raise ValueError('Unsupported provenance key: ' + key)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))

def compact(text):
    return re.sub(r'\s+', ' ', text).strip()

source_values = read_json(HERE / 'CITATION_VALUE_VERIFICATION.json')
assert source_values['status'] == 'PASS' and source_values['total_checks'] == 4387
assert sha(PDF) == EXPECTED_PDF, 'A different PDF requires renewed review.'
dataset_path = STUDY / 'publication/data/dataset.json'
assert sha(dataset_path) == source_values['reviewed_file_hashes']['campus_safety_analysis/publication/data/dataset.json']
data = read_json(dataset_path)
cases = read_json(STUDY / 'publication/data/case_study.json')
reader = PdfReader(PDF)
assert len(reader.pages) == 7
texts = [page.extract_text() for page in reader.pages]
flat = compact(' '.join(texts))
assert '60 rape incidents' in flat and '40 official Clery rape incidents' in flat
rows = []
for inst in data['institutions']:
    row = next(r for r in inst['years'] if r['year'] == 2024)
    count = row['counts']['oncampus']['criminal_total']
    population = row['enrollment']
    fragment = f"{inst['shortName']} {inst['branchCount']} {count:,} {population:,} {1000*count/population:.2f}"
    assert fragment in flat, fragment
    rows.append({'table': '2024 on-campus', 'unitid': inst['id'], 'expected_text': fragment})
    if row['residents'] is not None:
        count = row['counts']['residential']['rape']
        population = row['residents']
        fragment = f"{inst['shortName']} {count:,} {population:,} {1000*count/population:.2f}"
        assert fragment in compact(texts[4]), fragment
        rows.append({'table': '2024 housing rape', 'unitid': inst['id'], 'expected_text': fragment})
assert len(rows) == 53
for period in [2022, 2023, 2024, 'pooled']:
    u = next(c for c in cases if c['unitid'] == '110680' and c['period'] == period)
    s = next(c for c in cases if c['unitid'] == '122409' and c['period'] == period)
    fragment = ' '.join([str(period) if period != 'pooled' else '2022-24 pooled'] + [f"{r['asr_housing_rape_count']} / {r['fall_occupancy_sum']:,} {r['rate_per_1000']:.2f}" for r in [u, s]])
    assert fragment in compact(texts[0]), fragment

links = []
for n, page in enumerate(reader.pages, 1):
    for obj in page.get('/Annots', []):
        annot = obj.get_object()
        action = annot.get('/A', {})
        if action.get('/URI'):
            links.append({'page': n, 'uri': action['/URI'], 'rect': [float(v) for v in annot['/Rect']]})
assert len(links) == 22 and len({r['uri'] for r in links}) == 14

sources = {
    'FED': {'title': '2025 federal Campus Safety collection', 'url': 'https://ope.ed.gov/campussafety/api/dataFiles/file?fileName=Crime2025EXCEL.zip', 'locator': '2022–2024 original XLS tables; codebooks; frozen archive hashes in CITATION_VALUE_VERIFICATION.json'},
    'CATALOG': {'title': 'Federal available collection years', 'url': 'https://ope.ed.gov/campussafety/api/dataFiles/years', 'locator': 'Retrieved 25 September 2026: maximum available year 2025'},
    'REG': {'title': '34 CFR 668.46', 'url': 'https://www.ecfr.gov/current/title-34/subtitle-B/chapter-VI/part-668/subpart-D/section-668.46', 'locator': '(a), (c)(1)–(3), (5)–(9)'},
    'GUIDE': {'title': '2025 Campus Safety Survey User Guide', 'url': 'https://surveys.ope.ed.gov/csss2025/wwwroot/documents/Campus_Safety_Users_Guide.pdf', 'locator': 'Printed pp. 2–3, 25, 28–29; PDF pp. 5–6, 28, 31–32'},
    'IPEDS': {'title': 'IPEDS Fall Enrollment source files', 'url': 'https://nces.ed.gov/ipeds/use-the-data/download-access-database', 'locator': 'EF2022A/EF2023A revised; EF2024A provisional. EFTOTLT at EFALEVEL=1. Exact file URLs/hashes in source manifests.'},
    'AUDITOR': {'title': 'California State Auditor Report 2024-111', 'url': 'https://www.auditor.ca.gov/wp-content/uploads/2025/10/2024-111-Report.pdf#page=62', 'locator': 'Tables A.1/A.2, printed pp. 56–59; PDF pp. 62–65'},
    'UCSD': {'title': 'UCSD 2025 Annual Security and Fire Safety Report', 'url': 'https://www.police.ucsd.edu/docs/annualclery.pdf#page=142', 'locator': 'PDF p. 142, rape rows and revision footnotes'},
    'SDSU': {'title': 'SDSU 2025 Annual Security Report', 'url': 'https://police.sdsu.edu/_resources/files/annual-security-reports/2025-annual-security-report-finalized-08-18-25.pdf#page=7', 'locator': 'PDF p. 7, main-campus table'},
    'UCSC': {'title': 'UCSC 2025 Annual Security and Fire Safety Report', 'url': 'https://bpb-us-w2.wpmucdn.com/wordpress.ucsc.edu/dist/d/120/files/2025/09/2025-UC-Santa-Cruz-ASFSR_online-3.pdf#page=12', 'locator': 'Printed p. 11 / PDF p. 12, rape table and footnote 6'},
    'CDS': {'title': 'SDSU Common Data Set 2024–2025', 'url': 'https://asir.sdsu.edu/Documents/CommonDataSets/CDS_2024-25.pdf#page=3', 'locator': 'B1, p. 3; grand total 39,373'},
    'SDSUBUDGET': {'title': 'SDSU 2024–2025 Budget Fact Sheet', 'url': 'https://bfa.sdsu.edu/financial/budget/docs/2024-25-budget-fact-sheet.pdf#page=2', 'locator': 'p. 2, SD & IV fall 2024 headcount; p. 4 note 2'},
    'NCES': {'title': 'NCES (2024), Criminal Incidents at Postsecondary Institutions', 'url': 'https://nces.ed.gov/programs/coe/indicator/a21', 'locator': 'Figure 1 and notes: per 10,000 FTE; includes staff/guests; duplicate/geography caveats'},
    'BJS': {'title': 'Krebs et al. (2016), Campus Climate Survey Validation Study', 'url': 'https://bjs.ojp.gov/content/pub/pdf/ccsvsftr.pdf#page=131', 'locator': 'Printed p. 110 / PDF p. 131, narrowly aligned rape comparison'},
    'AAU': {'title': 'Cantor et al., AAU 2019 survey, revised 17 January 2020', 'url': 'https://www.aau.edu/uploads/images/general/Revised-Aggregate-report-and-appendices-1-7_01-16-2020_FINAL.pdf', 'locator': 'Table 2, printed p. 6 / PDF p. 36; methods and nonresponse appendix 4'},
    'API': {'title': 'Federal campus context API', 'url': 'https://ope.ed.gov/campussafety/api/campus/110680001', 'locator': 'Source-specific campus URLs in manifest. SurveyYear=2024, identity, country, housing applicability only; no substitution for frozen offense cells.'},
    'STUDY': {'title': 'Study calculations and independent audit artifacts', 'url': None, 'locator': 'PROTOCOL.md; CITATION_VALUE_VERIFICATION.json; asr_comparison_verification.json; separate INDEPENDENT_NUMERICAL_AUDIT.json'},
}

# Paraphrased claim families; repeated occurrences are audited together.
specs = [
('S01','Methods scope; page facts; PDF 1','Fixed purposive cohort of 42: 10 UC, 8 Ivy, SDSU plus 23 other institutions.',['STUDY'],'Selection protocol fixed before this study computed cohort rates; originating research already contained some results. Not preregistered or nationally representative.'),
('S02','Methods vintage; dataset; PDF 7','2025 is the latest public bulk collection found at 25 September 2026 retrieval; report years 2022–2024.',['FED','CATALOG'],'A retrieval snapshot, not a promise about future releases. Archive preparation date is not a publication date.'),
('S03','Methods vintage; discrepancy panel','One federal collection supplies primary counts; campus ASRs can differ.',['FED','UCSD','STUDY'],'No selective replacement and no unsupported chronology claim.'),
('S04','Methods timing; explorer notice; PDF 2','Counts use report year, potentially earlier occurrence year.',['REG'],'Section (c)(3); course-of-conduct rules can also matter.'),
('S05','Page notice; methods; PDF 1–2','Reported offenses are not convictions, unique victims or report forms.',['REG','UCSC'],'Section (c)(2) concerns report inclusion; UCSC provides a direct multiple-offense example.'),
('S06','Methods numerator; explorer notes','Reports can concern staff, visitors or nonstudents.',['NCES','REG'],'Does not assert a measured fraction of nonstudents at any particular institution.'),
('S07','Methods geography; PDF 2','Housing is a subset of on campus; noncampus and public property are separate.',['REG','GUIDE'],'Correct geography paragraph is (c)(5), not hate-bias paragraph (c)(4).'),
('S08','Methods categories; dataset descriptions; PDF 3–4','Combined view sums eleven specified criminal categories.',['FED','GUIDE','STUDY'],'Not all possible crime; not a deduplicated incident count.'),
('S09','Methods categories; explorer','DV, dating violence and stalking are separate VAWA views; other reporting families excluded.',['GUIDE','REG'],'Overlaps mean they are not added to the eleven-category sum.'),
('S10','Page facts; dataset','Fifteen category views: eleven individual criminal categories, their combined view, three VAWA categories.',['STUDY'],'Arithmetic 11+1+3; not fifteen mutually exclusive crimes.'),
('S11','Methods institution unit; PDF 2','212 federal campuses map to the 42 selected institutions; enrollment counted once.',['FED','API','GUIDE','STUDY'],'Independent raw API identity checks and original-workbook aggregation; institution-wide, not main-campus incidence.'),
('S12','Dataset branch/foreign notes','The inventory contains 47 reporting campuses outside the United States.',['API','STUDY'],'Country metadata corroborates notes; exposure populations are not separately measured.'),
('S13','Dataset medical notes; PDF 2–4','Some identified reporting campuses are medical facilities.',['FED','API','STUDY'],'Names independently checked; potential staff/patient exposure, not a measured composition adjustment.'),
('S14','Methods denominator; PDF 2,7','Fall headcount includes full-/part-time undergraduate and graduate/professional students; years matched.',['IPEDS','STUDY'],'126 annual EFTOTLT values independently re-read from original ZIPs at EFALEVEL=1.'),
('S15','Methods denominator; PDF 2','Distance-only students remain in the denominator.',['IPEDS','STUDY'],'Their presence does not measure physically present exposure; no unsupported correction applied.'),
('S16','Methods residents; explorer; PDF 5','Actual fall occupancy is documented for ten UCs and SDSU, 2022–2024.',['AUDITOR','STUDY'],'33 independently transcribed cells; 31 institutions have no resident denominator, rather than zero residents.'),
('S17','Methods residents; case; PDF 1,5','Housing normalization is approximate because properties have not been matched to Clery geography.',['AUDITOR','REG','STUDY'],'This is a stated unresolved crosswalk, not a claim that the source occupancy is estimated.'),
('S18','Explorer alternate population','Housing offenses divided by total enrollment do not estimate resident risk.',['REG','IPEDS','STUDY'],'Numerator and population combination is labeled in the view.'),
('S19','Methods equations; PDF 2','Annual ratio is scale times count divided by annual population.',['STUDY'],'Default scale 1,000; 10,000 changes units only. Full precision retained until display.'),
('S20','Methods pooled equation; case; PDF 1–2','Pooled ratio divides summed counts by summed matched annual populations.',['STUDY'],'Denominator-weighted mean; snapshots are not unique people or measured person-time.'),
('S21','Methods uncertainty; notices','Ratios cannot estimate personal victimization probability or establish safety ordering.',['REG','NCES','BJS','STUDY'],'Descriptive choice; no causal or equivalence claim.'),
('S22','Methods missingness; explorer; PDF 2,5','Unknown counts/populations invalidate a rate; source zeros remain zero.',['FED','GUIDE','STUDY'],'Availability and missingness independently checked; structural no-housing status is separate from an observed numeric zero.'),
('S23','Source panel; PDF 5','All 42 have complete 2024 on-campus selected counts; six lack complete pooled totals.',['FED','STUDY'],'2022 complete 36; 2023 complete 38; pooled incomplete Columbia, Florida, NYU, USC, UNC Chapel Hill, Virginia. Completeness means supplied cell coverage, not complete real-world reporting.'),
('S24','Methods applicability paragraph; dataset notes; source panel; PDF 2,5','2024 includes 103 numeric housing campuses and 109 explicitly declaring no housing; current declarations are applied to 2024 only.',['API','GUIDE','STUDY'],'SurveyYear confirmed; no backfill of prior blank cells. The current API may include post-closure updates and supplements geography applicability only.'),
('S25','Case; PDF 1','UCSD housing rape 2022/23/24 is 12/11/20; SDSU main is 9/7/1.',['UCSD','SDSU','STUDY'],'Separate versioned ASR main-campus comparison; 36-cell audit also covers other geographies.'),
('S26','Case; PDF 1','2024 housing ratios round to 0.91 UCSD and 0.12 SDSU per 1,000.',['UCSD','SDSU','AUDITOR','STUDY'],'20/21,907 and 1/8,367; approximate occupancy match.'),
('S27','Case; PDF 1','Pooled UCSD 43/58,719=0.7323013; SDSU 17/24,386=0.6971213 per 1,000.',['UCSD','SDSU','AUDITOR','STUDY'],'Shown as 0.73/0.70; closeness does not establish equivalent safety.'),
('S28','UCSC panel; dataset note; PDF 5','UCSC 2024 housing rape 38 includes 21 separate offenses disclosed in one report.',['UCSC'],'Footnote 6, printed 11/PDF 12. Count retained; not 38 victims/report forms.'),
('S29','UCSD panel; dataset note; PDF 5','UCSD 2022 on-campus rape is federal 14 versus ASR 15; noncampus 4 versus 5.',['FED','UCSD','STUDY'],'34 of 36 independently compared rape cells agree; two differences retained, not silently corrected.'),
('S30','ASR notes; research review','UCSD scooter/e-bike explanation concerns motor vehicle theft, not rape.',['UCSD'],'No unsupported rape-trend explanation.'),
('S31','Enrollment panel; dataset; PDF 3–4','SDSU 2024 IPEDS is 41,137; CDS and State Auditor 39,373.',['IPEDS','CDS','AUDITOR'],'Difference unresolved; common IPEDS definition retained throughout enrollment views.'),
('S32','SDSU dataset note','The enrollment discrepancy is not resolved by claiming Imperial Valley was omitted.',['SDSUBUDGET','CDS'],'Budget explicitly labels SD & IV at 39,373; no alternative cause inferred.'),
('S33','Related research; PDF 6','NCES uses reported campus crime per 10,000 FTE.',['NCES'],'Headcount, FTE and occupancy are not interchangeable; no unmatched benchmark imported.'),
('S34','Related research; PDF 6','BJS compares survey and administrative reporting across nine pilot campuses.',['BJS'],'Alignment of geography, population, time and reporting is required.'),
('S35','PDF 6 BJS comparison','Narrowly aligned BJS survey estimate 60 rape incidents was not statistically different from 40 Clery rape incidents.',['BJS'],'Printed 110/PDF 131; completed on-campus rape reported to school authorities; survey undergraduates/2014–15 versus 2014 Clery. Not universal completeness.'),
('S36','PDF 6 AAU comparison','AAU 2019: 33 schools, 181,752 respondents, 21.9% overall response.',['AAU'],'Table 2; definitions/recall periods and resource contacts differ from Clery, no reporting multiplier.'),
('S37','Methods interpretation; PDF 6','No universal reporting correction follows from these studies.',['BJS','AAU','STUDY'],'No causal attribution to any named campus; targeted rather than systematic review.'),
('S38','Methods statistics; PDF 2','No hypothesis tests/confidence-band ranking; offenses are not independent unique victims.',['REG','UCSC','STUDY'],'Study design decision; does not claim event-process models are universally invalid.'),
('S39','Explorer title, sort label, pair chart','Rate sorting is descriptive; paired charts use a shared zero baseline and scale.',['STUDY'],'Component inspected, including accessible captions, dynamic measure notes, unavailable values and offense-column label.'),
('S40','PDF 3–5 tables','42 all-campus and 11 resident-normalized 2024 rows reproduce source-checked counts/populations/rates.',['FED','IPEDS','AUDITOR','STUDY'],'53 rows independently matched to rendered PDF text, all pages visually reviewed.'),
('S41','Audit section; PDF 6','Separate numerical audit checked 5,670 annual and 1,890 pooled rate rows.',['STUDY'],'Audit record reviewed; its normalized-input starting point distinguished from this audit’s independent original-XLS/ZIP source reads.'),
('S42','Audit section; PDF 6','Research review, calculation audit and final citation audit have separate scopes.',['STUDY'],'Automated/code-assisted independent review, not external human peer review.'),
('S43','Download and reproduction claims','Aggregate extracts and code reproduce rates offline; original national extraction requires source downloads.',['STUDY'],'Package integrity/reproduction gate is handled separately; this audit does not certify a not-yet-frozen archive.'),
('S44','Public dataset and report privacy','Reviewed outputs contain institutional aggregate counts, denominators and source notes.',['STUDY'],'No victim-level records or identities in reviewed dataset/PDF; archive privacy is a separate gate.'),
]
claims = [{'id': ident, 'locations': location, 'claim_summary': claim, 'sources': refs, 'qualification': qualifier,
           'verdict': 'verified_with_stated_scope' if ident not in ['S43'] else 'package_gate_separate'}
          for ident,location,claim,refs,qualifier in specs]

paths = [
    'boomerrawlings.com/src/pages/writing/data-analysis/campus-safety.astro',
    'boomerrawlings.com/src/content/archive/campus-safety.md',
    'boomerrawlings.com/src/components/CampusExplorer.astro',
    'boomerrawlings.com/src/lib/campus-rates.js',
    'campus_safety_analysis/publication/data/dataset.json',
    'campus_safety_analysis/publication/data/case_study.json',
    'campus_safety_analysis/publication/data/annual_rates.csv',
    'campus_safety_analysis/publication/data/pooled_rates.csv',
    'campus_safety_analysis/output/pdf/campus-safety-report.pdf',
    'campus_safety_analysis/PROTOCOL.md',
    'campus_safety_analysis/research/RESEARCH_REVIEW.md',
    'campus_safety_analysis/research/CITATION_VALUE_VERIFICATION.json',
    'campus_safety_analysis/research/asr_comparison_verification.json',
    'campus_safety_analysis/sources/clery/residential_applicability_2024_verification.json',
]
hashes = {p: sha(provenance_path(p)) for p in paths}
ledger = {'schema_version':'1.0.0','review_date':'2026-09-25',
          'status':'source_and_content_audit_passed_for_hashed_artifacts',
          'human_peer_review':False, 'claim_families':len(claims), 'claims':claims,
          'sources':sources, 'reviewed_file_hashes':hashes,
          'counts':{'independent_original_input_checks':4387,'asr_rape_cells':36,'asr_matching_cells':34,'disclosed_asr_discrepancies':2,'pdf_pages':7,'pdf_summary_table_rows':53,'pdf_case_period_rows':4,'pdf_link_annotations':22,'pdf_distinct_link_targets':14},
          'access_limitation':'IPEDS landing-page retrieval timed out during the final pass. Original annual ZIP bytes and fields were available and independently checked; this is not evidence that the landing URL is permanently broken.',
          'not_certified_here':['final archive extraction/reproduction','deployed-site behavior','future publisher revisions','complete real-world reporting','property-level housing boundary alignment']}
(HERE/'pdf_qa').mkdir(parents=True, exist_ok=True)
(HERE/'citation_claim_ledger.json').write_text(json.dumps(ledger,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
(HERE/'pdf_qa/pdf_links.json').write_text(json.dumps(links,indent=2)+'\n',encoding='utf-8')
(HERE/'pdf_qa/report_text.txt').write_text('\n\n'.join(f'=== PAGE {i+1} ===\n{t}' for i,t in enumerate(texts)),encoding='utf-8')
(HERE/'pdf_qa/pdf_table_verification.json').write_text(json.dumps({'pdf_sha256':sha(PDF),'pdf_pages':7,'pdf_table_rows_verified':53,'case_period_rows_verified':4,'rows':rows,'errors':[]},indent=2)+'\n',encoding='utf-8')

md = '''# Separate final source and citation audit

25 September 2026. **Source/content audit passed for the exact versions below.** All seven PDF pages are included. This was a separate source-reading and claim-verification pass after the research review, supported by independent code. It is not external human peer review and does not establish complete campus reporting or personal safety.

## Scope and coverage

The review covers the study page source, methods article, explorer’s static and dynamic text, calculation helper, public dataset descriptions and institution notes, case-study data, annual/pooled tables, and seven-page report. Repeated claims are grouped into **44 claim families** in [citation_claim_ledger.json](citation_claim_ledger.json), with primary evidence, locators, qualifications and verdicts. The source review used the actual regulations, institutional tables and research passages, not citation presence alone.

Independent source-value reconstruction passed **4,387 checks with zero errors**. It reads original federal XLS tables and annual IPEDS ZIPs, independently transcribes the 33 occupancy cells, and does not import the production builder. Coverage includes 3,528 individual-category/geography/institution/year aggregates, 252 combined-category totals, 126 annual enrollment cells, resident availability, all 212 campus identities, documented branch notes and the worked comparison. The precise check categories and source-byte hashes are in [CITATION_VALUE_VERIFICATION.json](CITATION_VALUE_VERIFICATION.json); [verify_public_claim_values.py](verify_public_claim_values.py) provides the independent implementation.

The separate numerical audit verifies all **5,670 annual and 1,890 pooled rate rows**, starting from normalized source cells. That scope is different from this pass’s independent reads of original workbooks and enrollment files. It reports zero arithmetic differences. No source uncertainty is removed by agreement between implementations.

The institutional ASR audit covers **36 rape cells**: three named main campuses, three years, four geographies. **34 agree; two UCSD 2022 cells differ**. Those are source differences, not failed calculations: on-campus rape 14 federal versus 15 ASR, noncampus 4 versus 5. Housing values agree. This does not claim a review of every ASR category or every branch. See [asr_federal_rape_comparison.csv](asr_federal_rape_comparison.csv) and [asr_comparison_verification.json](asr_comparison_verification.json).

## Substantive findings

| Claim | Result and required interpretation |
|---|---|
| 42 institutions, 212 reporting campuses, 15 views, 11 documented occupancy institutions | Reconciled. Purposive cohort; institution-wide numerator, enrollment once. Fifteen views are not mutually exclusive categories. |
| Federal vintage | Official available-year catalog ends at collection 2025 at retrieval; 2022–2024 report years. Preparation date and ASR title do not establish revision chronology. |
| Report year and geography | Regulation (c)(3) supports timing; (c)(5) supports geography/housing subset. Nonstudents and multiple-offense disclosures require the NCES notes and institutional evidence as well. |
| Resident denominator | All 33 occupancy cells match State Auditor Tables A.1/A.2. Actual occupancy, not capacity; property matching remains incomplete. |
| UCSD/SDSU pooled housing example | 43 / 58,719 × 1,000 = 0.7323013; 17 / 24,386 × 1,000 = 0.6971213. Display 0.73 and 0.70. Three fall snapshots, not unique residents; no equivalent-safety inference. |
| UCSC 2024 housing rape | 38 offenses; 21 separate offenses disclosed in one report. Printed p. 11 is PDF p. 12, footnote 6. Neither 38 victims nor 38 report forms. |
| SDSU enrollment | IPEDS 41,137; CDS/State Auditor 39,373. Full scope reconciliation unresolved. The budget source explicitly includes SD and Imperial Valley, so omission of Imperial Valley does not explain it. |
| Missingness | 42 complete selected on-campus totals in 2024, 38 in 2023, 36 in 2022. Six incomplete pooled institutions retained as unavailable. Source-cell coverage is not real-world reporting completeness. |
| Housing applicability | 103 campuses have numeric housing counts; 109 explicitly declare no housing. The current API vintage is disclosed. Its 2024 declarations apply only to that year; historical blanks are not backfilled as zero. |
| NCES comparison | National indicator uses FTE, not enrolled headcount. No direct unmatched national benchmark. |
| BJS comparison | Nine pilot campuses; narrowly aligned completed, on-campus rape reported to authorities. Survey estimate 60 versus Clery 40 rape incidents; not statistically different in that study. Does not establish universal completeness. |
| AAU survey | 33 participating schools, 181,752 respondents, 21.9% response; Table 2, printed p. 6. Survey recall periods and campus-resource contact differ from Clery reporting. |
| Uncertainty | Descriptive administrative ratios. No victimization probability, causal interpretation, correction multiplier or safety ranking is claimed. |

## PDF and link review

All **seven pages** were rendered and visually inspected, including the equations, every prose paragraph and reference list. The 42 on-campus 2024 rows and 11 resident-normalized 2024 rows were independently matched to source-checked values; the four case-comparison period rows also match. No clipped text, unreadable equations, table overlap or missing glyphs were identified. The corrected final page 6 was re-rendered and reviewed.

The PDF has **22 link annotations to 14 distinct targets**: 12 references plus the study and its downloads section. Multi-line references legitimately create repeated annotations. Institutional PDF page targets are UCSD 142, SDSU 7, UCSC 12, State Auditor 62; BJS 131; SDSU CDS 3. The source titles and locators match their supporting material. BJS’s printed p. 110 corresponds to PDF p. 131. AAU Table 2 is printed p. 6 / PDF p. 36.

The IPEDS landing page timed out during the final web pass; the original annual ZIP bytes and relevant fields were independently available and checked. This is a bounded access limitation, not a finding that the portal is permanently broken. Exact download links and frozen hashes accompany the source manifests. Publisher URLs can subsequently change.

## Corrections verified

- Geography citation corrected from (c)(4) to (c)(5).
- UCSC printed-page/PDF-page distinction corrected to PDF `#page=12`.
- Unsupported ASR-versus-federal chronology removed; both vintages retained.
- Explorer detail column changed from “Reports” to “Offenses.”
- PDF BJS comparison now explicitly says **rape incidents** in both counts.

These corrections concern precision and source use; the published rate data did not change.

## Audit boundary

This clearance concerns source support and content in the hashed versions. Final archive integrity, clean offline reproduction, complete download existence and deployed browser behavior have separate release checks. It does not certify an archive before that check occurs. The reviewed public dataset and PDF contain institutional aggregates and no individual victim records. A separate package review must also exclude raw API contact fields. The source documents cannot resolve unreported offenses, the full SDSU population difference or property-level housing alignment.

## Exact reviewed versions

Paths are project-relative; SHA-256 identifies bytes rather than a mutable URL.

| Artifact | SHA-256 |
|---|---|
'''
md += '\n'.join(f'| `{p}` | `{digest}` |' for p,digest in hashes.items())
md += '\n\nThe audit plan and earlier draft preserve the review stages; this completed audit supersedes their pending status only for the scope and versions stated here.\n'
(HERE/'CITATION_AUDIT.md').write_text(md,encoding='utf-8')
print(json.dumps({'claim_families':len(claims),'pdf_pages':len(reader.pages),'pdf_sha256':sha(PDF),'pdf_table_rows':len(rows),'status':'PASS'}))
