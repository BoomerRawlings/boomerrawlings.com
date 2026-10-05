import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { sanitizeReview,buildSession,scheduleReview,rateReview,undoReview,currentReviewId,reviewStats,localDayKey } from '../public/brain/review.js';
import { flashcards } from '../public/brain/cards.js';

const DAY=86_400_000,now=Date.parse('2026-10-05T18:30:00Z');
const cards=Array.from({length:150},(_,i)=>({id:`c${i}`,topicId:`t${Math.floor(i/3)}`,level:['essentials','mechanism','advanced'][i%3]}));
const valid=cards.map(card=>card.id),clean=raw=>sanitizeReview(raw,valid),empty=clean(null),reloaded=state=>clean(JSON.parse(JSON.stringify(state)));
assert.deepEqual(empty,{version:1,records:{},session:null,daily:{dayKey:'',ratings:0,cardIds:[]},activity:{},history:[]});
for(const raw of [undefined,false,4,'bad',[],{records:'bad',session:[],daily:null,history:'bad',activity:null}])assert.doesNotThrow(()=>clean(raw));
const malformed=clean({records:{ghost:{due:now},c0:{due:Infinity},c1:{due:-1},c2:{due:now,intervalDays:Infinity,reviews:-3}},daily:{dayKey:'2026-99-04',ratings:-5,cardIds:['c0','c0','ghost']},session:{initialIds:['c0','c0','ghost'],queue:['ghost','c0','c0'],attempts:{c0:99},retryCounts:{c0:99},ratings:{again:Infinity}},history:[{}]});
assert.deepEqual(Object.keys(malformed.records),['c2']);assert.equal(malformed.records.c2.intervalDays,0);assert.deepEqual(malformed.session.queue,['c0']);assert.deepEqual(malformed.daily.cardIds,['c0']);assert.equal(malformed.daily.dayKey,'');assert.equal(malformed.history.length,0);
assert.doesNotThrow(()=>clean(JSON.parse('{"records":{"__proto__":{"due":4}},"activity":{"__proto__":{"ratings":2}}}')));

// Due cards precede new cards, which precede future cards. Prior misses lead the due pool.
let state=clean({records:{c0:{...scheduleReview(null,'good',now-2*DAY)},c1:{...scheduleReview(null,'again',now-700_000)},c2:scheduleReview(null,'hard',now-2*DAY),c3:scheduleReview(null,'good',now)}});
const initial=JSON.stringify(state),session=buildSession(cards.slice(0,6),state,{count:6,now,random:()=>.5});
assert.equal(JSON.stringify(state),initial,'Starting a session does not mutate progress');
assert.deepEqual(session.session.queue.slice(0,3),['c1','c2','c0']);assert.ok(session.session.queue.indexOf('c3')>session.session.queue.indexOf('c4'));assert.ok(session.session.queue.indexOf('c3')>session.session.queue.indexOf('c5'));assert.equal(new Set(session.session.queue).size,6);
state=buildSession(cards,state,{topicIds:['t2','t3'],level:'mechanism',count:50,now,random:()=>.25});assert.deepEqual(new Set(state.session.initialIds),new Set(['c7','c10']));assert.ok(state.records.c0,'Filtering a deck must preserve other-deck records');
assert.equal(buildSession(cards,state,{topicIds:[],now}).session,null);assert.equal(buildSession(cards,state,{level:'missing',now}).session,null);assert.equal(buildSession(cards,state,{count:0,now}).session,null);
assert.equal(buildSession([...cards,cards[0]],empty,{count:150,now,random:()=>NaN}).session.queue.length,150);
assert.deepEqual(buildSession(cards,empty,{now,random:()=>.2}),buildSession(cards,empty,{now,random:()=>.2}),'Injected randomness is deterministic');
assert.equal(flashcards.length,150);const actual=buildSession(flashcards,sanitizeReview(null,flashcards.map(card=>card.id)),{count:10,level:'advanced',now,random:()=>.3});assert.ok(actual.session.queue.every(id=>flashcards.find(card=>card.id===id).level==='advanced'),'Actual card module and level filters interoperate');

// Exact elapsed-time deadlines; one coherent heuristic, with a90-day ceiling.
assert.equal(scheduleReview(null,'again',now).due,now+600_000);assert.equal(scheduleReview(null,'hard',now).due,now+DAY);
let record=null;for(const days of [1,3,7,14,30,60,90,90]){record=scheduleReview(record,'good',now);assert.equal(record.intervalDays,days);assert.equal(record.due,now+days*DAY);}
record=scheduleReview(record,'again',now);assert.equal(record.intervalDays,600_000/DAY);assert.equal(scheduleReview(record,'good',now).intervalDays,1,'A lapse returns to the first successful interval');
record=null;for(const days of [1,2,3,5,8]){record=scheduleReview(record,'hard',now);assert.equal(record.intervalDays,days);}
assert.ok(scheduleReview(record,'good',now).intervalDays>record.intervalDays);assert.equal(scheduleReview({ ...record,intervalDays:90,lastRating:'good' },'hard',now).intervalDays,45);
assert.throws(()=>scheduleReview(null,'easy',now),RangeError);

// Again returns after two other cards. A card is encountered at most three times.
state=buildSession(cards.slice(0,4),empty,{count:4,now,random:()=>.999});const first=currentReviewId(state),others=state.session.queue.slice(1),before=JSON.stringify(state);
state=rateReview(state,'again',{now});assert.equal(JSON.stringify(reloaded(JSON.parse(before))),before);assert.deepEqual(state.session.queue,[others[0],others[1],first,others[2]]);assert.equal(state.records[first].due,now+600_000);
assert.deepEqual(undoReview(reloaded(state)),JSON.parse(before),'Undo survives JSON persistence, restoring queue/schedule/activity');
assert.equal(currentReviewId(reloaded(state)),currentReviewId(state),'Reload resumes at exactly the same card');
const brokenHistory=JSON.parse(JSON.stringify(state));brokenHistory.history[0].previousRecord={due:Infinity};assert.equal(clean(brokenHistory).history.length,0,'Malformed undo snapshots cannot erase a valid schedule');
state=rateReview(state,'good',{now:now+1});state=rateReview(state,'hard',{now:now+2});assert.equal(currentReviewId(state),first);
state=rateReview(state,'again',{now:now+3});while(currentReviewId(state))state=rateReview(state,'again',{now:now+4});
assert.equal(state.session.attempts[first],3);assert.ok(Object.values(state.session.attempts).every(count=>count<=3));assert.ok(state.session.totalRetries<=8);assert.equal(reviewStats(state,{now}).complete,true);assert.equal(reviewStats(state,{now}).uniqueReviewed,4);
for(const count of [1,2,10,150]){
  let loop=buildSession(cards.slice(0,count),empty,{count,now,random:()=>.5}),steps=0;
  while(currentReviewId(loop)){assert.ok(++steps<=count*3,'All-Again queue is bounded');loop=rateReview(loop,'again',{now:now+steps});assert.equal(new Set(loop.session.queue).size,loop.session.queue.length,'No simultaneous queue duplicates');loop=reloaded(loop);}
  assert.equal(steps,count*3);assert.ok(loop.history.length<=50);
}
assert.equal(rateReview(empty,'good',{now}),empty);assert.equal(undoReview(empty),empty);

// Daily progress counts unique cards, while grade counts include retry encounters.
state=buildSession(cards.slice(0,1),empty,{count:1,now});state=rateReview(state,'again',{now,dayKey:'2026-10-05'});state=rateReview(state,'good',{now:now+1000,dayKey:'2026-10-05'});
assert.equal(reviewStats(state,{now,dayKey:'2026-10-05'}).today,1);assert.equal(reviewStats(state,{now,dayKey:'2026-10-05'}).todayRatings,2);assert.equal(reviewStats(state,{now,dayKey:'2026-10-06'}).today,0);
let activityState=empty;
for(let i=0;i<91;i++){const time=now+i*DAY;activityState=buildSession(cards.slice(0,1),activityState,{count:1,now:time});activityState=rateReview(activityState,'good',{now:time});}
assert.equal(Object.keys(activityState.activity).length,90);const oldest=Object.keys(activityState.activity).sort()[0];assert.equal(oldest,localDayKey(now+DAY));
const undone=undoReview(reloaded(activityState));assert.equal(Object.keys(undone.activity).length,90);assert.ok(undone.activity[localDayKey(now)],'Undo restores an activity day pruned by the last grade');assert.ok(!undone.activity[localDayKey(now+90*DAY)]);

// Local day boundaries differ from UTC, while due times remain epoch milliseconds.
const url=new URL('../public/brain/review.js',import.meta.url).href;
for(const [zone,expected]of [['UTC','2026-10-05'],['America/Los_Angeles','2026-10-04']]){
  const result=spawnSync(process.execPath,['--input-type=module','-e',`import {localDayKey} from '${url}';console.log(localDayKey(Date.parse('2026-10-05T03:30:00Z')));`],{encoding:'utf8',env:{...process.env,TZ:zone}});
  assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),expected);
}
console.log('Review engine PASS:150-card sanitization, due/missed priority, filters, exact heuristic intervals, bounded retries, undo/reload and90-day local activity.');
