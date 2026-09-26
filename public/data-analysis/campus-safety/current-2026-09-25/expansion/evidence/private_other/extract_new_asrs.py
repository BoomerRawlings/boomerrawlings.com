"""Extract the newly recovered Hopkins report and freshly linked Stanford main report.

Raw values stay separate from applicability/conflict judgments. No original dataset is edited.
"""
from pathlib import Path
from pypdf import PdfReader
import csv, hashlib, json, re, logging
logging.getLogger('pypdf').setLevel(logging.ERROR)

ROOT=Path(__file__).resolve().parent
FIELDS=['report_edition','report_year','institution_unitid','campus_id','campus','category','category_label','family','geography','count','raw_value','status','pdf_page','printed_page','source_line','source_url','source_sha256']
GEOS=['residential','oncampus','noncampus','publicproperty']
CATEGORIES=[('murder','Murder & Non-negligent Manslaughter'),('negligent_manslaughter','Manslaughter by Negligence'),('rape','Rape'),('fondling','Fondling'),('incest','Incest'),('statutory_rape','Statutory Rape'),('robbery','Robbery'),('aggravated_assault','Aggravated Assault'),('burglary','Burglary'),('motor_vehicle_theft','Motor Vehicle Theft'),('arson','Arson'),('domestic_violence','Domestic Violence'),('dating_violence','Dating Violence'),('stalking','Stalking')]
ROWS=[];CHECKS=[];NOTES=[]
def add(edition,unitid,campusid,campus,category,label,year,geo,value,raw,status,page,printed,line,url,sha):
    ROWS.append(dict(zip(FIELDS,[edition,year,unitid,campusid,campus,category,label,'vawa' if category in {'domestic_violence','dating_violence','stalking'} else 'criminal_offenses',geo,value,raw,status,page,printed,line,url+'#page='+str(page),sha])))

def hopkins():
    file=ROOT/'sources/hopkins/asr2025-browser.pdf';sha=hashlib.sha256(file.read_bytes()).hexdigest();doc=PdfReader(file)
    url='https://publicsafety.jhu.edu/assets/uploads/sites/9/2024/11/annual_report_securityfiresafety.pdf'
    # Exact federal identities verified against the archived campus roster; changed display names documented.
    tableinfo=[(60,'162928001','Homewood Campus',['oncampus','noncampus','publicproperty','total','residential']),
      (70,'162928011','Peabody Institute',['oncampus','noncampus','publicproperty','total','residential']),
      (78,'162928002','East Baltimore Campus (Johns Hopkins Medical Institutions)',['oncampus','noncampus','publicproperty','total','residential']),
      (85,'162928003','Harbor East Campus',['oncampus','publicproperty','total']),
      (90,'162928006','Applied Physics Laboratory',['oncampus','publicproperty','total']),
      (95,'162928007','Hopkins Bloomberg Center',['oncampus','noncampus','publicproperty','total']),
      (100,'162928009','SAIS Europe, Bologna',['oncampus','publicproperty','total']),
      (105,'162928012','Hopkins-Nanjing Center',['oncampus','publicproperty','total','residential']),
      (112,'162928015','Bayview Medical Center',['oncampus','publicproperty','total']),
      (115,'162928014','JHU Public Policy Center, Barcelona',['oncampus','publicproperty','total'])]
    explicit_no_noncampus={85,90,100}
    for page,campusid,campus,cols in tableinfo:
        text=doc.pages[page-1].extract_text();lines=text.splitlines()
        if 'residential' not in cols:
            assert 'no residence halls' in text, (campus,'missing no-housing evidence')
        if page in explicit_no_noncampus:assert 'non-campus buildings or property' in text
        for cat,label in CATEGORIES:
            start=next(i for i,l in enumerate(lines) if l.strip()==label)
            for offset,expected_year in enumerate([2025,2024,2023],1):
                tokens=lines[start+offset].split();assert tokens[0]==str(expected_year)
                assert len(tokens)==len(cols)+1 and all(re.fullmatch(r'\d+',x) for x in tokens)
                values=dict(zip(cols,map(int,tokens[1:])))
                total_ok=sum(values.get(g,0) for g in ['oncampus','noncampus','publicproperty'])==values['total']
                housing_ok=values.get('residential',0)<=values['oncampus']
                CHECKS.append({'institution':'hopkins','campus_id':campusid,'category':cat,'year':expected_year,'sum_matches_printed_total':total_ok,'housing_not_above_campus':housing_ok})
                for geo in GEOS:
                    if geo in values:
                        value=values[geo];raw=str(value);status='reported_numeric'
                        if not total_ok:status='source_total_conflict'
                        if not housing_ok and geo in ['oncampus','residential']:status='source_subset_conflict'
                        if page==115 and expected_year==2025:status='reported_numeric_external_response_incomplete'
                    else:
                        value='';raw='';status='not_reported_geography'
                        if geo=='residential':status='not_applicable_no_corresponding_geography'
                        if geo=='noncampus' and page in explicit_no_noncampus:status='not_applicable_no_corresponding_geography'
                    add(2025,'162928',campusid,campus,cat,label,expected_year,geo,value,raw,status,page,page-2,start+offset+1,url,sha)
    NOTES.append({'institution':'hopkins','edition':'Cover says 2025 Annual Security & Fire Safety Report; issued October 1, 2026; retrieved before printed issue date; numerical tables cover 2023–2025. Preserve both labels.',
      'structural_absence':'Commuter/no-residence-hall statement appears on each of pp85,90,95,100,112,115. Explicit no-noncampus statement only pp85,90,100. Other missing noncampus columns remain unknown.',
      'response_limitation':'Barcelona p115: UPF Security/Barcelona Police did not respond to request for 2025 statistics. Printed zeros preserved, qualified status, not confirmed absence.',
      'source_sha256':sha})

def stanford():
    file=ROOT/'sources/stanford/asr2026-3d6a6637.pdf';sha=hashlib.sha256(file.read_bytes()).hexdigest();doc=PdfReader(file)
    url='https://police.stanford.edu/pdf/ssfr-2026.pdf'
    pages={cat:103 for cat,_ in CATEGORIES};pages.update({c:104 for c in ['rape','fondling','incest','statutory_rape','domestic_violence','dating_violence','stalking']})
    aliases={'murder':'Murder / Non-Negligent','negligent_manslaughter':'Negligent Manslaughter','motor_vehicle_theft':'Theft- Motor Vehicles','rape':'Rape (including','statutory_rape':'Statutory Rape','dating_violence':'Dating Violence'}
    # Locate pages by actual headings, never by an assumed printed/PDF-page offset.
    found={}
    for index,page in enumerate(doc.pages):
        text=page.extract_text(extraction_mode='layout')
        if 'CRIMES REPORTED TO THE POLICE AND CAMPUS SECURITY' in text and '2023 - 2025' in text:found[103]=(index+1,text)
        if 'VAWA Crimes 2023 - 2025' in text:found[104]=(index+1,text)
    assert set(found)=={103,104},set(found)
    for cat,label in CATEGORIES:
        printed=pages[cat];page,text=found[printed];lines=text.splitlines();prefix=aliases.get(cat,label)
        # Murder wording uses slash in Stanford; assault capitalization matches its source.
        start=next(i for i,l in enumerate(lines) if l.strip().startswith(prefix))
        yearrows=[]
        for i in range(start,min(start+8,len(lines))):
            m=re.search(r'\b(202[345])\s+(\d+\S*)\s+(\d+\S*)\s+(\d+\S*)\s+(\d+)\s+(\d+)\s+(\d+)\s*$',lines[i])
            if m:yearrows.append((i,m))
            if len(yearrows)==3:break
        assert [m.group(1) for _,m in yearrows]==['2023','2024','2025'],(cat,yearrows)
        for line,m in yearrows:
            year=int(m.group(1));raws=list(m.groups()[1:]);nums=[int(re.sub(r'\D','',v)) for v in raws]
            assert nums[0]<=nums[1];assert sum(nums[1:4])==nums[4]
            for k,geo in enumerate(GEOS):
                status='reported_numeric'
                if cat in ['dating_violence','domestic_violence']:status='reported_combined_dating_domestic_scope'
                add(2026,'243744','243744001','Stanford Main Campus',cat,label,year,geo,nums[k],raws[k],status,page,printed,line+1,url,sha)
            CHECKS.append({'institution':'stanford','category':cat,'year':year,'sum_matches_printed_total':True,'housing_not_above_campus':True})
    NOTES.append({'institution':'stanford','source_sha256':sha,'scope':'Fresh 2026 full ASR applies to Main Campus; overseas reports remain separately listed 2025 editions. Do not replace overseas rows.',
      'category_scope':'Printed p104 says California dating violence included in domestic violence. Both separate categories tagged for adjudication. Dating footnote mentions 2022 while the marked row now reads 2023; no inferred year correction.'})

if __name__=='__main__':
    hopkins();stanford()
    assert len(ROWS)==11*14*3*4
    with (ROOT/'new_asr_core_counts.csv').open('w',encoding='utf8',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=FIELDS);writer.writeheader();writer.writerows(ROWS)
    (ROOT/'NEW_ASR_EXTRACTION_AUDIT.json').write_text(json.dumps({'status':'extracted_pending_independent_review','rows':len(ROWS),'checks':CHECKS,'source_notes':NOTES},indent=2)+'\n',encoding='utf8')
    print(json.dumps({'rows':len(ROWS),'arithmetic_discrepancies':[c for c in CHECKS if not c['sum_matches_printed_total'] or not c['housing_not_above_campus']]}))
