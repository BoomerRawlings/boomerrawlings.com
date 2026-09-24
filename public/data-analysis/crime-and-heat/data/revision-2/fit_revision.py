"""Reproduce the complete, frozen feedback-driven revision from public aggregates.

No record-level inputs. No model selection. Run with --panel and --metadata when
outside this source tree; --out selects a fresh output directory.
"""
from pathlib import Path
import os, sys, json, argparse, hashlib
for variable in ['OPENBLAS_NUM_THREADS','OMP_NUM_THREADS','MKL_NUM_THREADS']:
    os.environ[variable]='1'
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
if (ROOT/'_analysis_deps').exists():sys.path.insert(0,str(ROOT/'_analysis_deps'))
import numpy as np
import pandas as pd
from scipy import sparse,linalg
from scipy.stats import norm,chi2
from statsmodels.stats.multitest import multipletests

SPECIFICATIONS={
 'R00':'Original weather on the same revised ZIP sample',
 'R0':'Corrected civil-day reference',
 'R1':'Previous civil-day maximum',
 'R2':'Weather and holiday controls',
 'R3':'ZIP-specific annual seasonality',
 'R4':'Exclude warrant co-charges',
 'R5':'Combined controls and warrant exclusion',
 'R6':'Nonlinear temperature, combined specification',
 'R7':'Paired station sample, ERA5-Land maximum',
 'R8':'Paired station sample, NOAA maximum',
 'R9':'Civil-day duration offset',
}
ALL_DATES=pd.date_range('2021-01-01','2024-12-31',freq='D')

def spline_basis(temp_f,knots_f):
    x=(np.asarray(temp_f,dtype=float)-70)/10
    k=(np.asarray(knots_f,dtype=float)-70)/10
    columns=[x]
    for knot in k[:-2]:
        term=(np.maximum(x-knot,0)**3
          -np.maximum(x-k[-2],0)**3*(k[-1]-knot)/(k[-1]-k[-2])
          +np.maximum(x-k[-1],0)**3*(k[-2]-knot)/(k[-1]-k[-2]))/(k[-1]-k[0])**2
        columns.append(term)
    return np.column_stack(columns)

def indicator(values):
    levels=sorted(pd.unique(values))
    codes=pd.Categorical(values,categories=levels).codes
    keep=codes>0
    x=sparse.csr_matrix((np.ones(keep.sum()),(np.flatnonzero(keep),codes[keep]-1)),shape=(len(values),len(levels)-1))
    return x,levels[1:]

ANNUAL_SPECS={'R3','R5','R6','R7','R8'}

def separate_annual_zero_rows(d,outcome_col):
    """Certify an exact ZIP-local recession direction; preserve every event.

    If all positive counts occur at one annual phase, cos(phi-phi0)-1 is
    nonpositive everywhere and zero at every positive count. Its negative
    zero-count rows have extended-MLE mean zero. On the retained phase rows,
    that ZIP's sine/cosine columns are redundant with its intercept.
    """
    phase=2*np.pi*(d.date.dt.dayofyear.to_numpy()-1)/np.where(d.date.dt.is_leap_year,366,365)
    keep=np.ones(len(d),dtype=bool);redundant=set();certificates=[]
    for zipcode,idx in d.groupby('zip_code').indices.items():
        idx=np.asarray(idx)
        positive=d.iloc[idx][outcome_col].to_numpy()>0
        p0=phase[idx[positive]][0]
        difference=np.remainder(phase[idx]-p0+np.pi,2*np.pi)-np.pi
        same=np.abs(difference)<1e-12
        if same[positive].all():
            direction=np.cos(phase[idx]-p0)-1
            assert direction.max()<1e-12 and np.max(np.abs(direction[positive]))<1e-12
            removed=idx[~same]
            assert (d.iloc[removed][outcome_col]==0).all()
            assert (direction[~same]<-1e-12).all()
            keep[removed]=False;redundant.add(zipcode)
            certificates.append({'zip_code':zipcode,'positive_groups':int(d.iloc[idx][outcome_col].sum()),
                'zero_rows_removed':len(removed),'rows_retained':int(same.sum()),
                'max_recession_direction':float(direction.max()),
                'positive_direction_max_abs':float(np.max(np.abs(direction[positive])))})
    return d.loc[keep].reset_index(drop=True),redundant,certificates

def design(d,spec,knots,redundant_season_zips=None):
    n=len(d)
    temperature='legacy_temp_high_f' if spec=='R00' else 'prior_day_high_f' if spec=='R1' else 'noaa_high_f' if spec=='R8' else 'temp_high_f'
    exposure=spline_basis(d[temperature],knots) if spec=='R6' else ((d[temperature].to_numpy()-70)/10)[:,None]
    names=['intercept']+(['temperature_linear','temperature_rcs1','temperature_rcs2'] if spec=='R6' else ['temperature_10f'])
    blocks=[sparse.csr_matrix(np.ones((n,1))),sparse.csr_matrix(exposure)]
    if spec in ['R2','R5','R6','R7','R8']:
        controls=np.column_stack([d.federal_holiday_observed,np.log1p(d.precipitation_mm),d.relative_humidity_mean_pct/10])
        blocks.append(sparse.csr_matrix(controls))
        names+=['federal_holiday_observed','log1p_precipitation_mm','relative_humidity_10pct']
    for name,values in [('zip',d.zip_code),('year_month',d.date.dt.strftime('%Y-%m')),('weekday',d.date.dt.dayofweek)]:
        block,levels=indicator(values);blocks.append(block);names += [f'{name}={x}' for x in levels]
    if spec in ANNUAL_SPECS:
        redundant_season_zips=redundant_season_zips or set()
        zlabels=sorted(set(d.zip_code)-redundant_season_zips)
        zcode=pd.Categorical(d.zip_code,categories=zlabels).codes
        active=zcode>=0
        # Actual fraction through each calendar year, consistently handling leap years.
        phase=2*np.pi*(d.date.dt.dayofyear.to_numpy()-1)/np.where(d.date.dt.is_leap_year,366,365)
        for label,value in [('annual_sine',np.sin(phase)),('annual_cosine',np.cos(phase))]:
            blocks.append(sparse.csr_matrix((value[active],(np.flatnonzero(active),zcode[active])),shape=(n,len(zlabels))))
            names += [f'{label}:zip={z}' for z in zlabels]
    x=sparse.hstack(blocks,format='csr')
    offset=np.log(d.day_hours.to_numpy()/24) if spec=='R9' else np.zeros(n)
    return x,names,offset,temperature

def ratio_result(coef,se):
    z=coef/se
    return {'coefficient_log_count':float(coef),'standard_error':float(se),
        'count_ratio':float(np.exp(coef)),'ci95_low':float(np.exp(coef-norm.ppf(.975)*se)),
        'ci95_high':float(np.exp(coef+norm.ppf(.975)*se)),
        'percent_change':float(100*np.expm1(coef)),'two_sided_p':float(2*norm.sf(abs(z)))}

def fit_model(panel,spec,outcome,knots,outdir):
    strict=spec in ['R4','R5','R6','R7','R8']
    outcome_col=('strict_all' if outcome=='all' else 'strict_core') if strict else ('eligible_all_count' if outcome=='all' else 'core_count')
    d=panel[panel.station_paired].copy() if spec in ['R7','R8'] else panel.copy()
    initial_n=len(d)
    zero=d.groupby('zip_code')[outcome_col].sum().loc[lambda s:s.eq(0)].index
    d=d[~d.zip_code.isin(zero)].sort_values(['date','zip_code']).reset_index(drop=True)
    redundant=set();certificates=[]
    if spec in ANNUAL_SPECS:
        original_count=int(d[outcome_col].sum())
        d,redundant,certificates=separate_annual_zero_rows(d,outcome_col)
        assert d[outcome_col].sum()==original_count
    x,names,offset,temperature=design(d,spec,knots,redundant)
    y=d[outcome_col].to_numpy(float);n,k=x.shape
    beta=np.zeros(k);beta[0]=np.log(y.sum()/np.exp(offset).sum())
    def objective(b):
        eta=offset+x@b
        if eta.max()>700:return np.inf
        return float(np.exp(eta).sum()-y@eta)
    loss=objective(beta);converged=False
    for iteration in range(1,101):
        mu=np.exp(offset+x@beta)
        gradient=np.asarray(x.T@(mu-y)).ravel()
        hessian=(x.T@x.multiply(mu[:,None])).toarray()
        step=linalg.solve(hessian,gradient,assume_a='pos')
        scale=1.
        while scale>=2**-35:
            proposed=beta-scale*step;newloss=objective(proposed)
            if np.isfinite(newloss) and newloss<=loss+1e-8:break
            scale/=2
        if scale<2**-35:raise RuntimeError(f'Line search failed: {outcome}/{spec}')
        beta=proposed;loss=newloss
        if np.max(np.abs(scale*step))<1e-9:
            converged=True;break
    mu=np.exp(offset+x@beta);residual=y-mu
    hessian=(x.T@x.multiply(mu[:,None])).toarray()
    gradient=np.asarray(x.T@residual).ravel()
    implied=linalg.solve(hessian,gradient,assume_a='pos')
    assert converged and np.max(np.abs(implied))<1e-7,(outcome,spec,'unconverged')
    daycodes=pd.Categorical(d.date,categories=ALL_DATES).codes
    aggregate=sparse.csr_matrix((np.ones(n),(daycodes,np.arange(n))),shape=(len(ALL_DATES),n))
    scores=(aggregate@x.multiply(residual[:,None])).toarray()
    m=3 if spec=='R6' else 1
    selector=np.zeros((k,m));selector[np.arange(1,m+1),np.arange(m)]=1
    projection=linalg.solve(hessian,selector,assume_a='pos')
    influence=scores@projection
    def covariance(lag):
        meat=influence.T@influence
        for q in range(1,lag+1):
            cross=influence[q:].T@influence[:-q]
            meat+=(1-q/(lag+1))*(cross+cross.T)
        return meat*n/(n-k)
    cov=covariance(7);b=beta[1:m+1]
    assert np.linalg.eigvalsh(cov).min()>0
    daily_resid=np.asarray(aggregate@residual).ravel()
    result={'specification':spec,'label':SPECIFICATIONS[spec],'outcome':outcome,'outcome_column':outcome_col,
        'temperature_column':temperature,'status':'ok','event_count':int(y.sum()),'zip_days':n,
        'calendar_span_days':len(ALL_DATES),'dates_with_model_rows':d.date.nunique(),'zips':d.zip_code.nunique(),
        'initial_zip_days':initial_n,'zero_only_zips_dropped':len(zero),'zero_count_zip_days':int((y==0).sum()),
        'separated_zero_rows_removed':sum(c['zero_rows_removed'] for c in certificates),
        'separation_certificates':certificates,'redundant_annual_columns_removed':2*len(redundant),
        'parameters':k,'iterations':iteration,'max_abs_score':float(np.max(np.abs(gradient))),
        'max_implied_coefficient_step':float(np.max(np.abs(implied))),
        'pearson_dispersion':float(np.sum(residual**2/mu)/(n-k)),
        'observed_zero_fraction':float(np.mean(y==0)),
        'poisson_expected_zero_fraction':float(np.mean(np.exp(-mu))),
        'daily_residual_acf1':float(pd.Series(daily_resid).autocorr(1)),
        'daily_residual_acf7':float(pd.Series(daily_resid).autocorr(7)),
        'hac_lag_days':7,'elapsed_hours_offset':spec=='R9',
        'sample_sha256':hashlib.sha256(pd.util.hash_pandas_object(d[['zip_code','date']],index=False).to_numpy().tobytes()).hexdigest()}
    tests=[];curves=[];bands=[]
    if spec!='R6':
        result.update(ratio_result(b[0],np.sqrt(cov[0,0])))
        tests.append({'test_id':f'{outcome}_{spec}','outcome':outcome,'specification':spec,'hypothesis':'linear_temperature','p_raw':result['two_sided_p']})
        if spec in ['R0','R5']:
            for lag in [7,14,28]:
                bands.append({'outcome':outcome,'specification':spec,'hac_lag_days':lag,**ratio_result(b[0],np.sqrt(covariance(lag)[0,0]))})
    else:
        for label,indices in [('joint_temperature',[0,1,2]),('nonlinearity',[1,2])]:
            sub=b[indices];subcov=cov[np.ix_(indices,indices)]
            w=float(sub@linalg.solve(subcov,sub,assume_a='pos'))
            p=float(chi2.sf(w,len(indices)))
            result[label+'_wald']=w;result[label+'_df']=len(indices);result[label+'_p']=p
            tests.append({'test_id':f'{outcome}_{spec}_{label}','outcome':outcome,'specification':spec,'hypothesis':label,'p_raw':p})
        bounds=np.quantile(panel.temp_high_f,[.01,.99])
        fixed=np.array([50,60,70,80,90,100])
        fixed=fixed[(fixed>=bounds[0])&(fixed<=bounds[1])]
        points=np.unique(np.r_[np.linspace(bounds[0],bounds[1],81),fixed])
        reference=spline_basis([70],knots)[0]
        for t in points:
            c=spline_basis([t],knots)[0]-reference
            estimate=float(c@b);se=float(np.sqrt(max(0,c@cov@c)))
            curves.append({'outcome':outcome,'temperature_f':float(t),'reference_f':70,
                'count_ratio':float(np.exp(estimate)),'ci95_low':float(np.exp(estimate-norm.ppf(.975)*se)),
                'ci95_high':float(np.exp(estimate+norm.ppf(.975)*se)),
                'within_pooled_1_99pct':bool(bounds[0]<=t<=bounds[1]),'interval':'pointwise nominal 95%; exploratory'})
        result['temperature_coefficients']=b.tolist();result['temperature_covariance_hac7']=cov.tolist()
    diagnostics=pd.DataFrame({'predicted_mean':mu,'observed_zero':y==0,'expected_zero':np.exp(-mu)})
    diagnostics['predicted_mean_stratum']=pd.qcut(mu,5,duplicates='drop')
    calibration=diagnostics.groupby('predicted_mean_stratum',observed=True).agg(
        zip_days=('predicted_mean','size'),predicted_mean=('predicted_mean','mean'),
        observed_zero_fraction=('observed_zero','mean'),poisson_expected_zero_fraction=('expected_zero','mean')).reset_index()
    calibration.to_csv(outdir/f'{outcome}_{spec}_zero_diagnostics.csv',index=False)
    np.savez_compressed(outdir/f'{outcome}_{spec}_fit.npz',beta=beta,names=np.array(names),
        temperature_covariance=cov,temperature_daily_influence=influence,
        observed_by_day=np.asarray(aggregate@y).ravel(),fitted_by_day=np.asarray(aggregate@mu).ravel())
    return result,tests,curves,bands

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--panel',type=Path,default=HERE/'analysis_panel.csv.gz')
    parser.add_argument('--metadata',type=Path,default=HERE/'panel_metadata.json')
    parser.add_argument('--out',type=Path,default=HERE/'results')
    parser.add_argument('--specs',default=','.join(SPECIFICATIONS))
    parser.add_argument('--outcomes',default='all,core')
    args=parser.parse_args();args.out.mkdir(parents=True,exist_ok=True)
    panel=pd.read_csv(args.panel,dtype={'zip_code':str},parse_dates=['date'])
    metadata=json.loads(args.metadata.read_text())
    assert hashlib.sha256(args.panel.read_bytes()).hexdigest()==metadata['panel_sha256']
    panel.station_paired=panel.station_paired.astype(str).str.lower().eq('true')
    knots=metadata['spline_knots_f']
    results=[];tests=[];curves=[];bands=[]
    for outcome in args.outcomes.split(','):
        for spec in args.specs.split(','):
            print(f'Fitting {outcome}/{spec}',flush=True)
            result,t,c,b=fit_model(panel,spec,outcome,knots,args.out)
            results.append(result);tests+=t;curves+=c;bands+=b
            (args.out/'progress.json').write_text(json.dumps(results,indent=2)+'\n')
            print(json.dumps(result),flush=True)
    complete=len(results)==22 and len(tests)==24
    tests=pd.DataFrame(tests)
    if complete:tests['p_holm_revision_family']=multipletests(tests.p_raw,method='holm')[1]
    tests.to_csv(args.out/'revision_tests.csv',index=False)
    for r in results:
        matches=tests[(tests.outcome==r['outcome'])&(tests.specification==r['specification'])]
        r['hypothesis_tests']=matches.to_dict('records')
    pd.DataFrame([{k:v for k,v in r.items() if not isinstance(v,(list,dict))} for r in results]).to_csv(args.out/'revision_models.csv',index=False)
    pd.DataFrame(curves).to_csv(args.out/'nonlinear_curves.csv',index=False)
    pd.DataFrame(bands).to_csv(args.out/'hac_sensitivities.csv',index=False)
    payload={'schema_version':'2.0','revision':'2026-09-24 methodological amendment','complete_battery':complete,
        'analysis_type':'retrospective feedback-driven sensitivity analysis; not preregistered',
        'models':results,'tests':tests.to_dict('records'),'spline_knots_f':knots,
        'hac_sensitivities':bands,'panel_metadata':metadata,
        'multiplicity':'Holm across24 revision tests spanning both outcomes, including paired legacy-weather comparisons; original full-sample families archived separately; intervals individually95%',
        'model_definition':'Poisson log mean; ZIP/year-month/weekday effects; daily-score Bartlett HAC7 withN/(N-K); all1461score dates retained; normal intervals',
        'script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    (args.out/'revision_results.json').write_text(json.dumps(payload,indent=2,allow_nan=False)+'\n')
    print(json.dumps({'complete_battery':complete,'models':len(results),'tests':len(tests)}),flush=True)

if __name__=='__main__':main()
