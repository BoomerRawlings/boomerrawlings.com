"""Extract only public cohort aggregate rows required for standalone reproduction."""
from pathlib import Path
import csv,gzip,hashlib,io,json
from build_denominators import load
ROOT=Path(__file__).resolve().parent
DEST=ROOT/'reproduction_inputs'
FIELDS={
 'HD':['UNITID','OPEID','INSTNM','CITY','STABBR','UGOFFER','GROFFER','HOSPITAL','MEDICAL'],
 'EF':['UNITID','EFALEVEL','EFTOTLT','XEFTOTLT'],
 'DIST':['UNITID','EFDELEV','EFDETOT','EFDEEXC','EFDESOM','EFDENON','XEFDEEXC','XEFDESOM'],
 'DRV':['UNITID','ENRTOT','FTE','ENRFT','ENRPT','EFUG','EFGRAD'],
}
def main():
    DEST.mkdir(exist_ok=True)
    ids={r['unitid'] for r in csv.DictReader((ROOT/'cohort_definition.csv').open())};manifest={}
    for year in (2022,2023,2024):
        for table,kind in [(f'HD{year}','HD'),(f'EF{year}A','EF'),(f'EF{year}A_DIST','DIST'),(f'DRVEF{year}','DRV')]:
            rows,source=load(table)
            rows=[{k:r[k] for k in FIELDS[kind]} for r in rows if r['UNITID'] in ids and r.get('EFALEVEL','1')=='1' and r.get('EFDELEV','1')=='1']
            assert len(rows)==42
            text=io.StringIO(newline='');w=csv.DictWriter(text,fieldnames=FIELDS[kind]);w.writeheader();w.writerows(rows)
            blob=gzip.compress(text.getvalue().encode(),mtime=0);name=table+'_cohort.csv.gz';(DEST/name).write_bytes(blob)
            manifest[table]={'file':name,'rows':len(rows),'sha256':hashlib.sha256(blob).hexdigest(),'upstream':source,'selection':'Frozen 42 UNITIDs; total level1 for enrollment tables; only required aggregate fields.'}
    (DEST/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('Saved12 verified cohort tables for offline reproduction.')
if __name__=='__main__':main()
