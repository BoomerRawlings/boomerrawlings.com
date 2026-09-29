import {selectedRows} from './campus-rates.js';

export const vehicleGroups = {
  undergraduate: {label:'9 undergraduate-serving UC campuses', note:'Includes all enrolled students at the nine University of California institutions that teach undergraduates. San Francisco is a graduate and professional health-sciences institution; choose all 10 to include it.'},
  uc: {label:'All 10 UC campuses', note:'Includes San Francisco, whose graduate and professional health-sciences focus and small student population make its enrollment-based ratio less comparable with the other nine campuses.'},
  all: {label:'All 42 study universities', note:'This is the study’s selected set of universities, not every university in the country. Three schools lack a complete verified 2024 on-campus count in this snapshot and remain unranked.'},
};

export function vehicleComparison(data,group='undergraduate',metric='rate') {
  if (!vehicleGroups[group] || !['rate','count'].includes(metric)) throw new Error('Unsupported vehicle-theft comparison');
  const subset={...data,institutions:data.institutions.filter(i=>group==='all'||(i.group==='uc'&&(group!=='undergraduate'||i.id!=='110699')))};
  const rows=selectedRows(subset,{category:'motor_vehicle_theft',period:'2024',measure:'enrollment',sort:metric==='rate'?'rateDesc':'countDesc'});
  const focus=rows.find(r=>r.institution.id==='110680');
  const available=rows.filter(r=>r[metric]!==null);
  // Rank uses full precision; equal values share the same rank. Missing is not zero.
  const rank=focus?.[metric]===null||!focus?null:1+available.filter(r=>r[metric]>focus[metric]).length;
  return {rows,focus,rank,available:available.length,total:rows.length,maximum:Math.max(1,...available.map(r=>r[metric]))};
}
