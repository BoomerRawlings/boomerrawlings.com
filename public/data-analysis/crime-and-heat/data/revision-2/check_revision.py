"""Independent numerical review of the frozen revision; aggregate inputs only.

Does not import the production fitting or preparation scripts. Reconstructs
designs separately, computes the full sandwich (not projected-score covariance),
and refits both R0 models with ZIP-conditioned likelihood and BFGS/MINPACK.
Run only after the production battery is complete. Never changes its outputs.
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import sys
from fractions import Fraction

for variable in ('OPENBLAS_NUM_THREADS', 'OMP_NUM_THREADS', 'MKL_NUM_THREADS'):
    os.environ[variable] = '1'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--panel', type=Path, required=True)
    parser.add_argument('--results', type=Path, required=True)
    parser.add_argument('--out', type=Path, default=Path(__file__).parent/'numerical_validation')
    parser.add_argument('--deps', type=Path)
    args = parser.parse_args()
    if args.deps:
        sys.path.insert(0, str(args.deps.resolve()))

    import numpy as np
    import pandas as pd
    import scipy
    from scipy import sparse, linalg, optimize
    from scipy.interpolate import CubicSpline
    from scipy.special import logsumexp
    from scipy.stats import norm, chi2
    import statsmodels
    from statsmodels.discrete.conditional_models import ConditionalPoisson
    from statsmodels.stats.sandwich_covariance import S_hac_simple

    args.out.mkdir(parents=True, exist_ok=True)
    panel = pd.read_csv(args.panel, dtype={'zip_code': str}, parse_dates=['date'])
    panel['station_paired'] = panel.station_paired.astype(str).str.lower().eq('true')
    assert not panel.duplicated(['zip_code', 'date']).any()
    assert panel.zip_code.nunique() == 64
    assert len(panel) == 64*1461
    assert panel.groupby('zip_code').size().eq(1461).all()
    assert (panel[['eligible_all_count', 'core_count', 'strict_all', 'strict_core']] >= 0).all().all()
    assert (panel.strict_all <= panel.eligible_all_count).all()
    assert (panel.strict_core <= panel.core_count).all()
    assert (panel.strict_core <= panel.strict_all).all()
    dates = pd.date_range('2021-01-01', '2024-12-31')
    assert set(panel.date) == set(dates)

    # Refit before loading the reported coefficients; no production starting values.
    conditional_checks = []
    for outcome, col in [('all', 'eligible_all_count'), ('core', 'core_count')]:
        d = panel[panel.groupby('zip_code')[col].transform('sum').gt(0)].sort_values(['zip_code', 'date']).reset_index(drop=True)
        y = d[col].to_numpy(float)
        codes, zips = pd.factorize(d.zip_code, sort=True)
        cal = pd.concat([pd.get_dummies(d.date.dt.strftime('%Y-%m'), drop_first=True, dtype=float),
                         pd.get_dummies(d.date.dt.dayofweek, drop_first=True, dtype=float)], axis=1)
        x = np.column_stack([(d.temp_high_f.to_numpy()-70)/10, cal])
        model = ConditionalPoisson(y, x, groups=codes)
        scale = float(y.sum())
        fitted = optimize.minimize(lambda b:-model.loglike(b)/scale, np.zeros(x.shape[1]),
            jac=lambda b:-model.score(b)/scale, method='BFGS', options={'gtol':1e-11, 'maxiter':700})
        polished = optimize.root(lambda b:model.score(b)/scale, fitted.x, method='hybr', options={'xtol':1e-9})
        b = polished.x
        eta = x@b
        intercepts = np.array([np.log(y[codes == z].sum())-logsumexp(eta[codes == z]) for z in range(len(zips))])
        mu = np.exp(eta+intercepts[codes])
        z = sparse.csr_matrix((np.ones(len(y)), (np.arange(len(y)), codes)), shape=(len(y), len(zips)))
        full = sparse.hstack([z, sparse.csr_matrix(x)], format='csr')
        h = (full.T@full.multiply(mu[:, None])).toarray()
        bread = linalg.inv(h)
        residual = y-mu
        step = bread@np.asarray(full.T@residual).ravel()
        assert np.max(np.abs(step)) < 1e-8
        t = (d.date-dates[0]).dt.days.to_numpy()
        aggregate = sparse.csr_matrix((np.ones(len(y)), (t, np.arange(len(y)))), shape=(1461, len(y)))
        scores = (aggregate@full.multiply(residual[:, None])).toarray()
        cov = bread@S_hac_simple(scores, nlags=7)@bread*len(y)/(len(y)-full.shape[1])
        se = float(np.sqrt(cov[len(zips), len(zips)]))
        conditional_checks.append({'outcome':outcome, 'coefficient':float(b[0]), 'se_hac7':se,
            'max_abs_score':float(np.max(np.abs(full.T@residual))),
            'max_implied_step':float(np.max(np.abs(step))), 'bfgs_success':bool(fitted.success),
            'bfgs_message':str(fitted.message), 'score_polish_success':bool(polished.success),
            'counts':int(y.sum()), 'zips':len(zips), 'zip_days':len(y)})
        print(json.dumps({'independent_R0_completed':outcome, 'score_polish_success':bool(polished.success)}), flush=True)
        del full, x, model, h, bread, scores, cov, cal

    payload = json.loads((args.results/'revision_results.json').read_text())
    assert payload['complete_battery'] is True
    assert hashlib.sha256(args.panel.read_bytes()).hexdigest() == payload['panel_metadata']['panel_sha256']
    reported = {(m['outcome'], m['specification']):m for m in payload['models']}
    assert set(reported) == {(o, s) for o in ['all', 'core'] for s in ['R00']+[f'R{s}' for s in range(10)]}
    for result in conditional_checks:
        r = reported[(result['outcome'], 'R0')]
        result['coefficient_absolute_difference'] = abs(result['coefficient']-r['coefficient_log_count'])
        result['se_absolute_difference'] = abs(result['se_hac7']-r['standard_error'])
        assert result['coefficient_absolute_difference'] < 1e-6
        assert result['se_absolute_difference'] < 1e-7
    pd.DataFrame(conditional_checks).to_csv(args.out/'conditional_primary_replication.csv', index=False)

    knots = np.asarray(payload['spline_knots_f'], float)
    assert np.allclose(knots, np.quantile(panel.temp_high_f, [.05,.35,.65,.95]), rtol=0, atol=1e-10)
    # Independently evaluate the same natural-spline functions via interpolation.
    # Specify their values at the knots only; CubicSpline determines the cubic
    # pieces and natural boundary constraints, then extend both tails linearly.
    k = (knots-70)/10
    knot_values = [k]
    for j in [0,1]:
        knot_values.append(((np.clip(k-k[j], 0, None)**3)
            -(k[-1]-k[j])/(k[-1]-k[-2])*np.clip(k-k[-2], 0, None)**3
            +(k[-2]-k[j])/(k[-1]-k[-2])*np.clip(k-k[-1], 0, None)**3)/(k[-1]-k[0])**2)
    splines = [CubicSpline(k, v, bc_type='natural') for v in knot_values]

    def independent_basis(temp):
        values = (np.asarray(temp, float)-70)/10
        cols = []
        for s in splines:
            y = s(np.clip(values, k[0], k[-1]))
            y += np.minimum(values-k[0], 0)*s(k[0], 1)
            y += np.maximum(values-k[-1], 0)*s(k[-1], 1)
            cols.append(y)
        return np.column_stack(cols)

    def make_design(d, spec, phase_saturated_zips):
        exposure = 'legacy_temp_high_f' if spec == 'R00' else 'prior_day_high_f' if spec == 'R1' else 'noaa_high_f' if spec == 'R8' else 'temp_high_f'
        mat = independent_basis(d[exposure]) if spec == 'R6' else ((d[exposure].to_numpy()-70)/10)[:,None]
        blocks = [sparse.csr_matrix(np.ones((len(d),1))), sparse.csr_matrix(mat)]
        names = ['intercept']+(['temperature_linear','temperature_rcs1','temperature_rcs2'] if spec=='R6' else ['temperature_10f'])
        if spec in ['R2','R5','R6','R7','R8']:
            controls = np.column_stack([d.federal_holiday_observed, np.log1p(d.precipitation_mm), d.relative_humidity_mean_pct/10])
            blocks.append(sparse.csr_matrix(controls))
            names += ['federal_holiday_observed','log1p_precipitation_mm','relative_humidity_10pct']
        for label, values in [('zip',d.zip_code), ('year_month',d.date.dt.strftime('%Y-%m')), ('weekday',d.date.dt.dayofweek)]:
            dummy = pd.get_dummies(values, drop_first=True, sparse=True, dtype=float)
            blocks.append(dummy.sparse.to_coo().tocsr())
            names += [f'{label}={c}' for c in dummy.columns]
        if spec in ['R3','R5','R6','R7','R8']:
            dummy = pd.get_dummies(d.zip_code, sparse=True, dtype=float)
            dummy = dummy.drop(columns=phase_saturated_zips)
            z = dummy.sparse.to_coo().tocsr()
            phase = (d.date.dt.dayofyear.to_numpy()-1)*2*np.pi/np.where(d.date.dt.is_leap_year,366,365)
            for name, func in [('annual_sine',np.sin),('annual_cosine',np.cos)]:
                blocks.append(z.multiply(func(phase)[:,None]))
                names += [f'{name}:zip={c}' for c in dummy.columns]
        offset = np.log(d.day_hours.to_numpy()/24) if spec == 'R9' else np.zeros(len(d))
        return sparse.hstack(blocks, format='csr'), names, offset

    checks = []
    covariance_comparisons = []
    regenerated_tests = []
    zero_strata = []
    for (outcome,spec), report in reported.items():
        strict = spec in ['R4','R5','R6','R7','R8']
        col = ('strict_all' if outcome == 'all' else 'strict_core') if strict else ('eligible_all_count' if outcome == 'all' else 'core_count')
        d = panel.loc[panel.station_paired].copy() if spec in ['R7','R8'] else panel.copy()
        d = d[d.groupby('zip_code')[col].transform('sum').gt(0)].sort_values(['zip_code','date']).reset_index(drop=True)
        phase_saturated_zips=[]
        certified_removed=0
        if spec in ['R3','R5','R6','R7','R8']:
            phases=pd.Series([Fraction(int(day)-1,366 if leap else 365) for day,leap in zip(d.date.dt.dayofyear,d.date.dt.is_leap_year)],index=d.index)
            remove=pd.Series(False,index=d.index)
            for zipcode,g in d.groupby('zip_code'):
                positive_phases=set(phases.loc[g.index[g[col].gt(0)]])
                if len(positive_phases)==1:
                    phase=next(iter(positive_phases))
                    off_phase=g.index[~phases.loc[g.index].eq(phase)]
                    assert d.loc[off_phase,col].eq(0).all()
                    remove.loc[off_phase]=True
                    phase_saturated_zips.append(zipcode)
            certified_removed=int(remove.sum())
            d=d.loc[~remove].reset_index(drop=True)
        assert len(d) == report['zip_days'] and int(d[col].sum()) == report['event_count']
        saved = np.load(args.results/f'{outcome}_{spec}_fit.npz')
        x, names, offset = make_design(d, spec, phase_saturated_zips)
        assert names == saved['names'].tolist(), (outcome, spec, 'design labels differ')
        beta = saved['beta']
        mu = np.exp(x@beta+offset)
        y = d[col].to_numpy(float)
        residual = y-mu
        hessian = (x.T@x.multiply(mu[:,None])).toarray()
        bread = linalg.inv(hessian)
        score = np.asarray(x.T@residual).ravel()
        implied = bread@score
        assert np.max(np.abs(implied)) < 1e-7
        codes = (d.date-dates[0]).dt.days.to_numpy()
        aggregate = sparse.csr_matrix((np.ones(len(d)),(codes,np.arange(len(d)))),shape=(1461,len(d)))
        full_scores = (aggregate@x.multiply(residual[:,None])).toarray()
        n,kfull = x.shape
        cov = bread@S_hac_simple(full_scores,nlags=7)@bread*n/(n-kfull)
        q = 3 if spec=='R6' else 1
        selected = cov[1:1+q,1:1+q]
        error = float(np.max(np.abs(selected-saved['temperature_covariance'])))
        assert error < max(1e-9, np.max(np.abs(selected))*1e-6), (outcome,spec,error)
        reconstruction_error = float(np.max(np.abs(np.asarray(aggregate@mu).ravel()-saved['fitted_by_day'])))
        assert reconstruction_error < 1e-6, (outcome,spec,reconstruction_error)
        for lag in ([7,14,28] if spec in ['R0','R5'] else [7]):
            altcov = cov if lag==7 else bread@S_hac_simple(full_scores,nlags=lag)@bread*n/(n-kfull)
            if spec != 'R6':
                se = float(np.sqrt(altcov[1,1])); p = float(2*norm.sf(abs(beta[1]/se)))
                if lag==7:
                    assert abs(se-report['standard_error']) < 1e-7
                    assert abs(p-report['two_sided_p']) < 1e-7
                    regenerated_tests.append({'test_id':f'{outcome}_{spec}','p_independent':p})
                covariance_comparisons.append({'outcome':outcome,'specification':spec,'lag':lag,
                    'standard_error':se,'p_independent':p})
        if spec=='R6':
            for label, idx in [('joint_temperature',[0,1,2]),('nonlinearity',[1,2])]:
                b = beta[1:4][idx]; v = selected[np.ix_(idx,idx)]
                w = float(b@linalg.solve(v,b)); p = float(chi2.sf(w,len(idx)))
                assert abs(w-report[label+'_wald']) < 1e-5
                assert abs(p-report[label+'_p']) < 1e-7
                regenerated_tests.append({'test_id':f'{outcome}_{spec}_{label}','p_independent':p})
        checks.append({'outcome':outcome,'specification':spec,'counts':int(y.sum()),'zip_days':len(d),
            'certified_separated_zero_rows':certified_removed,
            'parameters':kfull,'max_abs_score':float(np.max(np.abs(score))),
            'max_implied_step':float(np.max(np.abs(implied))),
            'full_sandwich_vs_projection_max_abs_error':error,
            'fitted_daily_reconstruction_max_abs_error':reconstruction_error,
            'observed_zero_fraction':float(np.mean(y==0)), 'poisson_expected_zero_fraction':float(np.mean(np.exp(-mu)))})
        if spec in ['R0','R5']:
            strata = pd.qcut(mu, 10, duplicates='drop')
            zs = pd.DataFrame({'stratum':strata,'mu':mu,'observed_zero':y==0,'expected_zero':np.exp(-mu)})
            for label, g in zs.groupby('stratum',observed=True):
                zero_strata.append({'outcome':outcome,'specification':spec,'predicted_mean_stratum':str(label),
                    'zip_days':len(g),'predicted_mean':float(g.mu.mean()),
                    'observed_zero_fraction':float(g.observed_zero.mean()),'poisson_expected_zero_fraction':float(g.expected_zero.mean())})
        print(json.dumps({'validated':f'{outcome}/{spec}','covariance_error':error}),flush=True)

    tests = pd.DataFrame(regenerated_tests).set_index('test_id')
    assert len(tests)==24
    p = tests.p_independent.to_numpy()
    order = np.argsort(p)
    adjusted = np.empty(len(p))
    adjusted[order] = np.minimum(1,np.maximum.accumulate(p[order]*np.arange(len(p),0,-1)))
    tests['p_holm_independent'] = adjusted
    official = pd.DataFrame(payload['tests']).set_index('test_id')
    tests = tests.join(official[['p_raw','p_holm_revision_family']],validate='one_to_one')
    assert (tests.p_raw-tests.p_independent).abs().max()<1e-7
    assert (tests.p_holm_independent-tests.p_holm_revision_family).abs().max()<1e-6
    for outcome in ['all','core']:
        a,b = reported[(outcome,'R7')],reported[(outcome,'R8')]
        assert a['sample_sha256']==b['sample_sha256']
        assert a['event_count']==b['event_count'] and a['zip_days']==b['zip_days']
        a,b = reported[(outcome,'R00')],reported[(outcome,'R0')]
        assert a['sample_sha256']==b['sample_sha256']
        assert a['event_count']==b['event_count'] and a['zip_days']==b['zip_days']
    pd.DataFrame(checks).to_csv(args.out/'all_model_matrix_checks.csv',index=False)
    pd.DataFrame(covariance_comparisons).to_csv(args.out/'independent_hac_checks.csv',index=False)
    pd.DataFrame(zero_strata).to_csv(args.out/'zero_frequency_diagnostics.csv',index=False)
    tests.to_csv(args.out/'independent_holm24.csv')
    audit = {'status':'passed','independently_refit_models':2,'full_matrix_and_covariance_models':22,'holm_family_tests':24,
        'methods':'Independent pandas design; SciPy natural spline interpolation with linear tails; statsmodels ConditionalPoisson/BFGS for R0; full-matrix S_hac_simple for all covariance checks; manual Holm',
        'maximum_covariance_difference':max(x['full_sandwich_vs_projection_max_abs_error'] for x in checks),
        'maximum_daily_reconstruction_difference':max(x['fitted_daily_reconstruction_max_abs_error'] for x in checks),
        'panel_sha256':hashlib.sha256(args.panel.read_bytes()).hexdigest(),
        'results_sha256':hashlib.sha256((args.results/'revision_results.json').read_bytes()).hexdigest(),
        'script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'versions':{'python':sys.version.split()[0],'numpy':np.__version__,'pandas':pd.__version__,'scipy':scipy.__version__,'statsmodels':statsmodels.__version__},
        'scope':'Numerical validation and descriptive model diagnostics; no new hypotheses or production changes; zero-frequency differences do not by themselves identify a structural-zero process.'}
    (args.out/'audit.json').write_text(json.dumps(audit,indent=2)+'\n')
    print(json.dumps(audit),flush=True)


if __name__=='__main__':
    main()
