from pathlib import Path
import csv,json,hashlib
R=Path(__file__).resolve().parent
P=R/'ivy_northeast/princeton_2026_core_counts.csv'
rows=list(csv.DictReader(P.open(encoding='utf8')))
# Independently read from rendered PDF50–53; column order C,H,N,P and years2025,2024,2023.
nonzero={
'rape':[[6,4,0,0],[8,3,2,0],[6,5,0,0]],
'fondling':[[3,3,0,0],[2,1,4,0],[0,0,1,0]],
'robbery':[[2,0,0,0],[0,0,0,1],[0,0,0,0]],
'aggravated_assault':[[0,0,0,0],[2,0,1,0],[1,1,0,0]],
'burglary':[[7,3,0,0],[4,3,0,0],[8,4,2,0]],
'motor_vehicle_theft':[[37,0,1,0],[46,0,1,0],[36,0,0,0]],
'dating_violence':[[2,2,0,0],[6,4,0,0],[0,0,0,0]],
'domestic_violence':[[0,0,1,0],[0,0,1,0],[4,3,0,0]],
'stalking':[[7,0,1,0],[7,0,0,0],[3,0,0,0]]}
errors=[]
for r in rows:
 expected=nonzero.get(r['category'],[[0]*4]*3)[2025-int(r['report_year'])][['oncampus','residential','noncampus','publicproperty'].index(r['geography'])] if r['campus_id']=='186131001' else 0
 if int(r['count'])!=expected:errors.append(r)
result={'status':'PASS' if not errors else 'FAIL','method':'Independent manual transcription of all four rendered current tables,PDF50–53. Uses visible2023–2025 layer; no import of producer extractor. All336core geography cells compared.','checked_cells':len(rows),'manual_nonzero_category_controls':nonzero,'errors':errors,'input_sha256':hashlib.sha256(P.read_bytes()).hexdigest(),'auditor_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
(R/'INDEPENDENT_PRINCETON_VISUAL_AUDIT.json').write_text(json.dumps(result,indent=2)+'\n')
print(result['status'],len(rows),len(errors))
