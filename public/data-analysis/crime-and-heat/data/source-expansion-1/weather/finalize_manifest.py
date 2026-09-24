"""Write a portable curated-artifact manifest after successful verification."""
from pathlib import Path
import datetime as dt,hashlib,json
ROOT=Path(__file__).resolve().parent

def main():
    verification=json.loads((ROOT/'verification.json').read_text())
    assert verification['status']=='PASS'
    summary=json.loads((ROOT/'comparison_summary.json').read_text())
    raw=json.loads((ROOT/'raw_manifest.json').read_text())
    provenance={'schema_version':'1.0','created_utc':dt.datetime.now(dt.timezone.utc).isoformat(),'status':'verified_observational_supplement_no_outcome_refits',
      'source_products':['NOAA NCEI GHCN-Daily','NOAA NCEI full Integrated Surface Database'],
      'ghcn_period':['1991-01-01','2025-12-31'],'isd_civil_period':['2021-01-01','2024-12-31'],'timezone_for_isd':'America/Los_Angeles',
      'ghcn_quality_rule':'Nonblank QFLAG excluded separately for each element; source/MFLAG retained.',
      'isd_quality_rule':'Accept air-temperature flags 1,5,C and documented instantaneous report types; no missing-temperature imputation.',
      'isd_sample_rule':'One original accepted observation per UTC clock hour, closest to minute 30; daily aggregates only when every civil-day hour is present.',
      'baseline_rule':'1991-2020 May-September pooled p90/p95, type 7 interpolation; >=90% total days and >=25 years each >=90% coverage. Exploratory, not official climate normals or calendar-day percentiles.',
      'day_mean_definitions':{'ghcn_reported_tavg_f':'Source-reported average; none valid in primary period. No substitution.','ghcn_tmax_tmin_midpoint_f':'Explicit calculated midpoint, not observed daily mean.','isd_temp_mean_f':'Arithmetic mean of the 23/24/25 selected hourly temperatures; exact original timestamp determines civil date.'},
      'assignment_rule':summary['assignment_rule'],'coverage':summary['coverage'],'comparison_limits':summary['comparison_limits'],
      'baseline_eligible_stations':summary['baseline_eligible_stations'],'raw_files':len(raw),'raw_total_bytes':sum(v['bytes'] for v in raw.values()),
      'public_reproduction':'Curated data and reproduction_inputs reproduce paired metrics offline. Full raw replay requires original NOAA byte-identical archives, omitted from the compact public package. Downloads fail on hash changes.',
      'source_links':{'GHCN_dataset':'https://doi.org/10.7289/V5D21VHZ','GHCN_format':'https://www.ncei.noaa.gov/pub/data/ghcn/daily/readme.txt','GHCN_inventory':'https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-inventory.txt','ISD_dataset':'https://www.ncei.noaa.gov/products/land-based-station/integrated-surface-database','ISD_format':'https://www.ncei.noaa.gov/pub/data/noaa/isd-format-document.pdf','ISD_station_history':'https://www.ncei.noaa.gov/pub/data/noaa/isd-history.csv','ISD_Lite_limitations':'https://www.ncei.noaa.gov/pub/data/noaa/isd-lite/isd-lite-technical-document.pdf','ERA5_Land_indirect_observational_influence':'https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land?tab=overview'}}
    (ROOT/'dataset_provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
    artifacts={}
    for path in sorted(ROOT.rglob('*')):
        if not path.is_file() or any(p in ('raw','__pycache__') for p in path.relative_to(ROOT).parts) or path.name=='artifact_manifest.json':continue
        data=path.read_bytes();artifacts[path.relative_to(ROOT).as_posix()]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
    (ROOT/'artifact_manifest.json').write_text(json.dumps(artifacts,indent=2)+'\n')
    print(json.dumps({'curated_files':len(artifacts),'curated_bytes':sum(x['bytes'] for x in artifacts.values()),'raw_files':len(raw),'raw_bytes':provenance['raw_total_bytes']}))

if __name__=='__main__':main()
