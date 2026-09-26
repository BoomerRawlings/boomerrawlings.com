import {summarize, rateLabel} from './campus-rates.js';
import {topicCopy, placeCopy, periodCopy} from '../data/campus-reader-copy.js';
const number = value => value.toLocaleString('en-US');
export function readerResult(institution,{category='criminal_total',period='2024',place='housing'}={}) {
  if(!topicCopy[category] || !placeCopy[place] || !periodCopy[period]) throw new Error('Invalid reader selection');
  const years=period==='pooled'?[2022,2023,2024]:[Number(period)];
  let result;
  if(place==='combined') {
    const cells=years.flatMap(year=>['oncampus','noncampus','publicproperty'].map(geo=>institution.years.find(y=>y.year===year)?.counts[geo]?.[category]));
    result={count:cells.every(v=>Number.isInteger(v)&&v>=0)?cells.reduce((a,b)=>a+b,0):null,population:null,rate:null,years:years.length};
  } else result=summarize(institution,category,period,place==='housing'?'residents':'enrollment',1000);
  const scope=place==='housing'?'in campus housing':place==='campus'?'across on-campus areas':'across the three reporting areas';
  const time=period==='pooled'?'across 2022–2024':`in ${period}`;
  const label=topicCopy[category].label.toLocaleLowerCase();
  const offense=result.count===1?'offense':'offenses';
  const headline=result.count===null?`A verified ${label} count is unavailable for this selection.`:`${number(result.count)} reported ${category==='criminal_total'?offense:label+' '+offense} ${scope} ${time}.`;
  const populationLabel=place==='housing'?'documented residents':'enrolled students';
  let interpretation;
  if(place==='combined') interpretation=result.count===null?'At least one year or reporting area is missing, ambiguous or unverified. The available figures do not establish a complete comparable total, so it is not displayed.':'This total includes qualifying off-campus properties and public property within or next to campus. It cannot be divided by the housing population to produce a resident rate.';
  else if(result.count===null) interpretation=`The source does not support a complete count for the selected years, category and location. Missing is not zero.${result.population!==null?` The population is documented (${number(result.population)}), but a rate still requires a verified count.`:''}`;
  else if(result.population===null) interpretation=`The count is available, but a verified ${period==='pooled'?'complete set of same-year populations':'same-year population'} is not. No rate per resident${place==='campus'?' or enrolled student':''} is calculated; bed capacity and an earlier year's population are not substitutes.`;
  else interpretation=`${number(result.count)} reported ${offense} divided by ${number(result.population)} ${period==='pooled'?'summed fall populations':'people in the fall population'}, then multiplied by 1,000, gives ${rateLabel(result.rate)} reports per 1,000 ${populationLabel}${period==='pooled'?' per year':''}. This is a reporting comparison, not a percentage of students victimized.`;
  const zero=result.count===0?'Zero means no offenses recorded in this source for the selected category and area; unreported offenses are not measured.':null;
  const editions=[...new Set(institution.years.filter(y=>years.includes(y.year)).flatMap(y=>y.sourceEditions??[]))];
  const timeExplanation=period==='pooled'&&place==='combined'?'Adds the 2022, 2023 and 2024 counts only when all three years and all three reporting areas are verified. This is a three-year count, not an annual rate or a count of unique people.':periodCopy[period];
  return {...result,headline,interpretation,zero,editions,scope,populationLabel,timeExplanation};
}
