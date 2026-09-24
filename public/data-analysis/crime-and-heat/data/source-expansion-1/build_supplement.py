"""Build a source-validation supplement without modifying any fitted model."""
from pathlib import Path
import csv, json, html
import reportlab
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.pagesizes import letter

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'output/pdf';OUT.mkdir(parents=True,exist_ok=True)
read=lambda path:json.loads((ROOT/path).read_text(encoding='utf-8'))
audit=read('independent_validation.json');assert audit['status']=='PASS'
weather=read('weather/comparison_summary.json')
assert weather['ghcn_downloaded_stations']==29 and weather['isd_downloaded_stations']==12
sources=[
 {'name':'California DOJ','coverage':'County arrests: 1980–2025. Agency DV-call reports: 2001–2025.','interpretation':'Annual arrest/citation totals and monthly DV reports are separate benchmarks. Documented Sheriff reporting gaps; county totals include multiple agencies.','documentation':'doj/DOJ_BENCHMARKS.md'},
 {'name':'SANDAG / ARJIS CIBRS','coverage':'2021–23 September 2026; agency-specific endpoints vary.','interpretation':'Group A supplies an explicit DV indicator. Group B DV values are all missing. Public releases are described as samples; coverage is not certified.','documentation':'local/README.md'},
 {'name':'San Diego Police NIBRS','coverage':'2020–23 September 2026.','interpretation':'Daily reported offense counts for a different jurisdiction. Distinct offense identifiers are reconciled; incident counts cannot be summed across offense categories.','documentation':'local/README.md'},
 {'name':'SANDAG historical DV series','coverage':'37 annual values, 1986–2022.','interpretation':'The actual downloaded years differ from the chart title. Historical context only; do not splice to modern incident data or use annual totals for daily heat inference.','documentation':'local/README.md'},
 {'name':'NOAA daily stations','coverage':'29 stations; 1991–2025 archive extract.','interpretation':'25 stations meet the 2021–2024 maximum-temperature coverage rule. Six support a 1991–2020 warm-season baseline. Observation days differ from civil days.','documentation':'weather/README.md'},
 {'name':'NOAA subdaily observations','coverage':'12 stations; 2021–2024.','interpretation':'379,574 accepted hourly samples; 13,235 complete station-days. High and low are sampled extrema; means require every civil hour.','documentation':'weather/README.md'},
 {'name':'Census municipal context','coverage':'2020 population for nine Sheriff contract cities.','interpretation':'Population context only. Ambiguous recorded localities and agency coverage prevent municipal arrest-risk denominators.','documentation':'context/GEOGRAPHIC_CONTEXT.md'},
]
inventory={'version':'source-expansion-1','retrieval_date':'2026-09-24','new_effect_models':0,'prior_results_preserved':True,'sources':sources,
 'verified_counts':{'doj_arrest_years':46,'doj_dv_years':25,'doj_dv_agency_months':8038,'sandag_a_source_rows':791760,'sandag_a_agency_scoped_incidents':624649,'sandag_a_dv_flagged_incidents':66681,'sandag_b_rows':112170,'sdpd_offense_rows':549408,'historical_dv_years':37,'ghcn_stations':29,'isd_stations':12,'isd_accepted_hours':379574,'isd_complete_station_days':13235}}
assert sum(audit['checks'][f'sdpd_{y}']['source_rows'] for y in range(2020,2027))==549408
assert audit['checks']['isd']['complete_station_civil_days']==13235
(ROOT/'source_inventory.json').write_text(json.dumps(inventory,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')

md='''# Independent sources for the crime-and-heat study

Source-validation supplement, 24 September 2026. This adds official data, source documentation and independent checks. The published arrest-record coefficients, p-values and existing PDF remain unchanged. No additional effect model is estimated.

## Material reporting evidence

California DOJ identifies incomplete San Diego County Sheriff submissions for **November–December 2024 and January–June 2025**, in both its arrest and DV-call documentation. The primary analyses exclude 2025 but retain the flagged late-2024 interval. This raises a further interpretation limit. It does not establish the supplied export's exact missing records, reporting mechanism or completeness percentage. A reporting entity's row may exist even when its submission is incomplete. The retained original release also includes an explicitly exploratory July–December 2025 DV model; it is not a primary result.

Sources: [DOJ arrest context, p. 7](https://data-openjustice.doj.ca.gov/sites/default/files/dataset/2026-07/Arrests%20Context_0615026.pdf#page=7), [DOJ DV context, p. 5](https://data-openjustice.doj.ca.gov/sites/default/files/dataset/2026-07/Domestic%20Violence%20Related%20Calls%20for%20Service%20Context_06222026.pdf#page=5). See the [DOJ source audit](doj/DOJ_BENCHMARKS.md) for exact scope and separately named contract-city entities.

## Acquired sources

| Source | Coverage | Use and limitation |
|---|---|---|
'''
for s in sources:md+=f"| [{s['name']}]({s['documentation']}) | {s['coverage']} | {s['interpretation']} |\n"
md+='''
## What the acquisition establishes

The public SANDAG Group A snapshot contains 791,760 rows representing 624,649 agency-scoped incident identifiers, including 66,681 DV-flagged incidents. The Sheriff subset contains 133,003 incidents, including 15,513 DV-flagged incidents, through 22 September 2026. These are reported-incident identifiers, not independently verified occurrences, unique victims or the study's arrest groups. DV classification is an officer-recorded indicator in this source and is not equivalent to the original charge-code screen. Group B's DV column is entirely null: it cannot furnish a DV-arrest series. SDPD's seven annual offense files contribute 549,408 rows; daily and monthly aggregates reconcile. Its CAD release excludes DV and other sensitive calls, so it cannot validate DV completeness. [Local source audit](local/README.md).

For weather, 25 of the 29 downloaded daily stations meet the 90% primary-period maximum-temperature coverage criterion. The specified nearest-station rule, followed by distance and elevation restrictions, matches 94 of 112 ZIPs and 136,243 ZIP-days. Within the corrected 64-ZIP subset, 54 ZIPs have daily-station matches. The six stations qualifying for a 1991–2020 May–September baseline support exploratory 90th/95th-percentile thresholds, not official heat alerts or calendar-day percentiles. This baseline predates the primary 2021–2024 model period, while overlapping the descriptive 2018–2020 records. [Weather source audit](weather/README.md).

Subdaily observations provide a separate civil-day check: 12 stations, 379,574 quality-accepted hourly samples and 13,235 complete station-days. Five stations meet the 90% complete-day criterion used for spatial matching. High/low are hourly sampled extrema; mean is the arithmetic mean of the selected hourly samples. These are not continuous measured extrema or a high/low midpoint. Missing hours remain visible; incomplete days do not receive primary summary temperatures. Independent code recomputes all complete daily summaries and daylight-saving boundaries. [Independent checks](independent_validation.json).

The source expansion does not replace unavailable reanalysis ZIPs with station values inside the existing model panel. Measurement method, station coverage and observation-day conventions remain explicit. Pooled weather differences reuse stations across ZIPs and are descriptive; they are not independent replicate observations.

## Geographic interpretation and prior research

The [municipal context audit](context/GEOGRAPHIC_CONTEXT.md) confirms similar 2020 populations in Vista (98,381) and San Marcos (94,833). Their recorded totals cannot be converted to municipal risk without resolving geographic and agency coverage. This source review does not establish why Vista's supplied count is larger.

The [primary research review](RESEARCH_CONTEXT.md) distinguishes published studies of daily crime, DV calls, heat waves and survey-reported victimization. Positive associations in other studies neither invalidate the local inconclusive estimate nor repair local missingness. This is a targeted source review, not a systematic review.

## Verification, reproduction and remaining work

`independent_validation.json` separately reconciles SANDAG partitions, SDPD daily/monthly totals, DOJ monthly/annual sums, reporting flags, station quality rules and every complete ISD daily temperature summary. Source-specific checks supply additional coverage, duplicate-key and anomaly audits. `publication_validation.json` verifies packaged hashes, aggregate-only crime fields and preservation of all 166 prior artifacts. Source completeness itself cannot be verified from these checks.

The archive retains separate source folders, processing scripts, portable comparison inputs and retrieval hashes. DOI/source links lead to the original documentation. Large raw station archives and statewide DOJ bulk files remain available upstream; acquisition scripts verify the frozen source hashes. The local crime snapshot is a live public release: new retrievals may change. See each folder's reproduction instructions before rerunning acquisition. No personal names, case identifiers, exact incident addresses or raw arrest records are included.

Further outcome models require a frozen counting unit, date and geographic definitions, source-completeness exclusions, lag/heat-wave hypotheses and multiplicity family. A reporting-gap sensitivity should omit November–December 2024 and report its result regardless of significance. It would assess dependence on those months, not prove the remaining records complete. The source dictionary and agency export crosswalk remain unavailable; no new agency request or email was sent.
'''
(ROOT/'SOURCE_EXPANSION.md').write_text(md,encoding='utf-8')

fonts=Path(reportlab.__file__).parent/'fonts'
pdfmetrics.registerFont(TTFont('Vera',str(fonts/'Vera.ttf')))
pdfmetrics.registerFont(TTFont('VeraBold',str(fonts/'VeraBd.ttf')))
pdfmetrics.registerFontFamily('Vera',normal='Vera',bold='VeraBold',italic='Vera',boldItalic='VeraBold')
ink=colors.HexColor('#172F3B');muted=colors.HexColor('#52616B');line=colors.HexColor('#CCD4D7')
styles={
 'title':ParagraphStyle('title',fontName='VeraBold',fontSize=23,leading=29,textColor=ink,spaceAfter=15),
 'h':ParagraphStyle('h',fontName='VeraBold',fontSize=13,leading=18,textColor=ink,spaceBefore=13,spaceAfter=8),
 'body':ParagraphStyle('body',fontName='Vera',fontSize=9.6,leading=14.6,textColor=ink,spaceAfter=10),
 'small':ParagraphStyle('small',fontName='Vera',fontSize=8,leading=11.3,textColor=muted,spaceAfter=7),
 'cell':ParagraphStyle('cell',fontName='Vera',fontSize=8.4,leading=12,textColor=ink),
}
story=[]
def p(text,style='body'):story.append(Paragraph(text,styles[style]))
def link(label,url):return f'<link href="{html.escape(url,quote=True)}" color="#165D77">{html.escape(label)}</link>'
def table(headers,data,widths):
    cells=[[Paragraph(f'<b>{html.escape(v)}</b>',styles['cell']) for v in headers]]+[[Paragraph(v,styles['cell']) for v in row] for row in data]
    t=Table(cells,colWidths=widths,repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#EDF1F2')),('LINEBELOW',(0,0),(-1,0),.8,ink),('LINEBELOW',(0,1),(-1,-1),.35,line),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
    story.append(t);story.append(Spacer(1,10))

p('Crime and heat<br/>Source-validation supplement','title')
p('San Diego area | 24 September 2026','small')
p('Independent administrative benchmarks, reported-offense data and observed weather extend the material available for this study. This supplement documents new evidence and its limits. It accompanies the published analysis and domestic-violence report; it does not replace their fitted estimates.')
p('A documented reporting gap','h')
p('California DOJ flags incomplete San Diego County Sheriff reporting for <b>November-December 2024 and January-June 2025</b> in both its arrest and DV-call datasets. The primary analyses exclude 2025 but retain the two flagged 2024 months. Their interpretation therefore requires this additional reporting qualification. The original release retains a separately labeled exploratory July-December 2025 DV model. [1, 2]')
p('The notice establishes incomplete DOJ submissions. It does not identify the supplied export\'s missing rows, explain the reporting mechanism or establish a completeness percentage. The Sheriff-named reporting entity is also distinct from separately listed contract-city entities. Their operational overlap requires clarification.')
p('Why row presence is insufficient','h')
p('The Sheriff-named DV series has a row in every month of 2025 despite the official qualification. January-May contain 8, 8, 10, 6 and 12 reported calls. These values cannot be interpreted as complete activity or substituted for daily arrest counts. Calls resulting in agency reports include situations both with and without arrest. [2]')
p('Implication for the analysis','h')
p('A retrospective sensitivity excluding November-December 2024 could assess dependence on that interval. It must be specified and reported independently of whether its result crosses 0.05. Such a comparison would not recover missing records or establish completeness in earlier months. No new effect model is fitted in this source-acquisition update.')
p('Source detail: '+link('DOJ benchmark audit','https://boomerrawlings.com/data-analysis/crime-and-heat/data/source-expansion-1/doj/DOJ_BENCHMARKS.md'),'small')
story.append(PageBreak())
p('Additional outcome data','title')
table(['Source','Acquired material','Interpretation'],[
 ['California DOJ','1980-2025 county arrest/citation totals.<br/>2001-2025 agency-month DV reports.','46 arrest years; 8,038 San Diego DV agency-month rows. Different units; reporting qualifications retained.'],
 ['SANDAG / ARJIS','Group A and B public CIBRS snapshots, 2021-September 2026.','Group A: 624,649 agency-scoped incidents, including 66,681 DV-flagged incidents. Public-release completeness unverified.'],
 ['San Diego Police','Seven annual NIBRS files, 2020-September 2026.','549,408 reported offense rows. Different agency population from the supplied Sheriff-labeled exports.'],
 ['SANDAG historical DV [11]','37 annual values, 1986-2022.','Downloaded years differ from the chart title. Historical context; no daily heat inference.'],
 ],[102,165,237])
p('Counting rules matter','h')
p('SANDAG Group A uses a recorded DV indicator. This is broader in concept than selecting particular arrest-charge codes; it does not establish an arrest, unique victim or independently verified offense. The Sheriff subset contains 133,003 incident identifiers, including 15,513 DV-flagged identifiers, through 22 September 2026. Agency-specific date coverage varies. [3]')
p('Group B has 112,170 rows, but its DV field is missing throughout the acquired snapshot. It cannot support a DV-arrest outcome. An incident can recur across arrest dates, so daily incident counts in Group B must not be summed as unique full-period incidents. [3]')
p('SDPD supplies documented offense identifiers and occurrence dates. Distinct offenses reconcile across daily and monthly aggregates; case counts can overlap across offense categories. Its public CAD data exclude DV and other sensitive calls. A source with that exclusion cannot verify DV-call completeness. [4]')
p('Neither continuous dates nor successful arithmetic reconciliation proves complete reporting. The 2026 files cover a partial year and remain subject to revision. Calls, offense records, arrest/citation totals and supplied source-ID groups remain separate series.')
story.append(PageBreak())
p('Observed weather and geography','title')
table(['Network','Acquisition and usable coverage'],[
 ['NOAA daily / GHCN','29 station archives; 1991-2025 extract. 25 stations satisfy at least 90% valid daily-maximum coverage during 2021-2024.'],
 ['NOAA subdaily / ISD','12 stations; 379,574 quality-accepted hourly samples during 2021-2024. 13,235 complete civil station-days; five stations satisfy the 90% complete-day spatial-matching rule.'],
 ['Historical baseline','Six stations meet the specified coverage criteria for May-September 1991-2020. Station-specific 90th/95th percentiles precede the primary 2021-2024 period.'],
 ],[130,374])
p('Daily maximum coverage','h')
p('Among eligible daily stations, the nearest station is selected before applying distance of at most 25 km and elevation difference of at most 200 m. The expanded network matches 94 of 112 ZIPs, yielding 136,243 paired ZIP-days. Within the corrected 64-ZIP sample, 54 ZIPs have matches. No second station is selected merely because the nearest fails the elevation rule. [5]')
p('Measurement distinctions','h')
p('GHCN maxima and minima follow station observation-day conventions. A reported daily average, where available, remains distinct from the high/low midpoint. ISD observations use their actual UTC timestamps and America/Los_Angeles civil dates. One accepted sample per hour defines sampled high, mean and low; incomplete civil days do not receive primary summary temperatures. Hourly extrema can miss short-lived peaks. [5, 6]')
p('The 1991-2020 thresholds describe warm-season station distributions, not calendar-day percentiles or official heat alerts. Different stations and model grids measure different spatial supports. Pooled ZIP comparisons reuse station observations and must not be treated as independent measurement replicates.')
p('Vista and San Marcos','h')
p('The 2020 Census records 98,381 residents in Vista and 94,833 in San Marcos. Population size alone does not explain the large difference in supplied totals. Both contract with the Sheriff, and station coverage includes nearby unincorporated areas. The ambiguous recorded locality cannot support a municipal crime-risk denominator. The cause of the difference remains unresolved. [7, 8]')
story.append(PageBreak())
p('Evidence, verification and sources','title')
p('Relationship to published research','h')
p('A New Orleans study reported higher odds of DV-related calls during sustained extreme heat; a Los Angeles study found neighborhood variation in heat-associated crime. These support further investigation. Different outcomes, exposure contrasts and climates prevent treating either as replication of this arrest-record study. A positive estimate elsewhere does not resolve local reporting uncertainty. [9, 10]')
p('Verification and remaining requirements','h')
p('Independent calculations reconcile local data partitions and DOJ monthly/annual totals, check quality flags and unique station-day keys, and reproduce every complete ISD daily high, mean and low. All 23-, 24- and 25-hour civil-day boundaries are checked. These tests validate processing, not source ascertainment. Retrieval URLs, hashes, source dictionaries, separate aggregate series and code accompany the release.')
p('Further models require explicit counting and geographic units, reporting exclusions, exposure definitions, lags and multiplicity rules before inspecting their estimates. The agency export dictionary and extraction crosswalk remain unavailable. No missing daily counts are imputed; no sources are pooled as equivalent crime events.')
p('References','h')
refs=[
 ('California DOJ. Arrests/Arrest Dispositions context. Revised June 2026; p. 7.','https://data-openjustice.doj.ca.gov/sites/default/files/dataset/2026-07/Arrests%20Context_0615026.pdf#page=7'),
 ('California DOJ. Domestic Violence Related Calls for Service context. Revised June 2026; pp. 1, 5.','https://data-openjustice.doj.ca.gov/sites/default/files/dataset/2026-07/Domestic%20Violence%20Related%20Calls%20for%20Service%20Context_06222026.pdf#page=5'),
 ('SANDAG / ARJIS. Public CIBRS Group A. Dataset ID pr74-d3tr.','https://opendata.sandag.org/ARJIS/CIBRS-Group-A-Public-Crime-Data/pr74-d3tr'),
 ('City of San Diego. Police NIBRS offense data and source definitions.','https://data.sandiego.gov/datasets/police-nibrs/'),
 ('NOAA NCEI. Global Historical Climatology Network-Daily documentation.','https://www.ncei.noaa.gov/pub/data/ghcn/daily/readme.txt'),
 ('NOAA NCEI. Integrated Surface Database format and quality documentation.','https://www.ncei.noaa.gov/pub/data/noaa/isd-format-document.pdf'),
 ('U.S. Census Bureau. California incorporated places: 2020 Census population.','https://tigerweb.geo.census.gov/tigerwebmain/Files/acs26/tigerweb_acs26_incplace_2020_tab20_ca.html'),
 ('San Diego County Sheriff. Service jurisdictions and contract cities.','https://www.sdsheriff.gov/bureaus/about-us'),
 ('Dey AK et al. Extreme Heat and Calls to Law Enforcement Related to Domestic Violence. JAMA Netw Open. 2025;8:e2530530.','https://doi.org/10.1001/jamanetworkopen.2025.30530'),
 ('Heilmann K, Kahn ME, Tang CK. The urban crime and heat gradient in high and low poverty areas. J Public Econ. 2021;197:104408.','https://doi.org/10.1016/j.jpubeco.2021.104408'),
 ('SANDAG. Historical county domestic-violence table; acquired values 1986-2022.','https://opendata.sandag.org/resource/qbrv-e75t.json'),
]
for i,(title,url) in enumerate(refs,1):
    extra=''
    if i==3:extra=' '+link('Group B: huzf-mi2z.','https://opendata.sandag.org/ARJIS/CIBRS-Group-B-Public-Crime-Data/huzf-mi2z')
    if i==4:extra=' '+link('CAD exclusions.','https://data.sandiego.gov/datasets/police-calls-for-service/')
    p(f'{i}. '+link(title,url)+extra,'small')
p('Study and complete source audits: '+link('boomerrawlings.com/writing/data-analysis/crime-and-heat/','https://boomerrawlings.com/writing/data-analysis/crime-and-heat/'),'small')

def footer(canvas,doc):
    canvas.saveState();canvas.setStrokeColor(line);canvas.line(54,45,558,45)
    canvas.setFont('Vera',8);canvas.setFillColor(muted)
    canvas.drawString(54,30,'Crime and heat | Source-validation supplement | 24 September 2026')
    canvas.drawRightString(558,30,str(doc.page));canvas.restoreState()

doc=SimpleDocTemplate(str(OUT/'source-validation-supplement.pdf'),pagesize=letter,rightMargin=54,leftMargin=54,topMargin=47,bottomMargin=60,title='Crime and heat: source-validation supplement',author='Boomer Rawlings')
doc.build(story,onFirstPage=footer,onLaterPages=footer)
print(json.dumps({'pdf':str(OUT/'source-validation-supplement.pdf'),'sources':len(sources),'counts':inventory['verified_counts']}))
