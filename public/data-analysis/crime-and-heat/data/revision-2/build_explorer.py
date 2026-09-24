"""Construct revised browser aggregates; originals stay byte-identical."""
from pathlib import Path
import sys,json,hashlib
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
sys.path.insert(0,str(ROOT/'_analysis_deps'))
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

PUBLIC=ROOT.parent/'boomerrawlings.com/public/data-analysis/crime-and-heat/data'
OUT=PUBLIC/'revision-2'
OUT.mkdir(parents=True,exist_ok=True)
weather=pd.read_csv(ROOT/'publication/revision_weather/daily_zip_weather_civil.csv',dtype={'zip_code':str})
old=json.loads((PUBLIC/'daily.json').read_text())
categories=json.loads((PUBLIC/'category_daily.json').read_text())
zips=sorted(weather.zip_code.unique())
dates=old['dates']; n=len(dates)
assert len(zips)==64 and n==2741 and len(weather)==64*n
index=pd.MultiIndex.from_product([zips,dates],names=['zip_code','date'])
weather=weather.set_index(['zip_code','date']).loc[index].reset_index()
indices=np.concatenate([np.arange(old['zips'].index(z)*n,(old['zips'].index(z)+1)*n) for z in zips])
panel={k:v for k,v in old.items() if k not in ['zips','data']}
panel['zips']=zips
panel['data']=[np.asarray(c)[indices].tolist() for c in old['data']]
for col,source in [('high10','temp_high_f'),('mean10','temp_mean_f'),('low10','temp_low_f')]:
    panel['data'][old['columns'].index(col)]=np.rint(weather[source].to_numpy()*10).astype(int).tolist()
dt=pd.to_datetime(weather.date)
warm=dt.dt.month.between(5,9)
calibration=weather[warm & dt.dt.year.le(2024)]
threshold=calibration.groupby('zip_code').temp_high_f.quantile(.9)
hot=warm & weather.temp_high_f.ge(weather.zip_code.map(threshold))
def runs(x):
    groups=x.ne(x.shift()).cumsum()
    return x & x.groupby(groups).transform('size').ge(3)
flag=hot.groupby(weather.zip_code,sort=False).transform(runs).astype(int)
panel['data'][old['columns'].index('heatwave')]=flag.tolist()
weather['heatwave_p90_3day']=flag
for col in ['core','broad','all']:
    weather[col+'_count']=panel['data'][old['columns'].index(col)]
hours=weather.groupby('date').day_hours.agg(['min','max']).loc[dates]
assert (hours['min']==hours['max']).all()
panel.update(revision='2.0',timezone='America/Los_Angeles',day_hours_by_date=hours['min'].astype(int).tolist(),
    population='original_weather_eligible_source_ids_in_64_complete_civil_weather_zips',
    note='Restricted64ZIPsample; nonrandom acquisition availability after provider quota. Original eligibility; stricter warrant sensitivity is separate. Temperatures encoded in tenths; model input retains unrounded hourly means. Civil-day heatwave flags use the same retrospective percentile/run rule as the original release, recomputed on corrected weather. Incomplete2025; absence is not confirmed zero crime.')
for field in ['timezone_note','weather_timezone','day_window','temperature_day_timezone']:
    if field in panel:panel[field]='America/Los_Angeles civil calendar day,23/24/25hours'
cat={k:v for k,v in categories.items() if k not in ['zips','data']}
cat['zips']=zips
cat['data']=[np.asarray(c)[indices].tolist() for c in categories['data']]
cat.update(revision='2.0',population=panel['population'],note='Nonexclusive original-eligibility category counts on exactly the revised daily.json axes; same source totals within these64ZIPs; no other acquisition ZIPs imputed.')
for filename,obj in [('daily.json',panel),('category_daily.json',cat)]:
    (OUT/filename).write_text(json.dumps(obj,separators=(',',':'),allow_nan=False)+'\n',encoding='utf-8')
weather.to_csv(OUT/'daily_zip_civil_counts.csv.gz',index=False,compression={'method':'gzip','mtime':0})
threshold.rename('warm_season_p90_high_f').to_csv(OUT/'heatwave_thresholds.csv')
primary=weather.date.between('2021-01-01','2024-12-31')
assert weather.loc[primary,'all_count'].sum()==57903 and weather.loc[primary,'core_count'].sum()==6501
assert len(weather.loc[primary])==93504
for category in ['core','all']:
    assert cat['data'][cat['columns'].index(category)]==panel['data'][panel['columns'].index(category)]
curves=pd.read_csv(HERE/'results/nonlinear_curves.csv')
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False,'svg.fonttype':'none'})
fig,axes=plt.subplots(1,2,figsize=(11.6,5.8),sharex=True,sharey=True)
for ax,(outcome,label) in zip(axes,[('all','All eligible records'),('core','Core domestic violence')]):
    data=curves[curves.outcome.eq(outcome)]
    ax.fill_between(data.temperature_f,data.ci95_low,data.ci95_high,color='#dce5e7',label='Pointwise 95% interval')
    ax.plot(data.temperature_f,data.count_ratio,color='#20515f',linewidth=2,label='Count ratio')
    ax.axhline(1,color='#526273',linestyle='--',linewidth=.8)
    ax.axvline(70,color='#526273',linestyle=':',linewidth=.8)
    ax.set_title(label,loc='left',fontweight='bold',pad=14)
    ax.set_xlabel('Modeled civil-day maximum (°F)',labelpad=10)
    ax.set_xlim(50.4,98.1)
    ax.set_ylim(.75,1.4)
    ax.grid(axis='y',color='#e1e5e8',linewidth=.6)
    ax.set_axisbelow(True)
axes[0].set_ylabel('Expected daily record-count ratio\nrelative to 70°F',labelpad=10)
fig.suptitle('Nonlinear temperature association · combined specification R6',x=.08,ha='left',y=.98,fontsize=15,fontweight='bold')
fig.text(.08,.895,'2021–2024 · Restricted weather sample · Strict warrant exclusions',fontsize=10,color='#526273')
handles,labels=axes[0].get_legend_handles_labels()
fig.legend(handles,labels,loc='lower left',bbox_to_anchor=(.075,.11),frameon=False,ncol=2)
fig.text(.08,.065,'Four fixed weather-percentile knots; ZIP, year-month, weekday, local annual seasonality, humidity, rainfall and holidays.',fontsize=8.5)
fig.text(.08,.03,'Display: pooled weather 1st–99th percentiles. Intervals are pointwise and nominal; this retrospective analysis does not identify causation.',fontsize=8.5)
fig.subplots_adjust(left=.08,right=.98,top=.80,bottom=.29,wspace=.14)
fig.savefig(OUT/'nonlinear-curves.svg',metadata={'Date':None,'Description':'Retrospective record-count model with pointwise nominal95%intervals; no causal inference.'})
svg=OUT/'nonlinear-curves.svg'
svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines())+'\n',encoding='utf-8')
fig.savefig(OUT/'nonlinear-curves.png',dpi=160)
verification={'status':'PASS','zips':64,'dates':n,'cells':len(weather),'primary_cells':int(primary.sum()),
    'primary_all':57903,'primary_core':6501,'category_source_cells_checked':len(indices)*7,
    'count_arrays_unchanged_within_selected_zips':True,'civil_day_hours':sorted(set(panel['day_hours_by_date'])),
    'outputs':{name:hashlib.sha256((OUT/name).read_bytes()).hexdigest() for name in ['daily.json','category_daily.json','daily_zip_civil_counts.csv.gz','nonlinear-curves.svg']}}
(HERE/'explorer_verification.json').write_text(json.dumps(verification,indent=2)+'\n')
print(json.dumps(verification))
