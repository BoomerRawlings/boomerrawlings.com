"""Evidence whitelist; N/A alone never establishes structural absence."""
from pathlib import Path
import json,re,csv
ROOT=Path(__file__).parent
META=[json.loads(p.read_text(encoding='utf-8')) for p in ROOT.glob('retrieved/*/*.metadata.json')]
rules=[]
def add(key,stem,campus,geo,years,page,reason,status='not_applicable_no_geography'):
 m=next(m for m in META if m['key']==key and Path(m.get('local_pdf','')).stem==stem)
 rules.append(dict(campus_id=campus,geography=geo,years=years,status=status,source_url=m['url']+f'#page={page}',pdf_page=page,reason=reason,source_sha256=m['sha256']))
# CMU's five branch descriptions expressly state no university student housing.
for suffix,page,reason in [('003',54,'Qatar students use housing owned and operated by Qatar Foundation; CMU expressly does not provide housing there.'),('006',59,'CMU expressly does not provide housing for the Los Angeles MEIM program.'),('004',62,'CMU expressly does not provide housing at Silicon Valley.'),('005',65,'CMU expressly does not provide housing to MSCF New York students.'),('007',68,'CMU-Africa expressly has no student housing.')]:add('cmu','asr-7c2a7ceb','211440'+suffix,'residential',[2023,2024,2025],page,reason)
# Georgetown geography-specific footnotes, not inference from N/A cell patterns.
for suffix,page,geos,years,reason in [('002',50,['noncampus'],[2023,2024,2025],'Footnote16: no noncampus properties associated with Capitol Campus.'),('007',52,['residential','noncampus'],[2023,2024,2025],'Footnotes20/22: no on-campus housing or noncampus properties; SCS closed August2025.'),('005',54,['noncampus'],[2023,2024,2025],'Footnote25: no noncampus properties associated with Qatar campus.'),('003',56,['residential'],[2024,2025],'Footnote28 expressly states students were not housed on campus in2024 or2025.'),('006',58,['residential','noncampus'],[2023,2024,2025],'Footnotes31/33: no on-campus housing or noncampus properties at London location.'),('asr2026-dubai',60,['residential'],[2023,2024,2025],'Footnote35: no on-campus housing at Dubai location. Other2023 values remain unreported: opened September2023, no full reporting year.'),('asr2026-jakarta',62,['residential','noncampus'],[2025],'Footnotes38/40: no on-campus housing or noncampus properties at Jakarta location.')]:
 campus='131496'+suffix if suffix.isdigit() else '131496-'+suffix
 for geo in geos:add('georgetown','static-asr-fe95d159',campus,geo,years,page,reason)
for geo in ['residential','oncampus','noncampus','publicproperty']:add('georgetown','static-asr-fe95d159','131496-asr2026-jakarta',geo,[2023,2024],62,'Footnote37: Jakarta opened January2025; no statistics provided for2023–24. Not an observed zero.',status='not_applicable_before_opening')
# NYU table footnotes expressly identify geography absent from each branch.
for suffix,page,geos,reason in [('027',55,['residential','noncampus'],'Kips Bay has no residence halls or noncampus locations.'),('028',56,['residential','noncampus'],'Midtown Center has no residence halls or noncampus locations. This does not resolve its2022 on-campus/public-property N/A.'),('029',57,['residential','noncampus'],'Upper East Side has no residence halls or noncampus locations.'),('004',58,['residential'],'Accra has no on-campus residence halls.'),('009',59,['residential'],'Berlin Academic Center has no residence halls.'),('026',60,['residential'],'Berlin St. Agnes has no on-campus residence halls.'),('012',61,['residential'],'Buenos Aires has no on-campus residence halls.'),('005',63,['residential'],'London has no on-campus residence halls.'),('024',64,['residential'],'Los Angeles has no on-campus residence halls.'),('006',65,['residential'],'Madrid has no on-campus residence halls.'),('007',66,['residential'],'Paris has no on-campus residence halls.'),('008',67,['residential'],'Prague has no on-campus residence halls.'),('017',68,['noncampus'],'Sydney has no noncampus locations.'),('018',71,['noncampus'],'Washington DC has no noncampus locations.'),('033',72,['residential'],'Athens has no on-campus residence halls.'),('031',73,['residential','noncampus'],'Westchester has no residence halls or noncampus locations.'),('034',74,['residential','noncampus'],'Rockland has no residence halls or noncampus locations.')]:
 for geo in geos:add('nyu','asr-b478978b','193900'+suffix,geo,[2022,2023,2024],page,'Table footnote: '+reason)
add('nyu','asr-7870c798','193900016','noncampus',[2022,2023,2024],24,'Abu Dhabi table footnote: campus has no noncampus locations.')
add('nyu','asr-c91a3c0e','193900013','residential',[2022,2023,2024],27,'Shanghai table footnote: campus has no on-campus residence halls.')
add('nyu','asr-cd2271cc','193900025','residential',[2022,2023,2024],29,'Langone Hospital-Brooklyn table footnote: campus has no residence halls.')
for geo in ['residential','oncampus','noncampus','publicproperty']:add('nyu','asr-b478978b','193900-asr2025-tulsa',geo,[2022,2023,2024],70,'Table footnote: Tulsa opened January2025 and crime data unavailable for previous years. Not an observed zero.',status='not_applicable_before_opening')
assert len({(r['campus_id'],r['geography'],y) for r in rules for y in r['years']})==sum(len(r['years']) for r in rules)
(ROOT/'structural_geography_rules.json').write_text(json.dumps(rules,indent=2)+'\n')
notes={
 'do_not_treat_as_structural_zero':[
 {'campus_ids':['182670001','182670002'],'years':[2022,2023,2024],'category':'dating_violence','geographies':['residential','oncampus','noncampus','publicproperty'],'reason':'Dartmouth table label explicitly says dating violence included within domestic violence. N/A represents category aggregation, not absent geography. Domestic-violence category is combined in this source.'},
 {'campus_ids':['190150007','190150008'],'years':[2022,2023],'reason':'Columbia footnote1 onPDF56/59 says Baker Athletics and Paris statistics included in Morningside NONCAMPUS counts in2022/23; separate campus reporting begins2024. Geographic reclassification, not absent data or zero. Institution combined all-geography total may be nonduplicated with explicit source mapping, but branch/oncampus trends not comparable without qualification.'},
 {'campus_ids':['131496-asr2026-dubai'],'years':[2023],'reason':'Opened September2023; source declines to report partial year. Cannot code entire2023 as before opening; on/non/public remain unreported.'},
 {'campus_ids':['193900028'],'years':[2022],'reason':'Midtown oncampus/publicN/A without verified openingdate. Preserve unknown.'}],
 'geography_rules':len(rules),'rule_year_combinations':sum(len(r['years']) for r in rules),
 'interpretation':'Rules preserve rawN/A and blank counts. Structural absence permits exclusion from a compatible institution geographic sum, not an observed zero or resident population; before-opening branch rates unavailable.'}
(ROOT/'na_scope_interpretations.json').write_text(json.dumps(notes,indent=2)+'\n')
print(json.dumps({'rules':len(rules),'rule_year_combinations':sum(len(r['years']) for r in rules)}))
