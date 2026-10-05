// Local heuristic scheduling, not FSRS or a prediction of memory retention.
// Persist the returned state as JSON. All operations preserve their inputs.
export const REVIEW_VERSION=1;
const DAY=86_400_000,AGAIN=600_000,MAX_CARDS=150,MAX_HISTORY=50;
const GRADES=['again','hard','good'],GOOD_DAYS=[1,3,7,14,30,60,90];
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object||{},key);
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const number=(value,min,max,fallback=0)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max?value:fallback;
const integer=(value,min,max,fallback=0)=>Math.floor(number(value,min,max,fallback));
const timestamp=(value,fallback=Date.now())=>integer(value,0,8_640_000_000_000_000,fallback);
const ids=(value,valid,limit=MAX_CARDS)=>Array.isArray(value)?[...new Set(value.filter(id=>typeof id==='string'&&valid.has(id)))].slice(0,limit):[];
const allowed=values=>new Set(Array.from(values||[]).filter(id=>typeof id==='string'&&id&&!['__proto__','constructor','prototype'].includes(id)));
function validDayKey(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function localDayKey(now=Date.now()){
  const date=new Date(timestamp(now));
  return `${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function cleanRecord(raw){
  const record=object(raw);
  if(typeof record.due!=='number'||!Number.isFinite(record.due)||record.due<0||record.due>8_640_000_000_000_000)return null;
  const reviews=integer(record.reviews,0,1_000_000);
  return {due:timestamp(record.due),intervalDays:number(record.intervalDays,0,90),reviews,lapses:integer(record.lapses,0,reviews),lastReviewed:timestamp(record.lastReviewed,0),lastRating:GRADES.includes(record.lastRating)?record.lastRating:null};
}
function cleanBucket(raw,valid){const value=object(raw),cardIds=ids(value.cardIds,valid);return {ratings:Math.max(cardIds.length,integer(value.ratings,0,1_000_000)),cardIds};}
function cleanDaily(raw,valid){const value=object(raw);return {dayKey:validDayKey(value.dayKey)?value.dayKey:'',...cleanBucket(value,valid)};}
function cleanActivity(raw,valid){return Object.fromEntries(Object.entries(object(raw)).filter(([key])=>validDayKey(key)).sort(([a],[b])=>a.localeCompare(b)).slice(-90).map(([key,value])=>[key,cleanBucket(value,valid)]));}
function cleanSession(raw,valid){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
  const initialIds=ids(raw.initialIds,valid);if(!initialIds.length)return null;
  const selected=new Set(initialIds),attempts={},retryCounts={};
  for(const id of initialIds){
    const attempt=integer(object(raw.attempts)[id],0,3);
    if(attempt)attempts[id]=attempt;
    const retry=Math.max(integer(object(raw.retryCounts)[id],0,2),Math.max(0,attempt-1));
    if(retry)retryCounts[id]=retry;
  }
  const ratings=Object.fromEntries(GRADES.map(grade=>[grade,integer(object(raw.ratings)[grade],0,MAX_CARDS*3)]));
  return {startedAt:timestamp(raw.startedAt,0),dayKey:validDayKey(raw.dayKey)?raw.dayKey:'',initialIds,queue:ids(raw.queue,selected).filter(id=>(attempts[id]||0)<3),attempts,retryCounts,ratings,reviewedIds:ids(raw.reviewedIds,selected),totalRetries:Object.values(retryCounts).reduce((sum,count)=>sum+count,0)};
}
/** Strip invalid/obsolete card IDs and bounded malformed local-storage data. */
export function sanitizeReview(raw,validCardIds){
  const valid=allowed(validCardIds),value=object(raw),records={};
  for(const [id,record]of Object.entries(object(value.records))){if(!valid.has(id))continue;const clean=cleanRecord(record);if(clean)records[id]=clean;}
  const session=cleanSession(value.session,valid),daily=cleanDaily(value.daily,valid),activity=cleanActivity(value.activity,valid);
  if(daily.dayKey&&!own(activity,daily.dayKey))activity[daily.dayKey]={ratings:daily.ratings,cardIds:[...daily.cardIds]};
  const history=[];
  if(session&&Array.isArray(value.history))for(const entry of value.history.slice(-MAX_HISTORY)){
    const item=object(entry),previousSession=cleanSession(item.previousSession,valid);
    if(!valid.has(item.cardId)||!GRADES.includes(item.grade)||!validDayKey(item.activityKey)||!previousSession||previousSession.queue[0]!==item.cardId||previousSession.startedAt!==session.startedAt||previousSession.initialIds.join('\0')!==session.initialIds.join('\0')||!item.previousDaily||typeof item.at!=='number'||!Number.isFinite(item.at)||(item.previousRecord!=null&&!cleanRecord(item.previousRecord)))continue;
    history.push({cardId:item.cardId,grade:item.grade,at:timestamp(item.at,0),previousRecord:cleanRecord(item.previousRecord),previousSession,previousDaily:cleanDaily(item.previousDaily,valid),activityKey:item.activityKey,previousActivity:item.previousActivity==null?null:cleanBucket(item.previousActivity,valid),removedActivity:cleanActivity(item.removedActivity,valid)});
  }
  return {version:REVIEW_VERSION,records,session,daily,activity:cleanActivity(activity,valid),history};
}
function shuffle(values,random){
  const copy=[...values];
  for(let i=copy.length-1;i>0;i--){let value;try{value=random();}catch{value=.5;}value=number(value,0,1,.5);const j=Math.min(i,Math.floor(value*(i+1)));[copy[i],copy[j]]=[copy[j],copy[i]];}
  return copy;
}
/** Start a new session from a possibly filtered pool; retain records for other decks. */
export function buildSession(cards,state,options={}){
  const now=timestamp(options.now),topicIds=Array.isArray(options.topicIds)?new Set(options.topicIds):null;
  const level=options.level&&options.level!=='all'?options.level:null;
  const seen=new Set(),pool=(Array.isArray(cards)?cards:[]).filter(card=>card&&typeof card.id==='string'&&card.id&&!seen.has(card.id)&&seen.add(card.id)&&(!topicIds||topicIds.has(card.topicId))&&(!level||card.level===level));
  const base=state?.version===REVIEW_VERSION?state:sanitizeReview(null,pool.map(card=>card.id));
  const records=base.records||{},random=typeof options.random==='function'?options.random:Math.random;
  const ranked=shuffle(pool,random),rank=new Map(ranked.map((card,index)=>[card.id,index]));
  const bucket=card=>!own(records,card.id)?1:records[card.id].due<=now?0:2;
  const missed=id=>records[id]?.lastRating==='again'?0:records[id]?.lastRating==='hard'?1:2;
  ranked.sort((a,b)=>bucket(a)-bucket(b)||(bucket(a)===0?missed(a.id)-missed(b.id):0)||(bucket(a)!==1?records[a.id].due-records[b.id].due:0)||rank.get(a.id)-rank.get(b.id));
  const count=integer(options.count,0,MAX_CARDS,10),initialIds=ranked.slice(0,count).map(card=>card.id);
  const session=initialIds.length?{startedAt:now,dayKey:localDayKey(now),initialIds,queue:[...initialIds],attempts:{},retryCounts:{},ratings:{again:0,hard:0,good:0},reviewedIds:[],totalRetries:0}:null;
  return {...base,records:{...records},session,history:[]};
}
/** Exact due timestamp from a deliberately simple interval heuristic. */
export function scheduleReview(record,grade,now=Date.now()){
  if(!GRADES.includes(grade))throw new RangeError('Unknown review grade');
  now=timestamp(now);const previous=cleanRecord(record),prior=previous?.intervalDays||0;
  let intervalDays;
  if(grade==='again')intervalDays=AGAIN/DAY;
  else if(grade==='hard')intervalDays=Math.min(90,Math.max(1,Math.round(prior*(previous?.lastRating==='hard'?1.5:.5))));
  else intervalDays=GOOD_DAYS.find(days=>days>prior)||90;
  return {due:Math.min(8_640_000_000_000_000,now+Math.round(intervalDays*DAY)),intervalDays,reviews:(previous?.reviews||0)+1,lapses:(previous?.lapses||0)+(grade==='again'?1:0),lastReviewed:now,lastRating:grade};
}
export function currentReviewId(state){return Array.isArray(state?.session?.queue)?state.session.queue[0]||null:null;}
/** Rate queue[0]. Again retries follow two other cards, or the remaining cards if fewer. */
export function rateReview(state,grade,{now=Date.now(),dayKey}={}){
  if(!GRADES.includes(grade))throw new RangeError('Unknown review grade');
  const id=currentReviewId(state);if(!id)return state;
  now=timestamp(now);dayKey=validDayKey(dayKey)?dayKey:localDayKey(now);
  const before=state.session,attempt=(before.attempts[id]||0)+1;
  const queue=before.queue.slice(1).filter(cardId=>cardId!==id),retryCounts={...before.retryCounts};
  if(grade==='again'&&(retryCounts[id]||0)<2&&attempt<3){queue.splice(Math.min(2,queue.length),0,id);retryCounts[id]=(retryCounts[id]||0)+1;}
  const session={...before,queue,attempts:{...before.attempts,[id]:attempt},retryCounts,ratings:{...before.ratings,[grade]:before.ratings[grade]+1},reviewedIds:[...new Set([...before.reviewedIds,id])],totalRetries:Object.values(retryCounts).reduce((sum,count)=>sum+count,0)};
  const previousActivity=own(state.activity,dayKey)?state.activity[dayKey]:null;
  const bucket=previousActivity||{ratings:0,cardIds:[]};
  const daily={dayKey,ratings:bucket.ratings+1,cardIds:[...new Set([...bucket.cardIds,id])]};
  const activity={...state.activity,[dayKey]:{ratings:daily.ratings,cardIds:[...daily.cardIds]}},removedActivity={};
  for(const key of Object.keys(activity).sort().slice(0,Math.max(0,Object.keys(activity).length-90))){removedActivity[key]=activity[key];delete activity[key];}
  const entry={cardId:id,grade,at:now,previousRecord:own(state.records,id)?state.records[id]:null,previousSession:before,previousDaily:state.daily,activityKey:dayKey,previousActivity,removedActivity};
  return {...state,records:{...state.records,[id]:scheduleReview(state.records[id],grade,now)},session,daily,activity,history:[...state.history.slice(-(MAX_HISTORY-1)),entry]};
}
/** Undo the last grade, including its queue, due time and daily activity changes. */
export function undoReview(state){
  const entry=state?.history?.at(-1);if(!entry)return state;
  const records={...state.records};if(entry.previousRecord)records[entry.cardId]=entry.previousRecord;else delete records[entry.cardId];
  const activity={...state.activity,...entry.removedActivity};if(entry.previousActivity)activity[entry.activityKey]=entry.previousActivity;else delete activity[entry.activityKey];
  return {...state,records,session:entry.previousSession,daily:entry.previousDaily,activity,history:state.history.slice(0,-1)};
}
export function reviewStats(state,{now=Date.now(),dayKey}={}){
  now=timestamp(now);dayKey=validDayKey(dayKey)?dayKey:localDayKey(now);
  const session=state?.session,ratings=session?.ratings||{again:0,hard:0,good:0},today=state?.activity?.[dayKey]||(state?.daily?.dayKey===dayKey?state.daily:null);
  return {remaining:session?.queue.length||0,answered:GRADES.reduce((sum,grade)=>sum+(ratings[grade]||0),0),uniqueReviewed:session?.reviewedIds.length||0,initialCount:session?.initialIds.length||0,totalRetries:session?.totalRetries||0,ratings:{...ratings},today:today?.cardIds.length||0,todayRatings:today?.ratings||0,totalDue:Object.values(state?.records||{}).filter(record=>record.due<=now).length,complete:!!session&&!session.queue.length};
}
