from pathlib import Path
import sys,csv,json,collections,zipfile
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE/'_deps'))
import xlrd
target=HERE/'extracted/2025';target.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(HERE/'raw/Crime2025EXCEL.zip')as archive:
 for name in archive.namelist():
  destination=target/name
  assert destination.resolve().is_relative_to(target.resolve())
  data=archive.read(name)
  if destination.exists():assert destination.read_bytes()==data, 'Extracted source differs from official ZIP'
  else:destination.write_bytes(data)
cohort=[('UC','UC Berkeley','110635'),('UC','UC Davis','110644'),('UC','UC Irvine','110653'),('UC','UCLA','110662'),('UC','UC Merced','445188'),('UC','UC Riverside','110671'),('UC','UC San Diego','110680'),('UC','UC San Francisco','110699'),('UC','UC Santa Barbara','110705'),('UC','UC Santa Cruz','110714'),('Ivy League','Brown','217156'),('Ivy League','Columbia','190150'),('Ivy League','Cornell','190415'),('Ivy League','Dartmouth','182670'),('Ivy League','Harvard','166027'),('Ivy League','Pennsylvania','215062'),('Ivy League','Princeton','186131'),('Ivy League','Yale','130794'),('Additional public','San Diego State','122409'),('Additional public','Georgia Tech','139755'),('Additional public','Illinois Urbana-Champaign','145637'),('Additional public','Michigan Ann Arbor','170976'),('Additional public','North Carolina Chapel Hill','199120'),('Additional public','Ohio State Columbus','204796'),('Additional public','Penn State University Park','214777'),('Additional public','Texas Austin','228778'),('Additional public','Florida','134130'),('Additional public','Virginia','234076'),('Additional public','Washington Seattle','236948'),('Additional public','Wisconsin Madison','240444'),('Additional private','Caltech','110404'),('Additional private','Carnegie Mellon','211440'),('Additional private','Chicago','144050'),('Additional private','Duke','198419'),('Additional private','Georgetown','131496'),('Additional private','Johns Hopkins','162928'),('Additional private','MIT','166683'),('Additional private','Northwestern','147767'),('Additional private','Notre Dame','152080'),('Additional private','NYU','193900'),('Additional private','Stanford','243744'),('Additional private','USC','123961')]
assert len(cohort)==42 and len({r[2]for r in cohort})==42
out=HERE/'normalized';out.mkdir(exist_ok=True)
s=xlrd.open_workbook(HERE/'extracted/2025/Oncampuscrime222324.xls').sheet_by_index(0)
h=s.row_values(0);rows=[dict(zip(h,s.row_values(i)))for i in range(1,s.nrows)]
def norm(v):return int(v)if isinstance(v,float)and v.is_integer()else str(v).strip()if isinstance(v,str)else v
for r in rows:
 for k in r:r[k]=norm(r[k])
 r['UNITID_P']=str(r['UNITID_P']);r['unitid_derived']=r['UNITID_P'][:-3]
def write(name,data):
 with(out/name).open('w',encoding='utf-8-sig',newline='')as f:
  w=csv.DictWriter(f,fieldnames=list(data[0]));w.writeheader();w.writerows(data)
groups=collections.defaultdict(list)
for r in rows:groups[r['unitid_derived']].append(r)
units=[];campuses=[]
for group,label,unitid in cohort:
 rr=groups[unitid];assert rr
 assert len({r['INSTNM']for r in rr})==1
 units.append(dict(cohort=group,label=label,unitid=unitid,institution_name=rr[0]['INSTNM'],opeid=';'.join(sorted({r['OPEID']for r in rr})),campus_count_2025_file=len(rr),campus_ids=';'.join(sorted(r['UNITID_P']for r in rr)),enrollment_total_single_bulk_field=';'.join(sorted({str(r['Total'])for r in rr})),enrollment_note='Single institution-level triplet repeated across branches; enrollment vintage not stated in codebook; not denominator',unitid_mapping_note='Derived by removing last3digits from UNITID_P; validate against IPEDS HD/OPEID',campus_scope_note='All federal branches preserved, including medical/foreign branches; housing subset must be explicitly matched'))
 for r in rr:
  campuses.append(dict(cohort=group,label=label,unitid=unitid,campus_id=r['UNITID_P'],institution_name=r['INSTNM'],opeid=r['OPEID'],branch=r['BRANCH'],address=r['Address'],city=r['City'],state=r['State'],zip=r['ZIP'],reported_enrollment_men=r['men_total'],reported_enrollment_women=r['women_total'],reported_enrollment_total=r['Total'],filter_2022=r['FILTER22'],filter_2023=r['FILTER23'],filter_2024=r['FILTER24'],candidate_first_campus_suffix001=int(r['UNITID_P'].endswith('001')),housing_analysis_selection='NOT SELECTED: require matching residence denominator geography',source_file='Oncampuscrime222324.xls'))
write('cohort_institution_crosswalk_2025.csv',units);write('cohort_campus_crosswalk_2025.csv',campuses)
(HERE/'cohort_manifest.json').write_text(json.dumps({'protocol':'../../PROTOCOL.md','collection_year':2025,'count':len(units),'institutions':[{'group':g,'label':l,'unitid':u}for g,l,u in cohort]},indent=2))
print(json.dumps({'institutions':len(units),'campuses':len(campuses),'multi_campus':[{'label':r['label'],'campuses':r['campus_count_2025_file']}for r in units if r['campus_count_2025_file']>1],'filter0_campus_years':sum(sum(r[f'filter_{y}']==0 for y in [2022,2023,2024])for r in campuses)},indent=2))
