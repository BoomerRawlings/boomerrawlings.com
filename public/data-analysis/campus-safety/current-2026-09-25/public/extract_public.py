"""Extract current official public-university tables; retain geography and source cells.

Source-specific layouts are deliberate. Assert table sizes and years rather than
guessing missing cells. This script does not overwrite the frozen federal study.
"""
from pathlib import Path
from html.parser import HTMLParser
import csv, hashlib, json, re
from pypdf import PdfReader
import pdfplumber

ROOT=Path(__file__).resolve().parent
CATS=['murder','negligent_manslaughter','rape','fondling','incest','statutory_rape','robbery','aggravated_assault','burglary','motor_vehicle_theft','arson']
VAWA=['domestic_violence','dating_violence','stalking']
GEO=['oncampus','residential','noncampus','publicproperty']
FIELDS=['report_edition','report_year','institution_unitid','campus_id','campus','category','category_label','family','geography','count','raw_value','status','pdf_page','printed_page','source_line','source_url','source_sha256']
records=[]
sources=[]
for name in ['landings.results.json','current.results.json','documents.results.json','additional.results.json']:
    if (ROOT/name).exists():sources+=json.loads((ROOT/name).read_text(encoding='utf-8'))

def source(key,role=None):
    return next(r for r in reversed(sources) if r['key']==key and r.get('status')=='retrieved' and (r.get('kind')=='pdf' if role is None else r.get('role')==role))

def emit(src,unitid,campus_id,campus,edition,year,category,values,page='',line='',geos=GEO):
    assert len(values)==len(geos),(campus,category,values)
    for geo,raw in zip(geos,values):
        raw=str(raw);number=re.sub(r'^[*]+|[*,A-Z]+$','',raw)
        if number.isdigit():count=int(number);status='reported_numeric'
        elif raw.lower() in ['n/a','na','not applicable']:count='';status='not_applicable'
        else:count='';status='unresolved_source_marker'
        printed_page=page-{'236948':1,'228778':8,'199120':1}.get(unitid,0) if isinstance(page,int) else ''
        records.append(dict(report_edition=edition,report_year=year,institution_unitid=unitid,campus_id=campus_id,campus=campus,category=category,category_label=category.replace('_',' '),family='vawa' if category in VAWA else 'criminal_offenses',geography=geo,count=count,raw_value=raw,status=status,pdf_page=page,printed_page=printed_page,source_line=line,source_url=src['url']+(f'#page={page}' if page else ''),source_sha256=src['sha256']))

def layout(src,page):
    p=ROOT/src['local_pdf'];reader=PdfReader(p)
    return [' '.join(l.split()) for l in reader.pages[page-1].extract_text(extraction_mode='layout').splitlines() if l.strip()]

def year_rows(lines,minimum=4):
    found=[]
    for n,line in enumerate(lines,1):
        m=re.search(r'\b(202[1-5])\s+((?:\*?\*?\*?\d+[A-Z*]*|n/a)(?:\s+(?:\d+[A-Z*]*|n/a)){'+str(minimum-1)+r',})\s*$',line,re.I)
        if m:found.append((int(m[1]),m[2].split(),n,line))
    return found

def gatech():
    src=source('gatech')
    for page,cid,name in [(79,'139755001','Atlanta'),(80,'139755003','Europe'),(81,'139755002','Savannah')]:
        rows=year_rows(layout(src,page));assert len(rows)==(63 if page==79 else 61),(page,len(rows))
        cats=CATS+['arrest_weapons','arrest_drugs','arrest_liquor','referral_weapons','referral_drugs','referral_liquor']+VAWA
        for i,cat in enumerate(cats):
            if cat not in CATS+VAWA:continue
            for j,y in enumerate([2023,2024,2025]):
                year,values,n,line=rows[i*3+j];assert year==y
                if page==81:
                    assert len(values)==4
                    vals=[values[0],'n/a',values[1],values[2]]
                else:
                    assert len(values)==5
                    vals=values[:4]
                assert int(values[-1])==sum(int(values[k]) for k in ([0,1,2] if page==81 else [0,2,3]))
                emit(src,'139755',cid,name,2026,year,cat,vals,page,n)

def washington():
    src=source('washington')
    for page,cats in [(13,CATS),(14,VAWA)]:
        rows=year_rows(layout(src,page));assert len(rows)==3*len(cats),(page,len(rows))
        for i,cat in enumerate(cats):
            for j,y in enumerate([2024,2023,2022]):
                year,values,n,line=rows[i*3+j];assert year==y and len(values)==5
                emit(src,'236948','236948001','Seattle',2025,year,cat,values[:4],page,n)

class FloridaTables(HTMLParser):
    def __init__(self):
        super().__init__();self.campus='';self.year=None;self.tables=[];self.table=None;self.row=None;self.cell=None;self.capture=None;self.buffer='';self.table_index=0
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='button' and 'accordion-button' in a.get('class',''):self.capture='campus';self.buffer=''
        if tag=='h3':self.capture='year';self.buffer=''
        if tag=='table':self.table=[];self.table_index+=1
        if tag=='tr' and self.table is not None:self.row=[]
        if tag in ['td','th'] and self.row is not None:self.cell=''
    def handle_data(self,text):
        if self.capture:self.buffer+=text
        if self.cell is not None:self.cell+=text
    def handle_endtag(self,tag):
        if (tag=='button' and self.capture=='campus') or (tag=='h3' and self.capture=='year'):
            t=' '.join(self.buffer.split())
            if self.capture=='campus' and t:self.campus=t;self.year=None
            if self.capture=='year' and re.fullmatch(r'202[345]\*?',t):self.year=int(t[:4])
            self.capture=None
        if tag in ['td','th'] and self.cell is not None:self.row.append(' '.join(self.cell.split()));self.cell=None
        if tag=='tr' and self.row is not None:self.table.append(self.row);self.row=None
        if tag=='table' and self.table is not None:self.tables.append((self.campus,self.year,self.table_index,self.table));self.table=None

def florida():
    src=source('florida','current');p=FloridaTables();p.feed((ROOT/src['local_html']).read_text(encoding='utf-8'))
    out=[]
    for campus,year,index,table in p.tables:
        if not table or not table[0]:continue
        head=table[0][0]
        if head not in ['Criminal Offenses','VAWA (Violence Against Women Act) Crimes']:continue
        cats=CATS if head=='Criminal Offenses' else ['dating_violence','domestic_violence','stalking']
        assert year in [2023,2024,2025],(campus,year)
        assert len(table)==len(cats)+1,(campus,year,head,len(table))
        assert [c.rstrip('*') for c in table[0][1:]]==['On-Campus','Residential','Non-Campus','Public'],table[0]
        for cat,row in zip(cats,table[1:]):
            assert len(row)==5,(campus,year,row)
            label=re.sub('[^a-z]','',row[0].lower())
            expected={'murder':'murdernonnegligentmanslaughter','negligent_manslaughter':'negligentmanslaughter'}.get(cat,cat.replace('_',''))
            assert label.startswith(expected),(campus,cat,row[0])
            emit(src,'134130','source:'+re.sub('[^a-z0-9]+','-',campus.lower()).strip('-'),campus,2026,year,cat,row[1:],'',f'HTML table {index}; row {table.index(row)+1}')
            for record in records[-4:]:
                if record['raw_value']=='+':record['status']='not_applicable_no_corresponding_geography'
                if campus=='UF Jacksonville' and record['raw_value']=='*':record['status']='not_applicable_campus_opened_2026'
        out.append((campus,year,head))
    (ROOT/'florida_table_inventory.json').write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8')

def michigan():
    src=source('michigan')
    cats=CATS[:8]+['arson','burglary','motor_vehicle_theft']
    rows=year_rows(layout(src,16));assert len(rows)==36
    for i,cat in enumerate(cats):
        for year,values,n,line in rows[i*3:i*3+3]:
            assert len(values)==4
            emit(src,'170976','170976001','Ann Arbor',2025,year,cat,values,16,n)
    rows=year_rows(layout(src,17));assert len(rows)==24
    for i,cat in enumerate(['stalking','domestic_violence','dating_violence']):
        for year,values,n,line in rows[15+i*3:18+i*3]:emit(src,'170976','170976001','Ann Arbor',2025,year,cat,values,17,n)

def illinois():
    src=source('illinois')
    for cid,name,pages,vawa_page in [('145637001','Urbana-Champaign',[7,8],10),('145637003','Illini Center',[127,128,129],130)]:
        rows=[]
        for p in pages:rows.extend((p,*r) for r in year_rows(layout(src,p)))
        assert len(rows)>=33,(name,len(rows))
        for i,cat in enumerate(CATS):
            for j,y in enumerate([2024,2023,2022]):
                p,year,vals,n,line=rows[i*3+j];assert year==y and len(vals)==5
                emit(src,'145637',cid,name,2025,year,cat,vals[:4],p,n)
        lines=layout(src,vawa_page);start=next(i for i,l in enumerate(lines) if 'Violence Against Women Act' in l)
        rows=year_rows(lines[start:]);assert len(rows)==9
        for i,cat in enumerate(VAWA):
            for year,vals,n,line in rows[i*3:i*3+3]:emit(src,'145637',cid,name,2025,year,cat,vals[:4],vawa_page,n+start)

def ohio():
    src=source('ohio');names={'Aggravated Assault':'aggravated_assault','Arson':'arson','Burglary':'burglary','Manslaughter by Negligence':'negligent_manslaughter','Murder and Non-Negligent':'murder','Motor Vehicle Theft':'motor_vehicle_theft','Robbery':'robbery','Rape':'rape','Fondling':'fondling','Incest':'incest','Statutory Rape':'statutory_rape','Domestic Violence':'domestic_violence','Dating Violence':'dating_violence','Stalking':'stalking'}
    extracted=0
    for page in [61,62]:
        for n,line in enumerate(layout(src,page),1):
            m=re.fullmatch(r'(.+?) (202[234])(?: (Total))? ((?:\d+ ){4}\d+)',line)
            if not m or m[1] not in names:continue
            if m[1] in ['Rape','Fondling'] and m[3]!='Total':continue
            cat=names[m[1]];v=m[4].split();assert int(v[0])+int(v[1])==int(v[2])
            emit(src,'204796','204796001','Columbus',2025,int(m[2]),cat,[v[2],v[1],v[3],v[4]],page,n);extracted+=1
    assert extracted==42,extracted

def wisconsin():
    src=source('wisconsin');cats=['murder','negligent_manslaughter','robbery','aggravated_assault','burglary','motor_vehicle_theft','arson','rape','fondling','incest','statutory_rape']+VAWA
    for page,year in [(13,2024),(15,2023),(17,2022)]:
        lines=layout(src,page);start=lines.index('Criminal Offenses');rows=[]
        for n,l in enumerate(lines[start:],start+1):
            m=re.search(r' ((?:\d+ ){3}\d+)$',l)
            if m:rows.append((m[1].split(),n,page))
        if page in [15,17]:
            for n,l in enumerate(layout(src,page+1),1):
                m=re.search(r'^(?:Domestic Violence|Dating Violence|Stalking) ((?:\d+ ){3}\d+)$',l)
                if m:rows.append((m[1].split(),n,page+1))
        assert len(rows)==14,(page,len(rows))
        for cat,(v,n,p) in zip(cats,rows):emit(src,'240444','240444001','Madison',2025,year,cat,[v[0],v[1],v[3],v[2]],p,n)

def texas():
    src=source('ut');campuses=[(74,'228778001','Austin main'),(77,'228778002','J.J. Pickle Research Campus'),(79,'source:ut-brackenridge','Brackenridge Field Laboratory'),(81,'228778003','Marine Science Institute'),(83,'228778005','Winedale Historical Complex'),(85,'228778010','LBJ Washington Center'),(87,'228778011','UT in New York'),(89,'228778007','Wofford Denius UTLA Center')]
    with pdfplumber.open(ROOT/src['local_pdf']) as doc:
        for first,cid,name in campuses:
            for page,cats in [(first,CATS),(first+1,['dating_violence','domestic_violence','stalking'])]:
                words=doc.pages[page-1].extract_words();years=[w for w in words if w['text'] in ['2022','2023','2024'] and 175<w['x0']<220]
                assert len(years)>=len(cats)*3,(page,len(years))
                for i,cat in enumerate(cats):
                    for j,expected in enumerate([2024,2023,2022]):
                        y=years[i*3+j];assert int(y['text'])==expected,(page,cat,y)
                        vals=[]
                        for left,right in [(240,310),(330,400),(420,490),(510,580)]:
                            found=[w['text'] for w in words if left<w['x0']<right and abs(w['top']-y['top'])<3.5]
                            assert len(found)<=1,(page,expected,cat,found)
                            vals.append(found[0] if found else '')
                        emit(src,'228778',cid,name,2025,expected,cat,vals,page,f'y={y["top"]:.2f}')

def pennstate():
    cats=CATS[:5]+['statutory_rape']+CATS[6:]
    cats[4]='statutory_rape';cats[5]='incest'
    for key,cid,name in [('pennstate','214777001','University Park'),('pennstate-law','214777002','Dickinson Law'),('pennstate-med','214777003','Hershey College of Medicine')]:
        src=source(key)
        text=(ROOT/src['local_text']).read_text(encoding='utf-8')
        chunks=re.split(r'=== PDF PAGE (\d+) ===',text)
        page=next(int(chunks[j]) for j in range(1,len(chunks),2) if 'CRIME STATISTICS: CLERY DATA' in chunks[j+1] and 'Murder/' in chunks[j+1] and '2022' in chunks[j+1])
        with pdfplumber.open(ROOT/src['local_pdf']) as doc:
            i=page-1;p=doc.pages[i]
            tables=p.extract_tables();criminal=tables[0][3:];vawa=tables[1][1:]
            assert len(criminal)==11 and len(vawa)==3,(key,len(criminal),len(vawa))
            for cat,row in zip(cats+VAWA,criminal+vawa):
                assert len(row)==13,(key,row)
                for j,year in enumerate([2022,2023,2024]):
                    v=row[1+4*j:5+4*j]
                    emit(src,'214777',cid,name,2025,year,cat,[v[1],v[0],v[3],v[2]],i+1,row[0])

def unc():
    src=source('unc')
    configs=[('199120001','Chapel Hill main',[21,22,23],True),('199120003','Kenan-Flagler Business School Charlotte',[26,27,28],False),('199120002','Institute of Marine Sciences',[29,30,31],False)]
    for cid,name,pages,main in configs:
        rows=[]
        for p in pages:rows.extend((p,*r) for r in year_rows(layout(src,p),minimum=4 if main else 2))
        assert len(rows)>=40,(name,len(rows))
        cats=[cat for cat in CATS for _ in range(3)]+['domestic_violence']*3+['dating_violence']+['stalking']*3
        expected=[2025,2024,2023]*12+[2023]+[2025,2024,2023]
        assert len(cats)==40 and len(expected)==40
        for cat,y,(p,year,v,n,line) in zip(cats,expected,rows[:40]):
            assert year==y,(name,cat,year,y,line)
            vals=v[:4] if main else [v[0],'','',v[1]]
            emit(src,'199120',cid,name,2026,year,cat,vals,p,n)
            if cat=='domestic_violence' and year==2024:
                for r in records[-4:]:r['status']='combined_domestic_and_dating_violence'
    rows=[]
    for p in [32,33]:rows.extend((p,*r) for r in year_rows(layout(src,p),minimum=2))
    for cat,(p,year,v,n,line) in zip(CATS+['domestic_violence','stalking'],rows[:13]):
        assert year==2025 and len(v)==2
        emit(src,'199120','source:unc-mahec','UNC Health Sciences at MAHEC',2026,year,cat,[v[0],'','',v[1]],p,n)

if __name__=='__main__':
    gatech();washington();florida();michigan();illinois();ohio();wisconsin();texas();pennstate();unc()
    keys=[(r['institution_unitid'],r['campus_id'],r['category'],r['report_year'],r['geography']) for r in records];assert len(set(keys))==len(keys)
    out=ROOT/'current_core_counts.csv'
    with out.open('w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f,FIELDS);w.writeheader();w.writerows(records)
    print('Extracted',len(records),'cells for',len({r['campus_id'] for r in records}),'campuses')
