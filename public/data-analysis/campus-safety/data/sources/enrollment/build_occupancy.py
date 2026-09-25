"""Reproduce the visually verified State Auditor housing-table transcription.

These are actual enrolled-student occupants, not housing capacity. Property-level
correspondence with Clery residential geography has NOT been established.
"""
from pathlib import Path
import csv, hashlib, json
ROOT=Path(__file__).resolve().parent
SOURCE='https://www.auditor.ca.gov/wp-content/uploads/2025/10/2024-111-Report.pdf'
# Table A.1 printed pp.56-57 (PDF pp.62-63), and Table A.2 pp.58-59
# (PDF pp.64-65). Each tuple is (fall enrollment, actual housing occupancy),
# left to right for academic years 2019-20 through 2024-25.
TABLES={
'UC Berkeley':[(43185,9275),(42327,3296),(45036,9264),(45307,9695),(45699,9905),(45882,10862)],
'UC Davis':[(38634,10848),(39074,5926),(40050,14080),(39679,13608),(39707,14081),(40065,15024)],
'UC Irvine':[(36908,14025),(36303,8061),(36505,15373),(35937,16455),(36582,17675),(37297,17695)],
'UCLA':[(44371,18713),(44589,4461),(46116,19791),(46430,22519),(46678,23680),(47335,24202)],
'UC Merced':[(8847,3417),(9018,391),(9093,3806),(9103,4086),(9147,4179),(9110,4077)],
'UC Riverside':[(25547,6532),(26434,2385),(26847,8295),(26809,8493),(26426,8428),(26384,8465)],
'UC San Diego':[(38736,14599),(39576,10099),(41885,17596),(42006,17906),(42376,18906),(44256,21907)],
'UC San Francisco':[(3180,966),(3201,741),(3165,752),(3140,738),(3126,754),(3007,832)],
'UC Santa Barbara':[(26314,10171),(26179,2048),(26124,10390),(26420,10221),(26068,10128),(26133,10286)],
'UC Santa Cruz':[(19494,8918),(19161,937),(19841,8987),(19478,9168),(19764,9313),(19938,8888)],
'San Diego State':[(35081,6806),(35578,2553),(35732,6025),(36637,7919),(37538,8100),(39373,8367)],
}
UC_TOTALS=[(285216,97464),(285862,38345),(294662,108334),(294309,112889),(295573,117049),(299407,122238)]

def writecsv(name,rows):
    with (ROOT/name).open('w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)

def main():
    cohort=list(csv.DictReader((ROOT/'institution_crosswalk_verified.csv').open(encoding='utf-8')))
    names={r['label']:r for r in cohort};rows=[]
    for i, expected in enumerate(UC_TOTALS):
        actual=tuple(sum(values[i][j] for label,values in TABLES.items() if label!='San Diego State') for j in (0,1))
        assert actual==expected,(2019+i,actual,expected)
    for label,values in TABLES.items():
        c=names[label];is_uc=label!='San Diego State'
        for i,(enrollment,occupancy) in enumerate(values):
            year=2019+i;page=(56 if is_uc else 58)+(year>=2022)
            assert 0<occupancy<enrollment
            rows.append({'unitid':c['unitid'],'opeid':c['opeid'],'label':label,'year':year,'academic_year':f'{year}-{str(year+1)[-2:]}',
                'fall_enrollment_auditor':enrollment,'actual_student_housing_occupancy':occupancy,
                'denominator_type':'actual enrolled-student housing occupancy','source_table':'A.1' if is_uc else 'A.2',
                'printed_page':page,'pdf_page':page+6,'source_url':SOURCE,
                'source_agency':'California State Auditor','source_report':'2024-111 (October 2025)',
                'geographic_match_status':'approximate_unverified',
                'geography_warning':'Auditor campus-housing inventory has not been matched property by property to Clery on-campus student-housing boundaries or branch campuses.',
                'time_warning':'Fall/academic-year occupancy snapshot; not annual resident person-time.',
                'numerator_warning':'Clery residential counts are reported offenses on covered housing property; victims need not be enrolled residents.',
                'capacity_used':False})
    writecsv('occupancy_auditor_2019_2024.csv',rows)
    primary=[r for r in rows if r['year']>=2022];writecsv('occupancy_2022_2024.csv',primary)
    availability=[]
    for c in cohort:
        for year in (2022,2023,2024):
            found=next((r for r in primary if r['unitid']==c['unitid'] and r['year']==year),None)
            availability.append({'unitid':c['unitid'],'label':c['label'],'year':year,
              'actual_student_housing_occupancy':found['actual_student_housing_occupancy'] if found else None,
              'status':'actual_occupancy_found_geography_unverified' if found else 'not_sourced',
              'reason':'Actual occupants documented; Clery property correspondence not established.' if found else 'No verified actual all-student housing-occupancy source acquired in this bounded source pass; blank is not zero.'})
    writecsv('occupancy_availability_2022_2024.csv',availability)
    enrollment={(r['unitid'],int(r['year'])):r for r in csv.DictReader((ROOT/'enrollment_2022_2024.csv').open())}
    comparisons=[]
    for r in primary:
        value=int(enrollment[(r['unitid'],r['year'])]['fall_headcount_total'])
        comparisons.append({'unitid':r['unitid'],'label':r['label'],'year':r['year'],
            'fall_enrollment_auditor':r['fall_enrollment_auditor'],'fall_enrollment_ipeds':value,
            'auditor_minus_ipeds':r['fall_enrollment_auditor']-value,
            'interpretation':'Separate source scopes/vintages retained; occupancy is not inferred from either enrollment series.'})
    writecsv('auditor_ipeds_enrollment_comparison.csv',comparisons)
    source_sha=json.loads((ROOT/'housing_source_manifest.json').read_text())['2024-111-Report.pdf']['sha256']
    if (ROOT/'raw/2024-111-Report.pdf').exists():
        assert hashlib.sha256((ROOT/'raw/2024-111-Report.pdf').read_bytes()).hexdigest()==source_sha
    audit={'source_url':SOURCE,'pdf_sha256':source_sha,
      'transcription':'Manually transcribed from rendered official tables; all UC annual enrollment and occupancy sums checked against printed system totals.',
      'source_printed_pages':[56,57,58,59],'source_pdf_pages':[62,63,64,65],
      'all_rows':len(rows),'primary_rows':len(primary),'primary_institutions':11,'primary_not_sourced_institutions':31,
      'uc_totals_all_six_years_reconciled':True,'clery_property_matches_verified':False,
      'auditor_ipeds_enrollment_mismatches':sum(r['auditor_minus_ipeds']!=0 for r in comparisons),
      'ucsd_2024_actual_occupancy':21907,'sdsu_2024_actual_occupancy':8367}
    (ROOT/'occupancy_provenance.json').write_text(json.dumps(audit,indent=2)+'\n')
    print(json.dumps(audit,indent=2))

if __name__=='__main__':main()
