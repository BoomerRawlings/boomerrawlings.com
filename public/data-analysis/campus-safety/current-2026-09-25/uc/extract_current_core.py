"""Source-versioned core count extraction. Never changes the frozen study.

Explicit table order/geography assignments are checked against rendered pages.
Footnote suffix corrections below refer to the visibly superscripted markers,
not inferred crime counts. Unreported columns remain unavailable.
"""
import pathlib,json,re,csv,hashlib
P=pathlib.Path(__file__).parent; ROOT=P.parents[2]
CATS=['murder','negligent_manslaughter','rape','fondling','incest','statutory_rape','robbery','aggravated_assault','burglary','motor_vehicle_theft','arson','domestic_violence','dating_violence','stalking']
LABELS=['Murder/Nonnegligent Manslaughter','Negligent Manslaughter','Rape','Fondling','Incest','Statutory Rape','Robbery','Aggravated Assault','Burglary','Motor Vehicle Theft','Arson','Domestic Violence','Dating Violence','Stalking']
CODES=dict(zip(CATS,['MURD','NEG_M','RAPE','FONDL','INCES','STATR','ROBBE','AGG_A','BURGLA','VEHIC','ARSON','DOMEST','DATING','STALK']))
GEO=['residential','oncampus','noncampus','publicproperty']
FED_GEO=dict(zip(GEO,['residential_facilities','on_campus','noncampus','public_property']))
ROWS=[]
def pages(key):return json.loads((P/(key+'_report_pages.json')).read_text(encoding='utf-8'))
def md(key):return json.loads((P/(key+'_report_metadata.json')).read_text(encoding='utf-8'))
def add(key,edition,unit,campus_id,campus,cat,year,vals,raw,pg,printed=None,note=''):
 m=md(key);url=m['requested_url']
 if key=='san_francisco_stats':url='https://ucsf.box.com/s/owaeqqmzt4tibddl836rmfi8hk0ln4bo'
 if key=='los_angeles':url='https://ucla.box.com/s/gzlc5edy5yuyeozpf1adob2rvsrdf9ur'
 if key=='ucdc':url='https://ucop.box.com/v/CleryASFSRUCDC'
 for geo in GEO:
  v=vals.get(geo); token=raw.get(geo,'column absent')
  ROWS.append(dict(report_edition=edition,report_year=year,institution_unitid=unit,campus_id=campus_id,campus=campus,category=cat,category_label=LABELS[CATS.index(cat)],family='vawa' if cat in CATS[-3:] else 'criminal_offenses',geography=geo,count=v,raw_value=token,status=('column_not_reported' if token=='column absent' else 'source_NA') if v is None else 'reported_numeric',pdf_page=pg,printed_page=printed if printed is not None else pg,source_line='',source_url=url+f'#page={pg}',source_sha256=m['sha256'],source_note=note))
def integer(token):return None if token in ['N/A','NA'] else int(re.sub(r'[*^]+','',token))
def emit_sequential(key,edition,unit,campus_id,campus,pgs,cats,geos,limit=None,printed_offset=0,corrections=None,layout=False):
 found=[]
 for pg in pgs:
  text=(P/f'{key}_layout_{pg}.txt').read_text(encoding='utf-8') if layout else pages(key)[pg-1]
  for ln in text.splitlines():
   line=re.sub(r'\s+',' ',ln).strip()
   pattern=r'\b(202[2-5])\s+'+r'\s+'.join([r'(N/A|NA|\d+[,*^\d]*)']*len(geos))+r'\s*$'
   m=re.search(pattern,line)
   if m:found.append((pg,int(m[1]),list(m.groups()[1:])))
 if limit:found=found[:limit]
 assert len(found)==len(cats)*3,(key,campus,len(found),len(cats)*3)
 for i,(pg,year,tokens) in enumerate(found):
  cat=cats[i//3]
  if cat not in CATS:continue
  raw=dict(zip(geos,tokens)); corrected=raw.copy(); note=''
  for (cc,yy,gg),(token,val,why) in (corrections or {}).items():
   if (cat,year)==(cc,yy):assert raw[gg]==token;corrected[gg]=str(val);note=why
  vals={g:integer(t) for g,t in corrected.items()}
  if 'total' in vals:assert vals['total']==sum(vals[g] or 0 for g in ['oncampus','noncampus','publicproperty']),(key,campus,cat,year,vals)
  add(key,edition,unit,campus_id,campus,cat,year,vals,raw,pg,pg+printed_offset,note)

# UCSF publishes five matching campus statistics tables, with five columns/year.
sf_order=['murder','negligent_manslaughter','robbery','aggravated_assault','burglary','motor_vehicle_theft','arson','rape','fondling','incest','statutory_rape','dating_violence','domestic_violence','stalking']
sf_names=['Parnassus Heights','Mission Bay','Mount Zion',"Benioff Children's Hospital Oakland",'Fresno']
for j,s in enumerate(pages('san_francisco_stats')):
 matches=[]
 for line in s.splitlines():
  m=re.fullmatch(r'(.+?)\s+((?:\d+\s+){14}\d+)',line.strip())
  if m:matches.append((m[1],m[2].split()))
 assert len(matches)>=14
 for cat,(label,values) in zip(sf_order,matches[:14]):
  for k,year in enumerate([2023,2024,2025]):
   raw=dict(zip(['residential','oncampus','publicproperty','noncampus','unfounded'],values[k*5:(k+1)*5]));vals={g:int(v) for g,v in raw.items()}
   add('san_francisco_stats',2026,'110699','11069900'+str(j+1),sf_names[j],cat,year,vals,raw,j+1,note='Separate current statistics supplement; full ASR corresponding tables PDF pp84–88. Unfounded column excluded from four geographic counts.')

# Davis table footnotes attach directly to the number in text extraction.
emit_sequential('davis',2026,'110644','110644001','Davis',[26],CATS[:11],['residential','oncampus','publicproperty','noncampus','total'],printed_offset=-1,corrections={('fondling',2024,'residential'):('861,2',86,'Superscripts1,2: source count86; one report includes80 separate incidents; footnote2 revises85→86.')})
emit_sequential('davis',2026,'110644','110644002','UC Davis Health',[27],CATS[:11],['residential','oncampus','publicproperty','noncampus','total'],printed_offset=-1)
for cid,campus,offset in [('110644001','Davis',0),('110644002','UC Davis Health',9)]:
 # Split the single VAWA page at its campus-specific numbered heading.
 text=pages('davis')[27].split('4.3.4')[0] if offset==0 else '4.3.4'+pages('davis')[27].split('4.3.4')[1]
 found=re.findall(r'\b(202[3-5])\s+(N/A|\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)',text)
 assert len(found)==9
 for i,row in enumerate(found):
  year=int(row[0]);raw=dict(zip(['residential','oncampus','publicproperty','noncampus','total'],row[1:]));vals={g:integer(v) for g,v in raw.items()}
  assert vals['total']==sum(vals[g] for g in ['oncampus','noncampus','publicproperty'])
  add('davis',2026,'110644',cid,campus,CATS[-3:][i//3],year,vals,raw,28,27)

# Riverside repeats category names on every year row; Palm Desert omits two columns.
riv_labels=dict(zip(CATS,[r'Murder And Non-Negligent\s+Manslaughter',r'Manslaughter By Negligence',r'Rape',r'Fondling',r'Incest',r'Statutory Rape',r'Robbery',r'Aggravated Assault',r'Burglary',r'Motor Vehicle Theft',r'Arson',r'Domestic Violence',r'Dating Violence',r'Stalking']))
riv_fixes={('motor_vehicle_theft',2024,'oncampus'):('3896',389,'Superscript6 describes e-scooter/e-bike motor-vehicle classification.'),('dating_violence',2024,'oncampus'):('147',14,'Footnote7: revised19→14 campus and13→11 housing.'),('dating_violence',2024,'residential'):('117',11,'Footnote7: revised19→14 campus and13→11 housing.'),('dating_violence',2023,'oncampus'):('148',14,'Footnote8: revised11→14 campus and7→8 housing.'),('dating_violence',2023,'residential'):('88',8,'Footnote8: revised11→14 campus and7→8 housing.'),('stalking',2024,'oncampus'):('109',10,'Footnote9: revised11→10 campus and3→2 housing.'),('stalking',2024,'residential'):('29',2,'Footnote9: revised11→10 campus and3→2 housing.')}
for cid,campus,pgs,geos in [('110671001','Riverside',range(157,160),['oncampus','residential','noncampus','publicproperty']),('110671002','Palm Desert Center',range(161,164),['oncampus','publicproperty'])]:
 n=0
 for pg in pgs:
  s=re.sub(r'\s+',' ',pages('riverside')[pg-1])
  for cat,lab in riv_labels.items():
   pattern=r'(?<!\w)'+lab+r'\s+(202[3-5])\s+'+r'\s+'.join([r'(\d+)']*len(geos))+r'\b'
   for m in re.finditer(pattern,s,re.I):
    # Statutory Rape includes the shorter word Rape; exclude that duplicate.
    if cat=='rape' and s[max(0,m.start()-10):m.start()].strip().endswith('Statutory'):continue
    year=int(m[1]);raw=dict(zip(geos,m.groups()[1:]));vals={g:int(v) for g,v in raw.items()};note=''
    for g in geos:
     fix=riv_fixes.get((cat,year,g)) if cid.endswith('001') else None
     if fix:assert raw[g]==fix[0];vals[g]=fix[1];note=fix[2]
    add('riverside',2026,'110671',cid,campus,cat,year,vals,raw,pg,note=note);n+=1
 assert n==42,(campus,n)

sb_order=CATS[:9]+['arson','hazing','motor_vehicle_theft']+CATS[-3:]
emit_sequential('santa_barbara',2026,'110705','110705001','UC Santa Barbara',range(218,223),sb_order,['oncampus','residential','noncampus','publicproperty','total'],limit=45,printed_offset=-2)
emit_sequential('ucdc',2026,'110635','110635003','University of California Washington Center',[21,22],CATS,['oncampus','noncampus','publicproperty','total','residential'],limit=42)
emit_sequential('san_diego',2025,'110680','110680001','UC San Diego',[142],CATS[:11],['residential','oncampus','noncampus','publicproperty','total'],layout=True)
emit_sequential('san_diego',2025,'110680','110680001','UC San Diego',[143],CATS[-3:],['residential','oncampus','noncampus','publicproperty','total'],layout=True,limit=9)

# Irvine: on-campus first; Health has explicitly not-applicable housing.
for cid,campus,pgs in [('110653001','UC Irvine',[196,197]),('110653002','UCI Health Medical Center',[199,200])]:
 emit_sequential('irvine',2025,'110653',cid,campus,pgs,CATS,['oncampus','residential','noncampus','publicproperty','total'],layout=True,printed_offset=-2)

# UCLA: the Sexual Assault subtotal is excluded; Rape/Fondling are counted once.
la_order=['murder','negligent_manslaughter','sexual_assault_subtotal','rape','fondling','statutory_rape','incest','robbery','aggravated_assault','burglary','motor_vehicle_theft','arson','domestic_violence','dating_violence','stalking']
la_matches=[]
for line in pages('los_angeles')[161].splitlines():
 m=re.search(r'((?:\d+\*?\s+){11}\d+\*?)\s*$',line)
 if m:la_matches.append(m[1].split())
assert len(la_matches)>=15
for cat,tokens in zip(la_order,la_matches[:15]):
 if cat not in CATS:continue
 for yi,year in enumerate([2022,2023,2024]):
  raw=dict(zip(['residential','oncampus','publicproperty','noncampus'],tokens[yi*4:(yi+1)*4]))
  note='Since2022, UCLA includes dating violence in its domestic violence counts per source explanatory note; do not interpret printed dating zeros as no dating-related violence.' if cat in ['domestic_violence','dating_violence'] else ''
  add('los_angeles',2025,'110662','110662001','UCLA',cat,year,{g:integer(t) for g,t in raw.items()},raw,162,161,note)

# UCSC tables use sequential years; visibly superscripted notes are removed explicitly.
sc_cats={10:['murder'],11:['negligent_manslaughter','rape','fondling','incest','statutory_rape','robbery'],12:['aggravated_assault','burglary','motor_vehicle_theft','arson','domestic_violence','dating_violence'],13:['stalking']}
for pg,cats in sc_cats.items():
 text=re.sub(r'\s+',' ',pages('santa_cruz')[pg-1])
 if pg==11:
  assert '2024 46 38 6 0 0' in text;text=text.replace('2024 46 38 6 0 0','2024 46 38 0 0')
 if pg==12:
  assert '2024 19 167 1 0' in text;text=text.replace('2024 19 167 1 0','2024 19 16 1 0')
 found=re.findall(r'\b(202[2-4])\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\b',text)[:len(cats)*3]
 assert len(found)==len(cats)*3,(pg,found)
 for i,row in enumerate(found):
  year=int(row[0]);cat=cats[i//3];raw=dict(zip(['oncampus','residential','noncampus','publicproperty'],row[1:]));note=''
  if pg==11 and cat=='rape' and year==2024:raw['residential']='38 [superscript6]';note='Source footnote6: housing38 includes21 separate incidents in one report, also included in campus46.'
  if pg==12 and cat=='domestic_violence' and year==2024:raw['residential']='16 [superscript7]';note='Corrected April30,2026: housing14→16; noncampus0→1; campus18→19 (data-entry errors).'
  vals=dict(zip(['oncampus','residential','noncampus','publicproperty'],map(int,row[1:])))
  add('santa_cruz',2025,'110714','110714001','UC Santa Cruz',cat,year,vals,raw,pg,note=note)

# Berkeley PDF lacks usable font mapping. Values manually transcribed from page126,
# including all four geography columns; three years per geography (2022,2023,2024).
berkeley_cells={
 'murder':'0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
 'negligent_manslaughter':'0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
 'rape':'17 61c 27 | 13 10 20 | 8 10 4 | 3 4 0',
 'fondling':'17 13 23 | 6 3 13 | 3 2 3 | 4 9 2',
 'incest':'0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
 'statutory_rape':'0 1 0 | 0 1 0 | 0 0 0 | 0 0 0',
 'robbery':'25 18 17 | 1 1 1 | 3 3 2 | 24e 37 17',
 'aggravated_assault':'63 33 44 | 2 9 11 | 8 24 18 | 37e 28 21',
 'burglary':'48 92 59 | 15 15 9 | 56 58 56 | 0 0 0',
 'motor_vehicle_theft':'307a 424d 346f | 1a 0d 1f | 37a 40d 24f | 38a 58d 74f',
 'arson':'20 14 14 | 1 4 0 | 1 6 4 | 0 2 1',
 'domestic_violence':'7 10 4 | 3 4 3 | 12 7 23 | 2 3 2',
 'dating_violence':'9 12 26 | 5 5 18 | 1 1 1 | 0 2 2',
 'stalking':'50b 70 91 | 13 24 22 | 9 5 5 | 2 2 2'}
for cat,text in berkeley_cells.items():
 groups=[x.split() for x in text.split('|')]
 for yi,year in enumerate([2022,2023,2024]):
  raw=dict(zip(['oncampus','residential','noncampus','publicproperty'],[group[yi] for group in groups]));vals={g:int(re.sub('[a-f]','',t)) for g,t in raw.items()}
  note='Manual visual transcription, sourcePDFp126; superscript letters retained in raw_value. Unfounded column excluded.'
  if cat=='rape' and year==2023:note+=' Source footnotec:39 campus incidents in one report, one survivor and one perpetrator; neither affiliated with university.'
  add('berkeley',2025,'110635','110635001','UC Berkeley',cat,year,vals,raw,126,note=note)

keys=[(r['campus_id'],r['report_year'],r['category'],r['geography']) for r in ROWS];assert len(keys)==len(set(keys))
ix={k:r for k,r in zip(keys,ROWS)}
for r in ROWS:
 if r['geography']=='residential' and r['count'] is not None:
  other=ix[(r['campus_id'],r['report_year'],r['category'],'oncampus')]
  assert r['count']<=other['count'],r
def csvwrite(name,rows):
 with (P/name).open('w',encoding='utf-8',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
csvwrite('current_core_counts.csv',ROWS)
(P/'current_core_counts.json').write_text(json.dumps(ROWS,ensure_ascii=False,indent=2),encoding='utf-8')
federal=list(csv.DictReader((ROOT/'sources/clery/normalized/cohort_campus_counts_2022_2024.csv').open(encoding='utf-8-sig')))
fi={(r['campus_id'],int(r['year']),r['family'],r['offense_code'],r['geography']):r for r in federal}
comp=[]
for r in ROWS:
 key=(r['campus_id'],r['report_year'],r['family'],CODES[r['category']],FED_GEO[r['geography']])
 if key not in fi:continue
 f=fi[key];v=int(f['count']) if f['count'] else None
 comp.append({k:r[k] for k in ['institution_unitid','campus_id','campus','report_edition','report_year','category','geography']}|dict(federal_count=v,current_asr_count=r['count'],federal_status=f['status'],asr_status=r['status'],difference=r['count']-v if v is not None and r['count'] is not None else None,source_url=r['source_url']))
csvwrite('federal_comparison.csv',comp)
dif=[r for r in comp if r['difference'] not in [None,0]]
(P/'extraction_checks.json').write_text(json.dumps(dict(status='Extracted and visually reviewed against all core-table pages by the UC source reviewer; no second independent reviewer of these extraction outputs yet',core_cells=len(ROWS),campuses=len(set(r['campus_id'] for r in ROWS)),numeric_cells=sum(r['count'] is not None for r in ROWS),overlap_cells=len(comp),numeric_differences=dif),indent=2),encoding='utf-8')
print('Parsed',len(ROWS),'cells;',len(comp),'federal overlap;',len(dif),'numeric differences')
print(json.dumps(dif,indent=2))
