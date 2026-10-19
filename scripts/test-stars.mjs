import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {clock,normalize,zone,intervals,reminder,tipOpacity,marine,countdown,tipsLabel,constellationOptions} from '../public/stars-assets/model.js';
const root={};vm.runInNewContext(readFileSync('public/stars-assets/reminder-messages.js','utf8'),{window:root});const messages=root.ScrippsReminderMessages;
test('system default, valid custom zones and invalid persisted settings',()=>{
 assert.equal(normalize().zone,'system');assert.equal(zone('system'),Intl.DateTimeFormat().resolvedOptions().timeZone);assert.equal(zone('Asia/Kathmandu'),'Asia/Kathmandu');assert.throws(()=>zone('No/Zone'));
 const s=normalize({zone:'No/Zone',clock:'bad',tips:2,surf:'false',sky:false});assert.equal(s.zone,'system');assert.equal(s.tips,5);assert.equal(s.surf,true);assert.equal(s.sky,false);
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
 const page=readFileSync('dist/stars/index.html','utf8'),project=readFileSync('dist/work/stars/index.html','utf8');for(const name of ['clock','zone','seconds','surf','sky','tips','constellationInterval'])assert.ok(page.includes('name="'+name+'"'));
 assert.equal((page.match(/type="range"/g)||[]).length,2);assert.ok(!page.includes('<select name="tips"'));
 assert.ok(page.includes('id="jump-in"'));assert.ok(page.indexOf('id="jump-in"')<page.indexOf('id="settings-form"'),'default entry appears before settings');
 assert.ok(project.includes('data-pip-guide'));assert.ok(project.includes('/stars-assets/workflow.html'));assert.ok(project.includes('/stars/'));
 for(const path of ['dist/work/index.html','dist/all/index.html'])assert.ok(readFileSync(path,'utf8').includes('/work/stars/'));
 const home=readFileSync('dist/index.html','utf8').match(/<ul\b[^>]*class="ledger-list"[^>]*>([\s\S]*?)<\/ul>/)[1];assert.ok(home.indexOf('/work/stars/')<home.indexOf('/work/scads-2026/'),'Stars leads homepage highlights');
 assert.ok(project.includes('/stars-assets/workflow.html?embed=1'));assert.ok(project.includes('/stars-assets/workflow-embed.js'));
});
test('frequency sliders preserve reminder choices; constellation defaults10 and spans10–60',()=>{
 assert.equal(normalize().tips,5);assert.equal(normalize().constellationInterval,10);
 assert.equal(normalize({tips:60}).constellationInterval,10,'old saved settings migrate');assert.equal(tipsLabel(0),'Disabled');assert.equal(tipsLabel(60),'Once an hour');assert.equal(tipsLabel(5),'Every 5 minutes');
 for(let n=10;n<=60;n+=5){assert.equal(normalize({constellationInterval:n}).constellationInterval,n);assert.deepEqual(constellationOptions({constellationInterval:n}),{interval:[n,n],initialDelay:[0,0],cadence:n});}
 for(const n of [-1,0,9,61,Infinity,'bad'])assert.equal(normalize({constellationInterval:n}).constellationInterval,10);
});
test('selected cadence spaces actual lock times without30second batching or burst arrivals',()=>{
 const data=JSON.parse(readFileSync('public/stars-assets/constellations.json','utf8')).constellations,source=readFileSync('public/stars-assets/constellations.js','utf8');
 for(const cadence of [10,30,60]){
  const root={ScrippsConstellationData:data};vm.runInNewContext(source,{window:root,Math,Set,Float64Array,Int32Array,Uint8Array,Number});const sys=root.ScrippsConstellationSystem.create({...constellationOptions({constellationInterval:cadence}),random:()=>.7}),ctx={font:'',measureText:s=>({width:s.length*6.2})};
  const ps=Array.from({length:96},(_,i)=>({x:300+i%12*120,y:100+Math.floor(i/12)*110,dx:1,dy:0,speed:0,radius:2,alpha:.7}));let previous,offset=0;
  for(const [id,x,y,t]of [['Ari',500,200,0],['CMi',1000,500,cadence],['Tri',1500,800,cadence*2]]){
   const p=data.find(p=>p.id===id);root.ScrippsConstellationSystem.transform(p,140,0,x,y).forEach((q,i)=>Object.assign(ps[offset+i],q));offset+=p.stars.length;
   const c=sys.candidate(p,ps,1920,1080,ctx,{x,y,size:140,angle:0});assert.ok(c);assert.ok(sys.admit(c,ps,{motion:t,now:1000+t*1000,dt:0},1920,1080,ctx));
   if(previous!==undefined)assert.ok(Math.abs(c.snapMotion-previous-cadence)<1e-8,'actual locks follow selected interval');else assert.ok(Math.abs(c.snapMotion-cadence)<1e-8,'first lock uses selected interval directly');previous=c.snapMotion;
   assert.equal(sys.snapshot().next,t+cadence,'no closer random burst');assert.ok(c.hold>=15.56&&c.hold<=20.56);
   assert.notEqual((1000+c.snapMotion*1000)%30000,0,'lock does not wait for a30second wall-clock scan');
  }
  assert.equal(sys.snapshot().stats.maxActive,3);
 }
});
test('embedded workflow combines all ten steps; standalone keeps both plans',()=>{
 const html=readFileSync('public/stars-assets/workflow.html','utf8'),bootstrap=html.match(/<script>([\s\S]*?)\/\* Workflow Display:/)[1],original=JSON.parse(readFileSync('public/stars-assets/workflow.json','utf8'));
 for(const search of ['','?embed=1']){const node={textContent:JSON.stringify(original)},classes=[];
  vm.runInNewContext(bootstrap,{URLSearchParams,location:{search},document:{documentElement:{classList:{add:c=>classes.push(c)}},getElementById:()=>node},window:{addEventListener(){}}});
  const data=JSON.parse(node.textContent);assert.equal(data.plans.length,search?1:2);if(search){assert.equal(data.plans[0].steps.length,10);assert.equal(new Set(data.plans[0].steps.map(s=>s.id)).size,10);assert.deepEqual(classes,['embedded']);}
 }
});
test('inline frame sizing accepts only its same-origin child and bounded numeric height',()=>{
 const listeners={},frame={style:{},contentWindow:{postMessage(){}},addEventListener(){}},source=readFileSync('public/stars-assets/workflow-embed.js','utf8');
 vm.runInNewContext(source,{document:{querySelector:()=>frame},location:{origin:'https://example.test'},window:{addEventListener:(name,fn)=>listeners[name]=fn}});
 const event={origin:'https://example.test',source:frame.contentWindow,data:{type:'stars-workflow-height',height:6432}};
 for(const change of [{origin:'https://other.test'},{source:{}},{data:{type:'stars-workflow-height',height:Infinity}},{data:{type:'stars-workflow-height',height:'900'}},{data:{type:'stars-workflow-height',height:90000}}]){listeners.message({...event,...change});assert.equal(frame.style.height,undefined);}
 listeners.message(event);assert.equal(frame.style.height,'6432px');listeners.message({...event,data:{...event.data,height:800}});assert.equal(frame.style.height,'800px','shrinks again when search filters pairs');
});
