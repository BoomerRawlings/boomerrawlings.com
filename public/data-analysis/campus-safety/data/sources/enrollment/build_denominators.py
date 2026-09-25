"""Build verified institution-wide IPEDS denominators for the frozen cohort."""
from pathlib import Path
import csv,gzip,hashlib,io,json,zipfile
ROOT=Path(__file__).resolve().parent
RAW=ROOT/'raw'

def load(table):
    name=table+'.zip';manifest=json.loads((ROOT/'raw_manifest.json').read_text())
    if not (RAW/name).exists():
        saved=json.loads((ROOT/'reproduction_inputs/manifest.json').read_text())[table]
        blob=(ROOT/'reproduction_inputs'/saved['file']).read_bytes()
        assert hashlib.sha256(blob).hexdigest()==saved['sha256'],table
        return list(csv.DictReader(io.StringIO(gzip.decompress(blob).decode('utf-8')))),saved['upstream']
    blob=(RAW/name).read_bytes()
    assert hashlib.sha256(blob).hexdigest()==manifest[name]['sha256'],name
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        files=[p for p in z.namelist() if p.lower().endswith('.csv')]
        member=next((p for p in files if '_rv.' in p.lower()),files[0])
        data=z.read(member)
        try: decoded=data.decode('utf-8-sig')
        except UnicodeDecodeError: decoded=data.decode('cp1252')
        rows=[{k.strip():v.strip() for k,v in r.items()} for r in csv.DictReader(io.StringIO(decoded))]
    return rows,{'file':name,'member':member,'sha256':manifest[name]['sha256'],'source_url':manifest[name]['requested_url'],'release':'final_revised' if '_rv.' in member.lower() else 'provisional' if '2024' in table else 'single_release'}

def writecsv(path,rows):
    with path.open('w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)

def number(value):
    value=str(value).strip()
    if value in ('','None','.'):return None
    result=int(float(value));return result if result>=0 else None

def main():
    source=ROOT/'cohort_definition.csv'
    if not source.exists(): source=ROOT.parent/'clery/normalized/cohort_institution_crosswalk_2025.csv'
    cohort=list(csv.DictReader(source.open(encoding='utf-8-sig')))
    assert len(cohort)==42 and len({r['unitid'] for r in cohort})==42
    if source != ROOT/'cohort_definition.csv':
        (ROOT/'cohort_definition.csv').write_text(source.read_text(encoding='utf-8-sig'),encoding='utf-8')
    allrows=[];crosswalk=[];provenance={};issues=[];checks=[]
    for year in (2022,2023,2024):
        hd,hm=load(f'HD{year}');ef,em=load(f'EF{year}A');dist,dm=load(f'EF{year}A_DIST');drv,vm=load(f'DRVEF{year}')
        provenance[str(year)]={'directory':hm,'fall_enrollment':em,'distance_enrollment':dm,'derived_enrollment':vm}
        h={r['UNITID']:r for r in hd};d={r['UNITID']:r for r in drv}
        levels={(r['UNITID'],r['EFALEVEL']):r for r in ef};distances={(r['UNITID'],r['EFDELEV']):r for r in dist}
        assert len(levels)==len(ef) and len(distances)==len(dist)
        for c in cohort:
            uid=c['unitid'];directory=h[uid];official_ope=directory['OPEID'].strip().zfill(8)
            assert official_ope==c['opeid'].zfill(8),(c['label'],year,official_ope,c['opeid'])
            total=number(levels[(uid,'1')]['EFTOTLT']);assert total and total>0
            derived=d[uid];assert number(derived['ENRTOT'])==total,(uid,year,'EFA vs DRVEF')
            distance_row=distances[(uid,'1')];assert number(distance_row['EFDETOT'])==total,(uid,year,'distance vs EFA')
            ug=number(derived.get('EFUG'));grad=number(derived.get('EFGRAD'))
            if directory['UGOFFER']=='2' and ug is None:ug=0
            if directory['GROFFER']=='2' and grad is None:grad=0
            assert ug+grad==total,(uid,year,'UG+graduate')
            ft,pt=number(derived['ENRFT']),number(derived['ENRPT']);assert ft+pt==total
            exc,some,none=[number(distance_row[x]) for x in ('EFDEEXC','EFDESOM','EFDENON')]
            distance_derivation='Reported counts'
            if exc is None and some is None and none==total and distance_row['XEFDEEXC']=='A' and distance_row['XEFDESOM']=='A':
                exc=some=0
                distance_derivation='Zero derived from reported no-distance count equaling total; distance-only and some-distance source cells not applicable (A)'
            assert exc+some+none==total
            if year==2024:
                crosswalk.append({'cohort':c['cohort'],'label':c['label'],'unitid':uid,'institution_name_ipeds':directory['INSTNM'],'institution_name_clery':c['institution_name'],'opeid':official_ope,'city':directory['CITY'],'state':directory['STABBR'],'hospital_hd_code':directory['HOSPITAL'],'medical_school_hd_code':directory['MEDICAL'],'campus_count_clery':c['campus_count_2025_file'],'unitid_and_opeid_match_verified':True,'scope':'IPEDS institutional reporting unit; Clery branch alignment separately qualified'})
                bulk=number(c['enrollment_total_single_bulk_field'])
                checks.append({'unitid':uid,'label':c['label'],'ipeds_fall2024_headcount':total,'clery2025_single_enrollment_field':bulk,'difference':None if bulk is None else bulk-total,'interpretation':'Numerical cross-check only; federal crime export does not identify the enrollment vintage in its field label.'})
            allrows.append({'unitid':uid,'opeid':official_ope,'cohort':c['cohort'],'label':c['label'],'institution_name':directory['INSTNM'],'year':year,
              'fall_headcount_total':total,'undergraduate_headcount':ug,'graduate_headcount':grad,'full_time_headcount':ft,'part_time_headcount':pt,'fall_fte':number(derived.get('FTE')),
              'distance_exclusive_headcount':exc,'distance_some_headcount':some,'distance_none_headcount':none,'not_exclusively_distance_headcount':total-exc,'distance_exclusive_share':exc/total,
              'distance_count_derivation':distance_derivation,
              'total_imputation_flag':levels[(uid,'1')].get('XEFTOTLT',''),'distance_exclusive_imputation_flag':distance_row.get('XEFDEEXC',''),
              'enrollment_release':em['release'],'source_file':em['file'],'source_member':em['member'],'source_variable':'EFTOTLT where EFALEVEL=1','source_url':em['source_url'],
              'denominator_scope':'IPEDS institution-wide fall snapshot; all levels and attendance statuses','residential_population':False,'calendar_alignment':'Calendar-year y reported offenses / fall-y enrollment snapshot; not person-time','geography_warning':'Enrollment does not establish physical presence on each Clery property; includes remote students and institutional locations.'})
    writecsv(ROOT/'enrollment_2022_2024.csv',allrows)
    writecsv(ROOT/'institution_crosswalk_verified.csv',crosswalk)
    writecsv(ROOT/'clery_bulk_enrollment_comparison.csv',checks)
    (ROOT/'enrollment_provenance.json').write_text(json.dumps({'years':[2022,2023,2024],'rows':len(allrows),'institutions':len(cohort),'latest_fall_year':2024,'cohort_source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sources':provenance,'checks':['42 verified UNITIDs and OPEIDs across three annual directories','Unique table keys','EF total agrees with DRVEF and distance table','Undergraduate + graduate and full-time + part-time equal total','Distance-exclusive + some + none equal total']},indent=2)+'\n')
    for table in ['EF2024A','EF2024A_DIST','DRVEF2024']:
        if not (RAW/(table+'_Dict.zip')).exists():
            assert (ROOT/(table+'_dictionary.json')).exists(),'Provide the dictionary JSON or original workbook ZIP.'
            continue
        import openpyxl
        with zipfile.ZipFile(RAW/(table+'_Dict.zip')) as z:
            book=openpyxl.load_workbook(io.BytesIO(z.read(z.namelist()[0])),read_only=True,data_only=True)
            data={sheet:[list(row) for row in book[sheet].values] for sheet in book.sheetnames}
            (ROOT/(table+'_dictionary.json')).write_text(json.dumps(data,indent=2,default=str)+'\n')
    print(json.dumps({'rows':len(allrows),'institutions':len(cohort),'all_headcounts_verified':True,'bulk2025_mismatches':sum(r['difference']!=0 for r in checks),'total_imputation_flags':sorted({r['total_imputation_flag'] for r in allrows})},indent=2))

if __name__=='__main__':main()
