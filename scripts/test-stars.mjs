import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {clock,normalize,zone,intervals,reminder,tipOpacity,marine,countdown} from '../public/stars-assets/model.js';
const root={};vm.runInNewContext(readFileSync('public/stars-assets/reminder-messages.js','utf8'),{window:root});const messages=root.ScrippsReminderMessages;
test('system default, valid custom zones and invalid persisted settings',()=>{
 assert.equal(normalize().zone,'system');assert.equal(zone('system'),Intl.DateTimeFormat().resolvedOptions().timeZone);assert.equal(zone('Asia/Kathmandu'),'Asia/Kathmandu');assert.throws(()=>zone('No/Zone'));
 const s=normalize({zone:'No/Zone',clock:'bad',tips:2,surf:'false',sky:false});assert.equal(s.zone,'system');assert.equal(s.tips,15);assert.equal(s.surf,true);assert.equal(s.sky,false);
});
test('12/24hour midnight/noon, no leading12hour zero, chosen zone and DST',()=>{
 const t=Date.parse('2026-10-19T07:09:08Z');assert.deepEqual(clock(t,{zone:'America/Los_Angeles',clock:'12'}),{main:'12:09',seconds:'08',period:'AM'});
 assert.deepEqual(clock(t,{zone:'America/Los_Angeles',clock:'24'}),{main:'00:09',seconds:'08',period:''});assert.equal(clock(t,{zone:'Asia/Tokyo',clock:'12'}).main,'4:09');
 assert.equal(clock(Date.parse('2026-10-19T19:00:00Z'),{zone:'America/Los_Angeles',clock:'12'}).period,'PM');
 for(const [date,expected] of [['2026-03-08T09:59:59Z','01:59'],['2026-03-08T10:00:00Z','03:00'],['2026-11-01T08:59:59Z','01:59'],['2026-11-01T09:00:00Z','01:00']])assert.equal(clock(Date.parse(date),{zone:'America/Los_Angeles',clock:'24'}).main,expected);
});
test('all selectable reminder intervals cover a day; clock-off does not disable them',()=>{
 assert.equal(messages.length,288);assert.equal(new Set(messages).size,288);assert.ok(messages.every(t=>!t.includes('?')));
 for(const interval of intervals){const settings={tips:interval,zone:'UTC',clock:'off'};for(let minute=0;minute<1440;minute++){
  const now=Date.parse('2026-10-19T00:00:00Z')+minute*60000,item=reminder(now,settings,messages);
  assert.equal(!!item,interval>0&&minute%interval===0);if(item){assert.equal(item.text,messages[Math.floor(minute/5)]);assert.ok(reminder(now+29999,settings,messages));assert.equal(reminder(now+30150,settings,messages),null);}
 }}
});
test('reminder follows selected local boundaries including fractional-offset zones',()=>{
 const settings={zone:'Asia/Kathmandu',tips:60},t=Date.parse('2026-10-19T07:15:00Z');assert.ok(reminder(t,settings,messages));assert.equal(reminder(t+60000,settings,messages),null);
 assert.equal(tipOpacity(0),0);assert.equal(tipOpacity(200),1);assert.equal(tipOpacity(30150),0);assert.ok(tipOpacity(30075)>.1&&tipOpacity(30075)<.9);
});
test('marine model rejects missing, malformed and stale data; countdown never negative',()=>{
 const now=Date.now(),valid={current:{time:now/1000,wave_height:1,wave_period:9}};assert.equal(marine(valid,now).feet,3.28084);
 for(const data of [null,{}, {current:{...valid.current,wave_height:null}},{current:{...valid.current,wave_height:-1}},{current:{...valid.current,time:now/1000-10801}}])assert.equal(marine(data,now),null);
 assert.equal(countdown(100,200),'0h 00m 00s');
});
test('88 catalog figures and release limits retained; browser entry and project linked',()=>{
 const data=JSON.parse(readFileSync('public/stars-assets/constellations.json','utf8'));assert.equal(data.constellations.length,88);
 const js=readFileSync('public/stars-assets/constellations.js','utf8');assert.ok(js.includes('maxActive=5'));assert.ok(js.includes('between(15,20)+lockTime'));assert.ok(js.includes('g.visible=until>0?0:'));
 const page=readFileSync('dist/stars/index.html','utf8'),project=readFileSync('dist/work/stars/index.html','utf8');for(const name of ['clock','zone','seconds','surf','sky','tips'])assert.ok(page.includes('name="'+name+'"'));
 assert.ok(project.includes('data-pip-guide'));assert.ok(project.includes('/stars-assets/workflow.html'));assert.ok(project.includes('/stars/'));
 for(const path of ['dist/work/index.html','dist/all/index.html'])assert.ok(readFileSync(path,'utf8').includes('/work/stars/'));
});
