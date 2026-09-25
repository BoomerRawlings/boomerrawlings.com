"""Read the frozen 2025 Clery campus tables without changing source workbooks.

Normalize fixed-cohort counts; no denominators, rates, ranks or outcome selection.
Requires xlrd>=2 and openpyxl; Python standard library otherwise.
"""
from pathlib import Path
import csv,collections,json,hashlib,re,sys
HERE=Path(__file__).resolve().parent;sys.path.insert(0,str(HERE/'_deps'))
import xlrd,openpyxl
OUT=HERE/'normalized';OUT.mkdir(exist_ok=True)
SRC=HERE/'extracted/2025'
cohort={r['unitid']:r for r in json.loads((HERE/'cohort_manifest.json').read_text())['institutions']}
GEOGRAPHIES={'Oncampus':'on_campus','Residencehall':'residential_facilities','Noncampus':'noncampus','Publicproperty':'public_property','Reported':'local_state_police_reported'}
FAMILIES={'crime':'criminal_offenses','vawa':'vawa','arrest':'arrests','discipline':'disciplinary_referrals','hate':'hate_crimes'}
LABELS={'MURD':'Murder/nonnegligent manslaughter','NEG_M':'Negligent manslaughter','RAPE':'Rape','FONDL':'Fondling','INCES':'Incest','STATR':'Statutory rape','ROBBE':'Robbery','AGG_A':'Aggravated assault','BURGLA':'Burglary','VEHIC':'Motor vehicle theft','ARSON':'Arson','DOMEST':'Domestic violence','DATING':'Dating violence','STALK':'Stalking','WEAPON':'Weapons law violations','DRUG':'Drug law violations','LIQUOR':'Liquor law violations','FOND':'Fondling','INCE':'Incest','STAT':'Statutory rape','SIM_A':'Simple assault','LAR_T':'Larceny-theft','INTIM':'Intimidation','VANDAL':'Destruction/damage/vandalism','UNFOUN':'Unfounded crimes'}

def write(name,rows):
    assert rows,name
    with (OUT/name).open('w',encoding='utf-8-sig',newline='')as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)

def load(path):
    if path.suffix=='.xls':
        wb=xlrd.open_workbook(path);s=wb.sheet_by_index(0);headers=s.row_values(0)
        for i in range(1,s.nrows):yield i+1,dict(zip(headers,s.row_values(i)))
    else:
        wb=openpyxl.load_workbook(path,read_only=True,data_only=True);s=wb.worksheets[0];it=s.values;headers=next(it)
        for i,row in enumerate(it,2):yield i,dict(zip(headers,row))
        wb.close()

def numeric(value):
    if value is None or value=='':return None
    assert isinstance(value,(int,float))and value>=0 and float(value).is_integer(),repr(value)
    return int(value)

def build():
    allrows=[];profiles=[];hatewide=[];cohort_raw_tables=[]
    paths=[]
    for family in ['crime','vawa','arrest','discipline','hate']:
        for geo in GEOGRAPHIES:
            paths.append((SRC/(geo+family+'222324'+('.xlsx'if family=='hate'else'.xls')),geo,family))
    paths.append((SRC/'Unfounded222324.xls','All','unfounded'))
    for path,geo,family in paths:
        seen=set();n=0;selected=0;missing=0;filtered=0;labels=[];raw_selected=[]
        for excelrow,r in load(path):
            n+=1;campus=str(int(r['UNITID_P']));assert campus not in seen,(path.name,campus);seen.add(campus)
            unitid=campus[:-3]
            if unitid not in cohort:continue
            selected+=1;c=cohort[unitid]
            raw_selected.append({k:(int(v)if isinstance(v,float)and v.is_integer()else v)for k,v in r.items()})
            if family=='hate':hatewide.append(dict(source_file=path.name,geography=GEOGRAPHIES[geo],**raw_selected[-1]))
            for field,value in r.items():
                match=re.fullmatch(r'(.+)(22|23|24)',str(field))
                if not match:continue
                code,yy=match.groups()
                if code=='FILTER':continue
                if family=='hate'and code not in LABELS:continue # All original bias cells retained in separate wide table.
                assert code in LABELS,(path.name,code)
                year=2000+int(yy);flag=numeric(r['FILTER'+yy]);assert flag in (0,1)
                raw=numeric(value);status='reported_numeric'if flag==1 and raw is not None else'year_filter_0'if flag==0 else'blank_source_cell'
                count=raw if status=='reported_numeric'else None
                missing+=raw is None;filtered+=flag==0
                allrows.append(dict(collection_year=2025,year=year,unitid=unitid,campus_id=campus,institution_label=c['label'],cohort=c['group'],branch=str(r['BRANCH']).strip(),family=FAMILIES.get(family,family),geography=GEOGRAPHIES.get(geo,'not_geographically_split'),offense_code=code,offense_label=LABELS[code],count=count,raw_source_value=raw,source_year_filter=flag,status=status,source_file=path.name,source_sheet_row=excelrow,source_column=field))
        profiles.append(dict(source_file=path.name,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),rows=n,unique_campus_ids=len(seen),cohort_campus_rows=selected,cohort_blank_count_cells=missing,cohort_filtered_count_cells=filtered))
        # Cohort-only raw workbook cells as CSV make independent checks easy without interpreting missingness.
        write('raw_cohort_'+path.stem+'.csv',raw_selected)
        print(path.name,'selected',selected,'blank',missing,'filtered',filtered,flush=True)
    assert len({(r['campus_id'],r['year'],r['family'],r['geography'],r['offense_code'])for r in allrows})==len(allrows)
    allrows.sort(key=lambda r:(r['unitid'],r['campus_id'],r['family'],r['geography'],r['offense_code'],r['year']))
    write('cohort_campus_counts_2022_2024.csv',allrows)
    write('cohort_hate_bias_wide_2025.csv',hatewide)
    groups=collections.defaultdict(list)
    for r in allrows:groups[(r['unitid'],r['year'],r['family'],r['geography'],r['offense_code'])].append(r)
    institutional=[]
    for key,rr in sorted(groups.items()):
        unitid,year,family,geo,code=key;values=[r['count']for r in rr if r['count']is not None];complete=len(values)==len(rr)
        institutional.append(dict(collection_year=2025,year=year,unitid=unitid,institution_label=cohort[unitid]['label'],cohort=cohort[unitid]['group'],family=family,geography=geo,offense_code=code,offense_label=LABELS[code],count=sum(values)if complete else None,observed_sum=sum(values)if values else None,campus_count=len(rr),numeric_campus_count=len(values),year_filter_0_campuses=sum(r['source_year_filter']==0 for r in rr),blank_campuses=sum(r['source_year_filter']==1 and r['raw_source_value']is None for r in rr),status='complete_numeric_all_selected_campuses'if complete else'incomplete_campus_coverage',aggregation_scope='All campus branches listed for this institution in frozen 2025 bulk; no geography or branch exclusions'))
    write('cohort_institution_counts_2022_2024.csv',institutional)
    # Housing is a subset of on-campus geography; compare within campus and family/category.
    lookup={(r['campus_id'],r['year'],r['family'],r['geography'],r['offense_code']):r for r in allrows}
    violations=[];compared=0
    for r in allrows:
        if r['geography']!='residential_facilities':continue
        other=lookup[(r['campus_id'],r['year'],r['family'],'on_campus',r['offense_code'])]
        if r['count']is None or other['count']is None:continue
        compared+=1
        if r['count']>other['count']:violations.append({'campus_id':r['campus_id'],'year':r['year'],'family':r['family'],'offense_code':r['offense_code'],'residential':r['count'],'on_campus':other['count']})
    report={'status':'PASS_WITH_MISSINGNESS_FLAGS'if not violations else'SOURCE_ANOMALIES','collection_year':2025,'calendar_years':[2022,2023,2024],'cohort_institutions':len(cohort),'cohort_campuses':len({r['campus_id']for r in allrows}),'campus_count_rows':len(allrows),'institution_count_rows':len(institutional),'normalized_status_counts':dict(collections.Counter(r['status']for r in allrows)),'institution_status_counts':dict(collections.Counter(r['status']for r in institutional)),'housing_subset_pairs_checked':compared,'housing_exceeds_oncampus':violations,'tables':profiles,'filter_policy':'FILTER0 retained as unavailable; codebook does not distinguish new/nonoperational campus from unreported data. Strict totals withheld; observed_sum explicitly partial.','offense_sum_policy':'No cross-family total calculated. Housing and reported-by-police tables never added to on-campus counts.','normalized_file_hashes':{p.name:hashlib.sha256(p.read_bytes()).hexdigest()for p in sorted(OUT.glob('*.csv'))}}
    (HERE/'normalization_verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items()if k not in ['tables','normalized_file_hashes']},indent=2))

if __name__=='__main__':build()
