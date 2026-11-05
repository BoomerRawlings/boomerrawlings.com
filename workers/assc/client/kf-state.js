import { presentation } from './presentation.js';
export const kfDefaults=()=>({metric:'posts',from:'',to:'',thread:'',top:10,trend:'monthly',query:'',page:0,account:null,excludeSubject:false});
export function filterAccount(data){return data.accounts.find(a=>a.id===presentation.forumAccountId&&a.names.includes(presentation.subjectLabel))||null;}
export function selectedKFMonth(state){
  if(!/^\d{4}-\d{2}-01$/.test(state.from))return '';
  const month=state.from.slice(0,7),[year,m]=month.split('-').map(Number);
  return state.to===new Date(Date.UTC(year,m,0)).toISOString().slice(0,10)?month:'';
}
export function toggleKFMonth(state,month){
  if(selectedKFMonth(state)===month)return {...state,from:'',to:'',page:0};
  const [year,m]=month.split('-').map(Number);
  return {...state,from:month+'-01',to:new Date(Date.UTC(year,m,0)).toISOString().slice(0,10),page:0};
}
export function encodeKFRoute(state){
  const q=new URLSearchParams();
  for(const key of ['from','to','thread','query'])if(state[key])q.set(key,state[key]);
  if(state.excludeSubject)q.set('exclude',presentation.forumAccountToken);
  if(state.metric!=='posts')q.set('metric',state.metric);
  if(state.top!==10)q.set('top',state.top);
  if(state.trend!=='monthly')q.set('trend',state.trend);
  if(state.page)q.set('page',state.page);
  return '#kf'+(q.size?'/view?'+q:'');
}
export function decodeKFRoute(hash){
  if(!/^#kf(?:\/|$)/.test(hash))return null;
  const q=new URLSearchParams(hash.split('?')[1]||''),s=kfDefaults();
  for(const key of ['from','to'])if(/^\d{4}-\d{2}-\d{2}$/.test(q.get(key)||''))s[key]=q.get(key);
  for(const key of ['thread','query'])s[key]=(q.get(key)||'').slice(0,200);
  if(['posts','characters','repliesMade','repliesReceived'].includes(q.get('metric')))s.metric=q.get('metric');
  if([10,25,50].includes(Number(q.get('top'))))s.top=Number(q.get('top'));
  s.trend=q.get('trend')==='cumulative'?'cumulative':'monthly';s.excludeSubject=q.get('exclude')===presentation.forumAccountToken;s.page=Math.max(0,Number.parseInt(q.get('page'),10)||0);return s;
}
