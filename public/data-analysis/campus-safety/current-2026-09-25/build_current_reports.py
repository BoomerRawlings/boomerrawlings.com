"""Generate the dated current-source reports. Original publication PDFs remain unchanged."""
from pathlib import Path
import argparse, json, csv, hashlib
from xml.sax.saxutils import escape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Flowable
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/'publication/current-2026-09-25'
OUT=ROOT/'output/pdf';OUT.mkdir(parents=True,exist_ok=True)
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--campus-only',action='store_true',help='Rebuild campus report while preserving existing Crime and Heat PDF bytes.')
args=parser.parse_args()
fonts=Path('C:/Windows/Fonts')
for name,file in [('Body','arial.ttf'),('Bold','arialbd.ttf'),('Italic','ariali.ttf'),('Title','georgiab.ttf'),('MathItalic','cambriai.ttf')]: pdfmetrics.registerFont(TTFont(name,str(fonts/file)))
pdfmetrics.registerFont(TTFont('Math',str(fonts/'cambria.ttc'),subfontIndex=0))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='Bold',italic='Italic',boldItalic='Bold')
INK=colors.HexColor('#203447');TEAL=colors.HexColor('#005b68');MUTED=colors.HexColor('#526273');RULE=colors.HexColor('#cbd4d9');PALE=colors.HexColor('#eef2f1')
W,H,M=612,792,48;CW=516
styles={
 'body':ParagraphStyle('body',fontName='Body',fontSize=9.6,leading=13.4,textColor=INK,spaceAfter=9),
 'small':ParagraphStyle('small',fontName='Body',fontSize=8.2,leading=11.3,textColor=MUTED,spaceAfter=7),
 'title':ParagraphStyle('title',fontName='Title',fontSize=26,leading=31,textColor=INK,spaceAfter=15),
 'h1':ParagraphStyle('h1',fontName='Title',fontSize=19,leading=24,textColor=INK,spaceAfter=14),
 'h2':ParagraphStyle('h2',fontName='Bold',fontSize=11,leading=15,textColor=TEAL,spaceBefore=10,spaceAfter=6),
 'table':ParagraphStyle('table',fontName='Body',fontSize=8.2,leading=11,textColor=INK),
 'head':ParagraphStyle('head',fontName='Bold',fontSize=8,leading=10.4,textColor=colors.white),
}
story=[]
def P(s,style='body'): return Paragraph(s,styles[style])
def p(s,style='body'): story.append(P(s,style))
def page(s): story.extend([PageBreak(),P(s,'h1')])
def h(s):p(s,'h2')
def link(url,label): return f'<link href="{escape(url)}" color="#005b68">{escape(label)}</link>'
def table(headers,rows,widths,pad=5,markup=False):
    t=Table([[P(escape(str(x)),'head') for x in headers]]+[[P(str(x) if markup else escape(str(x)),'table') for x in r] for r in rows],colWidths=widths,repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),TEAL),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,PALE]),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),pad),('BOTTOMPADDING',(0,0),(-1,-1),pad),('LINEBELOW',(0,-1),(-1,-1),.5,RULE)]));story.extend([t,Spacer(1,8)])
def number(x):return 'Unavailable' if x is None else f'{x:,}'
def rate(x):return 'Unavailable' if x is None else f'{x:.2f}'
class Equation(Flowable):
    def __init__(self,pooled=False):
        Flowable.__init__(self);self.pooled=pooled;self.width=CW;self.height=108 if pooled else 72
    def draw(self):
        c=self.canv;c.setFillColor(INK);c.setStrokeColor(INK)
        def text(x,y,s,font='Math',size=15):
            c.setFont(font,size);c.drawString(x,y,s);return pdfmetrics.stringWidth(s,font,size)
        def atom(x,y,s):
            w=text(x,y,s,'MathItalic');text(x+w,y-4,'it','MathItalic',9)
        x=(CW-(218 if self.pooled else 143))/2;y=54 if self.pooled else 35
        w=text(x,y,'R','MathItalic');text(x+w,y-4,'i, pooled' if self.pooled else 'it','Math' if self.pooled else 'MathItalic',9)
        x+=58 if self.pooled else 25;x+=text(x,y,' = ');x+=text(x,y,'k','MathItalic');x+=8
        if self.pooled:
            for yy,s in [(y+21,'C'),(y-29,'N')]:
                text(x+9,yy,'∑','Math',22);text(x+5,yy+23,'2024','Math',7);text(x,yy-10,'t = 2022','MathItalic',7);atom(x+43,yy+4,s)
            c.setLineWidth(.7);c.line(x-2,y+7,x+81,y+7)
        else:
            atom(x+5,y+14,'C');atom(x+5,y-17,'N');c.setLineWidth(.7);c.line(x,y+6,x+36,y+6)

def build(dest,title):
    def footer(c,d):
        date='26 September 2026' if title.startswith('Campus safety') else '25 September 2026'
        c.saveState();c.setStrokeColor(RULE);c.line(M,42,W-M,42);c.setFillColor(MUTED);c.setFont('Body',8);c.drawString(M,29,'Boomer Rawlings | '+title+' | '+date);c.drawRightString(W-M,29,str(d.page));c.restoreState()
    SimpleDocTemplate(str(dest),pagesize=(W,H),leftMargin=M,rightMargin=M,topMargin=48,bottomMargin=56,title=title,author='Boomer Rawlings').build(story,onFirstPage=footer,onLaterPages=footer)
    return {'file':dest.name,'pages':len(PdfReader(dest).pages),'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}

data=json.loads((DATA/'dataset.json').read_text(encoding='utf8'))
inventory=json.loads((DATA/'source_inventory.json').read_text(encoding='utf8'))
coverage=json.loads((DATA/'coverage.json').read_text(encoding='utf8'))
cases=json.loads((DATA/'case_study.json').read_text(encoding='utf8'))
with (DATA/'population_sources.csv').open(encoding='utf8',newline='') as stream:
    population_sources=list(csv.DictReader(stream))
resident_sources={(r['unitid'],int(r['year'])):r for r in population_sources if r['measure']=='residents'}
resident_2024=coverage['population_coverage']['2024']['residents']
resident_2025=coverage['population_coverage']['2025']['residents']
SITE='https://boomerrawlings.com/writing/data-analysis/campus-safety/'
BASE='https://boomerrawlings.com/data-analysis/campus-safety/current-2026-09-25/'
REFS=[
('San Diego State University. Current 2026 Annual Security Report; covers 2023-2025. Main-campus crime table: document p. 7.','https://police.sdsu.edu/_resources/files/asr_2026_newdraft.pdf#page=7'),
('San Diego State University. 2025 Annual Security Report, p. 7. Retained for the 2022 value and edition comparison.','https://police.sdsu.edu/_resources/files/annual-security-reports/2025-annual-security-report-finalized-08-18-25.pdf#page=7'),
('California State Auditor. Report 2024-111, Tables A.1-A.2, printed pp. 56-59 / PDF pp. 62-65. Actual fall housing occupancy.','https://www.auditor.ca.gov/wp-content/uploads/2025/10/2024-111-Report.pdf#page=62'),
('University of California, San Diego. 2025 annual security report, reissued February 2026; crime tables pp. 142-143.','https://www.police.ucsd.edu/docs/annualclery.pdf#page=142'),
('Code of Federal Regulations (CFR), title 34, section 668.46: definitions, calendar report years and geographic categories.','https://www.ecfr.gov/current/title-34/subtitle-B/chapter-VI/part-668/subpart-D/section-668.46'),
('National Center for Education Statistics. Integrated Postsecondary Education Data System (IPEDS), data release schedule; fall-count source records linked separately below.','https://nces.ed.gov/ipeds/survey-components/data-release-schedule'),
('United States Department of Education. Campus Safety and Security data portal, 2025 bulk collection; original 2022-2024 snapshot.','https://ope.ed.gov/campussafety/#/datafile/list'),
('NCES. Criminal Incidents at Postsecondary Institutions: national rates use full-time-equivalent enrollment.','https://nces.ed.gov/programs/coe/indicator/a21'),
('Bureau of Justice Statistics. Campus Climate Survey Validation Study, printed p. 110 / PDF p. 131: survey versus administrative reporting.','https://bjs.ojp.gov/content/pub/pdf/ccsvsftr.pdf#page=131'),
('Current source inventory: all 42 institutions, official listing/report links, retrieval dates, hashes and limits.',BASE+'source_inventory.json'),
('Current source-cell ledger: raw values, four geographies, edition/year, source locator, status and calculation decisions.',BASE+'source_cells.csv'),
('Current audit and reproduction record: source verification, calculations, citation review, visual checks and complete data.',SITE+'#downloads'),
('Population-source ledger: adopted values, observation dates, source pages, checksums and geographic qualifications.',BASE+'population_sources.csv'),
('Stanford University. Stanford Facts 2025, printed p. 46 / PDF p. 48: autumn 2024 housing. University-authored document recovered from StudyInternational; original official file unavailable.', 'https://studyinternational.com/wp-content/uploads/2026/03/2025-Stanford-Fact-Book_WEB.pdf#page=48'),
('Stanford University. Stanford Facts: Student Life / Housing. Autumn quarter 2025 residents.', 'https://facts.stanford.edu/campus-life'),
('Carnegie Mellon University. 2024 Annual Security and Fire Safety Report, p. 84: fall 2022 housing census.', 'https://www.cmu.edu/police/reports/fire-safety/2024asr.pdf#page=84'),
('Carnegie Mellon University. 2026 Annual Security and Fire Safety Report, p. 81: fall 2023 and 2024 housing census.', 'https://www.cmu.edu/police/reports/fire-safety/2026-asr-final.pdf#page=81'),
('Carnegie Mellon University Housing. Information for families: on-campus housing unavailable to graduate students.', 'https://www.cmu.edu/housing/about-us/for-our-families.html'),
('University of Texas at Austin. University Housing and Dining, Learning and Outcomes Report 2023-2024, PDF p. 5: spring 2024 residents.', 'https://utexas.app.box.com/v/LearnOutcomeReports/file/1743656171859'),
('Yale University, Office of Institutional Research. W023, Headcount of Students in University Housing, PDF pp. 1-2; fall reference date and notes p. 3. Updated October 16, 2025.', resident_sources[('130794',2024)]['source_url']),
('Stanford University. Stanford Facts 2024, printed p. 46 / PDF p. 48: autumn 2023 housing. Internet Archive capture of the original university PDF, April 14, 2024.', resident_sources[('243744',2023)]['source_url']+'#page=48'),
('Resident-evidence ledger: documented partial, approximate and definition-unresolved observations; excluded from exact resident denominators.', 'https://www.boomerrawlings.com/data-analysis/campus-safety/current-2026-09-25/resident_evidence.json'),
]
p('CAMPUS SAFETY DATA ANALYSIS / CURRENT-SOURCE REVISION','small')
p('Campus safety,<br/>in proportion.','title')
p('Reported campus offenses by geography and documented population. Offense-source audit dated 25 September 2026; resident-source follow-up dated 26 September 2026. Original federal results remain available as an explicit archive.')
h('Scope and principal interpretation')
p(f'The fixed cohort includes <b>42 institutions</b>: the ten University of California (UC) institutions, eight Ivy League institutions and 24 other public/private universities including San Diego State University (SDSU). Current table extraction covers <b>{coverage["institutions_with_extracted_cells"]} institutions</b>, with verification limits stated for each. Four calendar years, 2022-2025, are available in the interface; coverage differs by edition and branch. [10-12]')
p(f'The default compares 2024 campus-housing reports per 1,000 documented residents. <b>{coverage["available_rates"]["2024"]["residents"]} combined criminal-offense rates are available among {resident_2024} institutions with resident counts.</b> These populations are dated snapshots with qualified geographic scope. {resident_2025} populations are adopted for 2025, but no complete matching combined institutional rate is available. Missing rates do not imply no reports. These administrative ratios are not convictions, unique-victim counts or student victimization probabilities. [3,5,10,13]')
h('SDSU rape reports: why 2024 has both one and three')
table(['Report year','Housing subset','Campus total','Noncampus','Public','Combined'],[[2023,8,11,2,0,13],[2024,1,1,2,0,3],[2025,10,11,5,0,16]],[76,92,88,90,72,98])
p('Housing is already included in campus total. For 2024, <b>1 campus + 2 noncampus + 0 public = 3</b>. The earlier count of one describes housing/on-campus geography. Both report editions agree on those 2024 values; this discrepancy is geographic, not a revision. The 2026 edition does revise 2023 housing rape from seven to eight. [1,2]')
p('The email-only 2026 count is excluded: no reporting cutoff and aligned scope have been established. A report titled 2026 does not establish complete 2026 calendar data. The currently linked file name contains "newdraft"; this study records the listing and exact file hash without asserting final certification. [1,10]','small')
p(link(SITE,'Interactive study, current sources and downloadable data'),'small')

page('Population and rate calculations')
p('An annual report edition is a publication version. Calendar report year identifies when an offense was reported to a campus security authority or local police, not necessarily when it occurred. Reports can involve nonstudents. [5]')
h('Annual descriptive ratio')
story.append(Equation())
p('<i>C</i><sub>it</sub> is the selected count for institution <i>i</i>, year <i>t</i>; <i>N</i><sub>it</sub> is that year\'s documented population. The scale <i>k</i> is 1,000, or 10,000 when selected online. Counts and denominators accompany every rate. [3,6a,11,13]')
h('Pooled 2022-2024 annual ratio')
story.append(Equation(True))
p('Sum the three counts and divide by the sum of the three dated population snapshots. This is a denominator-weighted mean, not an unweighted average and not unique people across three years. Calculations retain full precision until display; any unavailable component withholds the result.')
h('Population alignment')
p('Housing populations combine the State Auditor\'s actual fall occupancy and university housing census counts. These are dated fall/autumn snapshots and approximate institutional housing denominators: properties are not matched individually to Clery residential geography. Optional enrollment measures use institution-wide fall headcount, including part-time and distance-only students. Neither denominator measures time physically present. [3,6a,13-18,20,21]')
p('Capacity, rounded estimates and incomplete undergraduate/graduate subsets are retained as research leads, not substituted for actual resident totals. No earlier population is carried forward. A valid population alone does not resolve missing source counts. The original 2022-2024 federal enrollment bytes remain unchanged. [6,10,12,13]')

page('Expanded source and population coverage')
p(f'The acquisition follow-up increases 2024 combined housing-count availability from 29 to {coverage["housing_count_coverage"]["2024"]} institutions; documented resident populations from 11 to {resident_2024}; and paired rates from 10 to {coverage["available_rates"]["2024"]["residents"]}. Current source extraction reaches all {coverage["institutions_with_extracted_cells"]} institutions, comprising {coverage["source_cells"]:,} source cells. Access and extraction do not establish complete reporting. [10-13]')
h('Initial five resident additions')
table(['Institution / period','Residents','Source scope'],[
('Stanford, autumn 2024','14,203','7,108 students in undergraduate housing + 7,095 in graduate housing. University-authored factbook recovered from a publisher mirror. [14]'),
('Stanford, autumn 2025','14,042','6,727 students in undergraduate housing + 7,315 in graduate housing. Current official university page. [15]'),
('Carnegie Mellon, fall 2022','3,458','3,158 university housing + 300 fraternity/sorority housing. [16,18]'),
('Carnegie Mellon, fall 2023','3,764','3,515 university housing + 249 fraternity/sorority housing. [17,18]'),
('Carnegie Mellon, fall 2024','3,988','3,732 university housing + 256 fraternity/sorority housing. [17,18]'),
],[163,64,289],pad=6)
p('Stanford university-provided housing is not reconciled to every Clery parcel or overseas branch. The 2024 mirror agrees with the visible university-authored page and indexed official values; identical original bytes could not be authenticated. Carnegie Mellon combines disjoint undergraduate housing categories; its housing office excludes graduate students from on-campus housing. Its table is labeled Pittsburgh, although the 2024 total matches university-wide undergraduate enrollment. These source qualifications remain attached to each population. [13-18]','small')
p('Texas reports 10,018 residents in spring 2024, but does not explicitly separate students from possible dependents in that figure. This is a documented candidate, not an adopted student denominator. Stanford\'s 2025 population is adopted, but overseas count coverage does not extend consistently through 2025. A population alone does not repair missing counts. [10,11,13,19]','small')
h('Recovered and updated crime reports')
p('Original Merced, Harvard, Johns Hopkins and Virginia reports were recovered and independently checked. Harvard still has omitted geographic columns. The Hopkins report is titled 2025, says issued October 1, 2026, and tabulates 2023-2025; it was publicly linked before that printed issue date. Stanford\'s main-campus report advances to 2026 while overseas editions remain mixed. The latest Princeton report adds 2025; overlapping 2023-2024 values agree with its previous edition. [10-12]','small')

page('Resident-source follow-up: 26 September')
p('The follow-up verifies five further observations: four Yale housing censuses and one historical Stanford census. Together with the initial five additions, these records extend documented populations without changing any offense counts. [11,13,20,21]')
table(['Institution / period','Residents','Source scope'],[
('Yale, fall 2022','6,255','5,297 undergraduate + 958 graduate/professional students. [20]'),
('Yale, fall 2023','6,064','5,120 undergraduate + 944 graduate/professional students. [20]'),
('Yale, fall 2024','6,011','5,057 undergraduate + 954 graduate/professional students. [20]'),
('Yale, fall 2025','6,082','5,115 undergraduate + 967 graduate/professional students. [20]'),
('Stanford, autumn 2023','14,137','7,207 students in undergraduate housing + 6,930 in graduate housing; archived original university factbook. [21]'),
],[163,64,289],pad=7)
p('Yale explicitly counts students in university housing. Students residing with partners or dependents are a student classification; those columns do not add family members to the denominator. The source specifies fall of each academic year and records the summer 2024 closure of Helen Hadley Hall. Its housing properties are not independently matched to every Clery residential property. Current Yale offense tables end in 2024, so the 2025 population does not establish a 2025 rate. [11,13,20]')
p('Stanford\'s complete 2024 factbook was recovered from an archived capture of its official website. The downloaded Portable Document Format (PDF) file\'s digest matches the archive index, and the housing page was visually checked. This resolves the earlier indexed-only source limitation for autumn 2023. The university-provided housing footprint retains the same geographic qualification as the 2024 and 2025 observations. [13,21]')
h('Documented evidence beyond adopted totals')
p('Partial populations, approximate figures and unresolved population definitions remain useful context. They are retained in a separate evidence ledger and do not enter the exact resident denominators. A missing adopted denominator means that this study has not verified a compatible total; it does not establish that no housing figure is publicly available. [13,22]')
p(link('https://www.boomerrawlings.com/data-analysis/campus-safety/current-2026-09-25/resident_evidence.json','Resident evidence and outstanding qualifications'),'small')

page('Housing comparison and updated results')
p(f'2024 institutional residential-facility counts divided by documented residents. All {resident_2024} institutions with an adopted population remain visible when a selected count is unavailable. Ratios are approximate geographic normalizations, not resident victimization rates. [3,10,11,13]')
rows=[]
for inst in data['institutions']:
    y=next(y for y in inst['years'] if y['year']==2024)
    if y['residents']:
        c=y['counts']['residential'];pop=y['residents']
        rows.append([('UC Los Angeles' if inst['name']=='UCLA' else inst['name']),number(pop),number(c['criminal_total']),rate(1000*c['criminal_total']/pop if c['criminal_total'] is not None else None),number(c['rape']),rate(1000*c['rape']/pop if c['rape'] is not None else None)])
table(['Institution','Residents','Criminal offenses','Per 1,000','Rape offenses','Per 1,000'],rows,[152,75,75,70,74,70])
h('Housing rape reports by year and source edition')
rows=[]
for period in [2022,2023,2024,'pooled']:
    u=next(r for r in cases if r['unitid']=='110680' and r['period']==period);s=next(r for r in cases if r['unitid']=='122409' and r['period']==period)
    rows.append(['2022-24 pooled' if period=='pooled' else period,f'{u["asr_housing_rape_count"]} / {u["fall_occupancy_sum"]:,}',rate(u['rate_per_1000']),f'{s["asr_housing_rape_count"]} / {s["fall_occupancy_sum"]:,}',rate(s['rate_per_1000'])])
table(['Period','UC San Diego count / residents','Per 1,000','SDSU main count / residents','Per 1,000'],rows,[89,140,64,149,74])
p('SDSU 2022 uses its 2025 report; 2023-2024 use its current 2026 report. The revised 2023 housing count raises the pooled numerator from 17 to 18 and the ratio from 0.70 to 0.74. UC San Diego remains 43 / 58,719 = 0.73. Similar pooled ratios do not establish equivalent underlying safety. [1-4]','small')

page('Geography, revisions and source conflicts')
p('The geographic explorer separates campus housing, other campus locations, campus total, noncampus property and qualifying public property. Campus housing is a subset, not a fourth additive area. Ordinary off-campus community crime remains outside these reporting boundaries. [5]')
table(['Source issue','Treatment in this revision'],[
('Historical revisions','Use the named current source cell; preserve older federal and institutional versions. Do not attribute a difference to a cause unless a source explains it.'),
('UC Davis / Santa Cruz corrections','Retain revised count cells and their footnotes. Repeated incidents disclosed in one report remain offenses, not inferred unique victims.'),
('Combined domestic/dating categories','Withhold separate-category comparisons where the source combines categories. Printed zero does not establish no dating-related violence.'),
('Conflicting years or totals','Retain raw cells and source locators. Withhold ambiguous cells; retain an unambiguous geographic subset only with documented source evidence.'),
('Missing geographic columns','Unknown is not zero. Only explicit absent-geography declarations support structural zero contributions to a total.'),
('New or changed branches','Keep source-specific branch identities and opening/scope notes. Do not silently allocate an institution-wide population to a branch.'),
('Unusable outside-agency returns','Florida Everglades and Vicenza 2025 lack usable local-agency data; affected comparisons are withheld.'),
('Recovered sources','Merced, Harvard, Johns Hopkins and Virginia PDF reports are now verified. Omitted columns, incomplete outside-agency returns and source conflicts still limit calculations.'),
],[157,359],pad=7)
p('Detailed qualifications and every exclusion are recorded in the institutional inventory and cell ledger. The original federal snapshot remains available for reproducibility; it is not presented as the newest institutional account. Missing and withheld values must not be used to rank institutions. [10-12]')

for part in range(3):
    page(f'Institutional source inventory ({part+1}/3)')
    p('Official annual-report links are clickable. Source editions can differ among branches. Data years are the years actually extracted, not an assertion of complete institutional coverage. Exact hashes, Coordinated Universal Time (UTC) retrieval times and exclusions appear in the online ledger. [10,11]','small')
    rows=[]
    for item in inventory[part*14:(part+1)*14]:
        status='Extracted; source exclusions apply' if item['source_cells'] else 'Current counts unverified'
        rows.append([link(item.get('report_url') or item['landing_url'],item['institution']),escape(', '.join('Unverified' if e in ('None','unverified') else e for e in item['editions'])),escape(', '.join(map(str,item['report_years'])) or 'Unverified'),status])
    table(['Institution / official report','Edition','Extracted years','Verification'],rows,[202,55,95,164],pad=7,markup=True)
    p('A dated resident population does not establish a complete corresponding offense numerator. Report access is not proof of complete reporting; sources may change after the recorded audit cutoff.','small')

page('Interpretation, related research and verification')
h('Administrative reporting is not prevalence')
p('Higher recorded rates can reflect offending, disclosure, property boundaries, record conventions or a combination. A small or zero count does not establish absence of victimization. This purposive cohort is not a representative national sample; no safest-campus ranking, causal estimate or significance test is supplied.')
h('Comparisons with related research')
p('The National Center for Education Statistics (NCES) normalizes national campus counts by full-time-equivalent enrollment, per 10,000 students. This study uses enrolled headcount or documented residents. Changing the numerical scale does not reconcile those denominators. [8]')
p('The Bureau of Justice Statistics Campus Climate Survey Validation Study compares survey and Clery measures across nine pilot campuses. Survey recall periods, populations and disclosures differ from administrative reports. Alignment matters before comparing them; neither source supplies a universal underreporting adjustment. The original targeted research review remains available and is not relabeled as a new systematic review. [9,12]')
h('Audit structure')
p('Source checks record exact downloaded versions, table headers, geography, raw tokens and footnotes. Alternate extraction engines and independent calculation reviews check category mappings, missingness, sums, population joins and rate calculations. The recovered Virginia PDF agrees with all 1,008 previously transcribed core cells; its visual verification is now complete. The source and citation audit is separate from formula/layout verification. [10-12]')
p('The public package preserves source-derived aggregate cells, dated inventory, normalization decisions, calculations and replay code. It does not include individual victim records. Source re-extraction requires the exact original reports, identified by web address and hash where retrieved; a mutable web address alone does not identify a fixed version.')
h('Material limitations')
p('Reporting completeness is unknown. Housing properties are not fully matched to population boundaries; dated snapshots are not person-time; nonstudents may be included; multiple offenses can be disclosed together; branches and source editions differ. Most institutions lack adopted resident populations, especially for 2025. The federal and institutional series remain separate selectable sources, not interchangeable estimates. [10,11,13]')
p('These checks are computational and source-verification audits. They are not external human peer review or agency certification. Publication states what was verified and leaves unresolved values unavailable. [12]')

page('References and reproducibility')
for i,(label,url) in enumerate(REFS,1):p(f'<b>[{i}]</b> '+link(url,label),'small')
p(link('https://nces.ed.gov/ipeds/use-the-data/download-access-database','[6a] IPEDS complete files and data dictionaries.')+' '+link('https://boomerrawlings.com/data-analysis/campus-safety/data/enrollment_denominators.csv','Source-derived fall enrollment denominator records, 2022-2024.'),'small')
h('Version record')
p('Resident-source revision: 26 September 2026; offense inventory remains the 25 September audit. SDSU current report Secure Hash Algorithm 256-bit (SHA-256) checksum: 8d697b9134573a07dd7d53a0db29c18f8fe3a5b97e026fb8221237766155c80b. The original report remains archived and contains superseded SDSU pooled figures. Current calculation tables and the source ledger govern this revision.','small')
campus=build(OUT/'campus-safety-current-report.pdf','Campus safety: current sources')

if args.campus_only:
    crime_path=OUT/'crime-and-heat-source-refresh.pdf'
    previous=json.loads((OUT/'current_reports_metadata.json').read_text(encoding='utf8'))
    crime={'file':crime_path.name,'pages':len(PdfReader(crime_path).pages),'bytes':crime_path.stat().st_size,'sha256':hashlib.sha256(crime_path.read_bytes()).hexdigest()}
    assert crime == previous['crime'], 'Existing Crime PDF differs from its recorded metadata; investigate before updating metadata.'
    (OUT/'current_reports_metadata.json').write_text(json.dumps({'campus':campus,'crime':crime},indent=2)+'\n',encoding='utf8')
    print(json.dumps({'campus':campus,'crime':crime,'crime_preserved':True},indent=2))
    raise SystemExit(0)

story=[]
FBASE='https://boomerrawlings.com/data-analysis/crime-and-heat/data/freshness-2026-09-25/'
p('CRIME AND HEAT / SOURCE-REFRESH SUPPLEMENT','small')
p('Source currency<br/>and reporting coverage','title')
p('25 September 2026. A dated audit of upstream data versions and a refreshed descriptive supplement. No heat-association model has been refitted.')
h('What changed')
p('The San Diego Police Department (SDPD) partial 2026 offense file increased from <b>56,793 to 57,037 records: a net addition of 244</b>. It now contains occurrence dates through 24 September. Of the increase, 95 records belong to the added 24 September date and a net 149 revise 26 earlier dates. Two daily totals decreased. This is a mutable administrative series, not simply a daily append. '+link('https://data.sandiego.gov/datasets/police-nibrs/','[1]'))
table(['Source','Freshness finding'],[
('California Department of Justice','Five retained data/context files unchanged; current catalog still covers through 2025. Reporting-gap qualifications remain.'),
('San Diego Association of Governments','Fourteen aggregate/dictionary responses unchanged. Retained scientific metadata fields unchanged despite four raw metadata hash differences.'),
('SDPD','2020-2025 files unchanged. Partial 2026 source revised to 57,037 records; refreshed daily and monthly aggregates reconcile to that total.'),
('National Oceanic and Atmospheric Administration','Sixteen daily files changed; checked 1991-2025 and 2021-2024 records unchanged. Sixty hourly archive files unchanged.'),
('Census','The retained 2020 population table unchanged. These remain 2020 counts, not current estimates.'),
('Sheriff / Open-Meteo','Sheriff direct listings blocked; latest indexed report contents unverified. Open-Meteo documentation checked; full reanalysis responses not reacquired.'),
],[159,357],pad=7)
p('Request log: 133 web resources, 131 responses and two access failures. A successful response is not proof of complete data coverage. Exact web addresses, Coordinated Universal Time (UTC) timestamps, response hashes and comparison scopes are public. '+link(FBASE+'FRESHNESS_AUDIT.md','[2: full audit]'),'small')

page('Interpretation and reproducible outputs')
h('The refreshed file is a separate outcome')
p('SDPD offense records are not Sheriff arrest records, unique victims or domestic-violence cases. Its documented schema has no explicit domestic-violence flag. The refresh extends contextual aggregate material; it does not extend the user-supplied arrest export or repair its unknown reporting gaps. Partial 2026 is excluded from the existing fitted study.')
h('Statistical conclusions remain versioned')
p('The fitted civil-day maximum-temperature results in the corrected 64-postal-area reference analysis (63 fitted postal areas for domestic violence) are unchanged: general eligible arrest-record groups, +1.91% per 10 degrees Fahrenheit (p = 0.05287); domestic-violence groups, +2.74% (p = 0.17903). Neither primary test meets a 0.05 threshold. These estimates do not establish no association or a causal effect. The fixed sensitivity battery has no test below 0.05 after Holm adjustment. '+link('https://boomerrawlings.com/writing/data-analysis/crime-and-heat/#methods','[3: study methods and results]'))
p('Historical National Oceanic and Atmospheric Administration checks do not certify unchanged Open-Meteo reanalysis values: the complete reanalysis panel was not downloaded again, and previously quota-limited locations remain unresolved. No new data correction, extrapolation or effect model is implied.')
h('Aggregate reconciliation and privacy')
p('The refreshed release contains 1,335 daily group/category cells and 416 monthly offense cells; each aggregation reconciles to 57,037 source rows. Distinct case counts are cell-specific and must not be summed as unique cases across cells. Record-level source bytes were processed in memory; published outputs exclude case identifiers, addresses and coordinates.')
p('A second source retrieval matched the audited 2026 file hash. The public allowlist contains the aggregate comma-separated values (CSV) and JavaScript Object Notation (JSON) files, provenance and checking code. Live refreshes are new audits because upstream data change. Offline checks validate the saved reconciliation. '+link(FBASE+'PUBLIC_FILES.json','[4: explicit file allowlist]'))
h('Sources and remaining limits')
p(link('https://seshat.datasd.org/police_nibrs/pd_nibrs_2026_datasd.csv','[1] SDPD 2026 source data file')+'; response Secure Hash Algorithm 256-bit (SHA-256) checksum 465589d9a9f809924014601759a6b9a29c413fcc76978358554c93db93898230. Retrieved 25 September 2026; Last-Modified 14:07:44 Greenwich Mean Time.','small')
p(link(FBASE+'FRESHNESS_AUDIT.md','[2] Source-by-source audit: official links, reporting limitations and exact comparison windows.')+' '+link(FBASE+'freshness_results.json','Machine-readable request and hash record.'),'small')
p(link('https://boomerrawlings.com/writing/data-analysis/crime-and-heat/','[3] Crime and Heat study: versioned models, source expansion and methods.')+' '+link(FBASE+'offline_verification.json','[4] Offline aggregate verification.'),'small')
p('The supplied arrest data remain incompletely characterized by the agency. Direct Sheriff access failures prevent certification of its latest monthly series. This supplement reports verified retrieval results and gaps; it does not claim absolute completeness or external peer review.','small')
crime=build(OUT/'crime-and-heat-source-refresh.pdf','Crime and heat: source refresh')
(OUT/'current_reports_metadata.json').write_text(json.dumps({'campus':campus,'crime':crime},indent=2)+'\n')
print(json.dumps({'campus':campus,'crime':crime},indent=2))
