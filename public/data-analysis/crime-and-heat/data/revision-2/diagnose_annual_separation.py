"""Certify a specific Poisson separation mechanism, using public aggregates only.

No coefficients are fitted and no production inputs are changed. A rational
annual-phase comparison avoids an outcome-count threshold or angular tolerance.
"""
from pathlib import Path
import argparse
from fractions import Fraction
import hashlib
import json
import sys

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--panel',type=Path,required=True)
p.add_argument('--out',type=Path,default=Path(__file__).parent/'separation_diagnostic')
p.add_argument('--deps',type=Path)
a=p.parse_args()
if a.deps:sys.path.insert(0,str(a.deps.resolve()))
import numpy as np
import pandas as pd
d=pd.read_csv(a.panel,dtype={'zip_code':str},parse_dates=['date'])
d.station_paired=d.station_paired.astype(str).str.lower().eq('true')
d['phase_fraction']=[Fraction(int(day)-1,366 if leap else 365) for day,leap in zip(d.date.dt.dayofyear,d.date.dt.is_leap_year)]
records=[]
for sample in ['full','station_paired']:
    data=d if sample=='full' else d[d.station_paired]
    for outcome in ['eligible_all_count','core_count','strict_all','strict_core']:
        for zipcode,g in data.groupby('zip_code'):
            positive=g[g[outcome]>0]
            if positive.empty:continue
            phases=set(positive.phase_fraction)
            if len(phases)!=1:continue
            phase=next(iter(phases))
            retained=g.phase_fraction.eq(phase)
            direction=np.cos(2*np.pi*(np.asarray(g.phase_fraction,dtype=float)-float(phase)))-1
            assert np.max(direction)<=1e-14
            assert np.max(np.abs(direction[g[outcome].to_numpy()>0]))<1e-14
            assert (g.loc[~retained,outcome]==0).all()
            if retained.all():continue
            assert np.max(direction[~retained.to_numpy()])<0
            records.append({'sample':sample,'outcome':outcome,'zip_code':zipcode,
                'outcome_count':int(g[outcome].sum()),'positive_dates':len(positive),
                'exact_phase':str(phase),'original_rows':len(g),'retained_phase_rows':int(retained.sum()),
                'certified_separated_zero_rows':int((~retained).sum()),
                'largest_direction_on_dropped_rows':float(np.max(direction[~retained.to_numpy()])),
                'smallest_direction_on_dropped_rows':float(np.min(direction[~retained.to_numpy()])),
                'positive_direction_max_absolute':float(np.max(np.abs(direction[g[outcome].to_numpy()>0])))})
a.out.mkdir(parents=True,exist_ok=True)
pd.DataFrame(records).to_csv(a.out/'certified_annual_phase_separation.csv',index=False)
payload={'panel_sha256':hashlib.sha256(a.panel.read_bytes()).hexdigest(),
    'certificate':'For ZIP z, v(t)=cos(phase(t)-phase_positive)-1. Nonpositive everywhere, zero on every positive outcome, strictly negative on removed zero rows.',
    'records':records,
    'scope':'Detects this certified one-phase separation mechanism only; not a general certificate that no other separating direction exists. Reduced fit still requires convergence/rank checks.'}
(a.out/'diagnostic.json').write_text(json.dumps(payload,indent=2)+'\n')
print(json.dumps(payload,indent=2))
