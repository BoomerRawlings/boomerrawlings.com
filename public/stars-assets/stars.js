// Browser-native Stars renderer © 2026 Boomer Rawlings. GPL-3.0-or-later.
import {normalize,zone,clock,reminder,tipOpacity,countdown,marine,intervals,tipsLabel,constellationOptions} from './model.js?v=20261019-sliders';
const canvas=document.querySelector('#stars'),ctx=canvas.getContext('2d'),dialog=document.querySelector('#settings'),form=document.querySelector('#settings-form'),controls=document.querySelector('#controls'),error=document.querySelector('#settings-error');
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),storageKey='boomer-stars-v1';
let settings=normalize(),running=false,w=innerWidth,h=innerHeight,last=0,motion=0,idleTimer,skyDisplay,skyPending,skyDue=0,skyLast=0,waves=null,lastFetch=0,fetching=false,wake=null,hiddenSince=null;
let eventFormat,eventFormatKey;
try{settings=normalize(JSON.parse(localStorage.getItem(storageKey)||'{}'));}catch{}
const stars=Array.from({length:Math.max(56,Math.min(144,Math.round(w*h/17000)))},(_,i)=>{const a=Math.random()*Math.PI*2;return {x:Math.random()*w,y:Math.random()*h,dx:Math.cos(a),dy:Math.sin(a),speed:3+Math.random()*4,radius:.9+Math.random()*.8,alpha:.48+Math.random()*.4,color:'#d3d8d6',phase:i*2.39996};});
function sliderLabels(){const tips=intervals[Number(form.elements.tips.value)],seconds=Number(form.elements.constellationInterval.value),tip=tipsLabel(tips),cadence='Every '+seconds+' seconds';document.querySelector('#tips-value').textContent=tip;form.elements.tips.setAttribute('aria-valuetext',tip);document.querySelector('#constellation-value').textContent=cadence;form.elements.constellationInterval.setAttribute('aria-valuetext',cadence);}
function writeForm(){for(const key of ['clock','zone','seconds','surf','sky','tips','constellationInterval']){const el=form.elements.namedItem(key);if(el.type==='checkbox')el.checked=settings[key];else el.value=String(key==='tips'?intervals.indexOf(settings.tips):settings[key]);}form.elements.seconds.disabled=form.elements.clock.value==='off';sliderLabels();}
writeForm();
form.elements.tips.addEventListener('input',sliderLabels);form.elements.constellationInterval.addEventListener('input',sliderLabels);
const systemZone=Intl.DateTimeFormat().resolvedOptions().timeZone;
document.querySelector('#zone-help').prepend('Current system zone: '+systemZone+'. ');
try{for(const name of Intl.supportedValuesOf('timeZone')){const option=document.createElement('option');option.value=name;document.querySelector('#timezones').append(option);}}catch{}
form.elements.clock.addEventListener('change',()=>{form.elements.seconds.disabled=form.elements.clock.value==='off';});
function reveal(){if(!running)return;document.body.classList.remove('idle');clearTimeout(idleTimer);idleTimer=setTimeout(()=>document.body.classList.add('idle'),2500);}
function edit(){clearTimeout(idleTimer);document.body.classList.remove('idle');writeForm();error.textContent='';if(!dialog.open)dialog.showModal();form.elements.clock.focus();}
document.querySelector('#edit').addEventListener('click',edit);
window.addEventListener('pointermove',reveal,{passive:true});window.addEventListener('pointerdown',reveal,{passive:true});window.addEventListener('keydown',e=>{if(!dialog.open&&['s','S','Escape'].includes(e.key)){e.preventDefault();edit();}else reveal();});
dialog.addEventListener('cancel',e=>{if(!running)e.preventDefault();});
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{document.querySelector('#screen-status').textContent='Fullscreen is unavailable. The stars still work in this window.';}}
document.querySelector('#fullscreen').addEventListener('click',fullscreen);
async function keepAwake(){if(!running||document.hidden||!navigator.wakeLock)return;try{wake=await navigator.wakeLock.request('screen');wake.addEventListener('release',()=>{wake=null;});}catch{}}
form.addEventListener('submit',e=>{
 e.preventDefault();const raw={clock:form.elements.clock.value,zone:form.elements.zone.value.trim()||'system',seconds:form.elements.seconds.checked,surf:form.elements.surf.checked,sky:form.elements.sky.checked,tips:intervals[Number(form.elements.tips.value)],constellationInterval:Number(form.elements.constellationInterval.value)};
 try{zone(raw.zone);}catch{error.textContent='Enter a valid IANA time zone, or use system.';form.elements.zone.focus();return;}
 settings=normalize(raw);try{localStorage.setItem(storageKey,JSON.stringify(settings));}catch{}
 const wantFullscreen=form.elements.fullscreen.checked;running=true;skyDisplay=skyPending=null;window.ScrippsConstellations=window.ScrippsConstellationSystem.create(constellationOptions(settings));dialog.close();controls.hidden=false;document.body.classList.add('running');
 if(wantFullscreen&&!document.fullscreenElement)fullscreen();keepAwake();reveal();if(settings.surf)loadWaves();canvas.focus({preventScroll:true});
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){hiddenSince=Date.now();wake?.release();}else{last=0;skyDisplay=skyPending=null;window.ScrippsConstellations.reset();hiddenSince=null;keepAwake();}});
window.addEventListener('pagehide',()=>wake?.release());
window.addEventListener('online',()=>{if(settings.surf&&running)loadWaves();});
async function loadWaves(){
 if(fetching||!running||!settings.surf||document.hidden)return;fetching=true;lastFetch=Date.now();
 try{const res=await fetch('https://marine-api.open-meteo.com/v1/marine?latitude=32.8663&longitude=-117.2546&current=wave_height,wave_period&timeformat=unixtime',{signal:AbortSignal.timeout(10000)});if(!res.ok)throw Error('Forecast unavailable');const next=marine(await res.json());if(!next)throw Error('Forecast stale');waves=next;}catch{waves=null;}finally{fetching=false;}
}
function resize(){const oldW=w,oldH=h;w=innerWidth;h=innerHeight;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);for(const p of stars){p.x=p.x/oldW*w;p.y=p.y/oldH*h;}window.ScrippsConstellations.reset();}
window.addEventListener('resize',resize);resize();
function sample(now,region,x,y=0){return reduced.matches?{strength:0,offset:0,charge:0}:window.ScrippsEffects.sample(now,region,x,y);}
function text(value,x,y,size,now,region='report',alpha=1){
 ctx.font=(size>=25?'300 ':'400 ')+size+'px "Segoe UI", sans-serif';let px=x;
 for(const ch of String(value)){const e=sample(now,region,region==='clock'?(px-x)/230:px,y);ctx.fillStyle='#c7ced2';ctx.globalAlpha=alpha;ctx.fillText(ch,px+e.offset,y);
  if(e.strength){ctx.globalAlpha=alpha*e.strength*.75;ctx.fillStyle='#66b8e6';ctx.fillText(ch,px+e.offset+1.3,y);ctx.fillStyle='#e6cf82';ctx.fillText(ch,px+e.offset-1.3,y);}px+=ctx.measureText(ch).width;
 }ctx.globalAlpha=1;return px;
}
function divider(x,y,width,now,region){
 const anchors=[[x,y],[x+width*.64,y],[x+width*.67,y+4],[x+width,y+4]],points=[];
 for(let i=1;i<4;i++)for(let n=0;n<=12;n++){const f=n/12,a=anchors[i-1],b=anchors[i],px=a[0]+(b[0]-a[0])*f,py=a[1]+(b[1]-a[1])*f,e=sample(now,region,region==='clock'?(px-x)/width:px,py);points.push([px+e.offset,py,e]);}
 ctx.lineWidth=.7;ctx.strokeStyle='#91a5b0';ctx.globalAlpha=.55;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(...p));ctx.stroke();
 for(let i=1;i<points.length;i++){const e=points[i][2];if(!e.strength)continue;ctx.strokeStyle=e.color;ctx.globalAlpha=e.strength*.8;ctx.beginPath();ctx.moveTo(points[i-1][0],points[i-1][1]);ctx.lineTo(points[i][0],points[i][1]);ctx.stroke();}
 ctx.fillStyle='#b5c5cd';ctx.globalAlpha=.8;for(const p of anchors){ctx.beginPath();ctx.arc(p[0],p[1],1,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
}
function wrap(value,maxWidth){const lines=[];let line='';for(const word of value.split(' ')){const next=line?line+' '+word:word;if(line&&ctx.measureText(next).width>maxWidth){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);return lines;}
function topOverlay(now){
 window.clockBounds=window.reminderBounds=null;const s=Math.min(1,w/650,h/550),x=Math.min(104,w*.09),y=Math.min(104,h*.11);ctx.save();ctx.translate(x,y);ctx.scale(s,s);
 let tipY=18;
 if(settings.clock!=='off'){
  const t=clock(now,settings),main=64;ctx.font='300 64px "Segoe UI", sans-serif';const mainWidth=ctx.measureText('88:88').width,actual=ctx.measureText(t.main).width;
  text(t.main,mainWidth-actual,57,main,now,'clock');if(settings.seconds)text(t.seconds,mainWidth+10,57,16,now,'clock',.9);
  if(t.period)text(t.period,mainWidth+(settings.seconds?43:10),57,13,now,'clock',.85);
  divider(0,78,270,now,'clock');window.clockBounds={x,y,w:270*s,h:90*s};tipY=112;
 }
 const item=reminder(now,settings,window.ScrippsReminderMessages);
 if(item){ctx.font='400 14px "Segoe UI", sans-serif';const lines=wrap(item.text,Math.min(320,(w-x*2)/s)),width=Math.max(...lines.map(v=>ctx.measureText(v).width));
  lines.forEach((v,i)=>text(v,0,tipY+i*21,14,now,'clock',.85*tipOpacity(item.age,i/Math.max(1,lines.length))));window.reminderBounds={x,y:y+(tipY-16)*s,w:width*s,h:lines.length*21*s,strength:tipOpacity(item.age)};
 }ctx.restore();
}
function skyState(now){
 const actual=window.scrippsSky(new Date(now)),key=v=>v.stage+'|'+v.target+'|'+v.phaseName;
 if(!skyDisplay||now-skyLast>2000||now<skyLast){skyDisplay=actual;skyPending=null;}
 else if(key(actual)!==key(skyDisplay)){if(!skyPending||key(actual)!==key(skyPending))skyDue=Math.ceil(now/30000)*30000+650;skyPending=actual;if(now>=skyDue){skyDisplay=skyPending;skyPending=null;}}
 else{skyDisplay=actual;skyPending=null;}skyLast=now;return skyDisplay;
}
function moon(x,y,phase){
 const R=22,side=phase<=.5?1:-1,c=Math.cos(phase*Math.PI*2),rim=[],term=[];for(let i=0;i<=64;i++){const a=-Math.PI/2+i/64*Math.PI;rim.push([x+side*R*Math.cos(a),y+R*Math.sin(a)]);term.push([x+side*c*R*Math.cos(a),y+R*Math.sin(a)]);}
 ctx.strokeStyle='#b7c9d1';ctx.lineWidth=.8;ctx.globalAlpha=.22;ctx.beginPath();ctx.arc(x,y,R,0,Math.PI*2);ctx.stroke();ctx.beginPath();[...rim,...term.reverse()].forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.globalAlpha=.075;ctx.fillStyle='#c7ced2';ctx.fill();ctx.globalAlpha=.8;ctx.stroke();ctx.globalAlpha=1;
}
function report(now){
 window.scrippsBounds=null;if(!settings.surf&&!settings.sky)return;
 const s=Math.min(1,(w-40)/400,h/650),height=(settings.surf?130:0)+(settings.sky?150:0)+40,x=Math.max(20,w-400*s-Math.min(104,w*.06)),y=Math.max(h*.4,h-height*s-Math.min(65,h*.08));
 window.scrippsBounds={x,y,w:400*s,h:height*s};ctx.save();ctx.translate(x,y);ctx.scale(s,s);let row=0;
 if(settings.surf){text('S C R I P P S  /  O F F S H O R E',0,16,12,now);divider(0,30,390,now,'report');const current=waves&&now-waves.time<10800000?waves:null;
  text(current?current.feet.toFixed(1)+' ft':'— ft',102,74,32,now);text(current&&current.period?current.period.toFixed(0)+'s period · model estimate':'Model estimate · '+(fetching?'Loading':'Unavailable'),102,99,12,now);
  const pts=[];for(let n=0;n<=50;n++){const u=n/50;pts.push([u*80,76+Math.sin(u*Math.PI*3.2-motion)*(current?4+current.feet:5)]);}ctx.lineWidth=.8;ctx.strokeStyle='#a9b9c1';ctx.globalAlpha=.8;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();ctx.globalAlpha=1;row=135;
 }
 if(settings.sky){const sky=skyState(now),name=zone(settings.zone),key=name+settings.clock;if(key!==eventFormatKey){eventFormatKey=key;eventFormat=new Intl.DateTimeFormat('en-US',{timeZone:name,hour:'numeric',minute:'2-digit',hourCycle:settings.clock==='24'?'h23':'h12'});}const fmt=eventFormat;
  if(sky.night){moon(40,row+60,sky.phase);text(sky.phaseName,102,row+19,14,now);text(countdown(sky.target,now),102,row+55,28,now);text(sky.stage==='moonpeak'?'Until moon peak':'Until sunrise',102,row+79,12,now);text('Sunrise · '+fmt.format(new Date(sky.sunrise)),102,row+105,12,now);}
  else{ctx.strokeStyle='#a9b9c1';ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(40,row+57,22,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(8,row+79);ctx.lineTo(72,row+79);ctx.stroke();ctx.globalAlpha=1;text('Sunset · Scripps Pier',102,row+19,14,now);text(fmt.format(new Date(sky.sunset)),102,row+55,32,now);text(countdown(sky.sunset,now)+' until sunset',102,row+84,12,now);}
 }divider(0,height-15,390,now,'report');ctx.restore();
}
function influence(x,y){let vx=0,vy=0,alpha=1;for(const r of [window.clockBounds,window.reminderBounds,window.scrippsBounds]){if(!r)continue;const nx=(x-r.x-r.w/2)/(r.w*.65),ny=(y-r.y-r.h/2)/(r.h*.8),weight=Math.exp(-2*(nx*nx+ny*ny))*(r.strength??1),len=Math.hypot(nx,ny)||1;vx+=nx/len*weight;vy+=ny/len*weight;alpha=Math.min(alpha,1-.65*weight);}return {x:vx,y:vy,alpha};}
function animate(time){
 requestAnimationFrame(animate);if(document.hidden)return;const elapsed=last?Math.min(.1,(time-last)/1000):0;last=time;const dt=reduced.matches?0:elapsed;motion+=dt;const now=Date.now();ctx.clearRect(0,0,w,h);
 // Paint overlays first so this same frame's bounds guide particle avoidance.
 if(running){topOverlay(now);report(now);if(settings.surf&&now-lastFetch>1800000)loadWaves();}else window.clockBounds=window.reminderBounds=window.scrippsBounds=null;
 for(const p of stars){const field=influence(p.x,p.y),a=Math.atan2(p.dy,p.dx)+Math.sin(motion*.15+p.phase)*dt*.018;p.dx=Math.cos(a);p.dy=Math.sin(a);p.x+=(p.dx*p.speed+field.x*8)*dt;p.y+=(p.dy*p.speed+field.y*8)*dt;
  if(p.x<3||p.x>w-3){p.x=Math.max(3,Math.min(w-3,p.x));p.dx=-p.dx;}if(p.y<3||p.y>h-3){p.y=Math.max(3,Math.min(h-3,p.y));p.dy=-p.dy;}
 }
 const frame={motion,now,dt,audio:0},system=window.ScrippsConstellations,points=running&&!reduced.matches?system.prepare(stars,frame,w,h,ctx):stars.map(p=>({...p,link:1,member:false}));
 ctx.lineWidth=.65;
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){const a=points[i],b=points[j],d=Math.hypot(a.x-b.x,a.y-b.y);if(d>135)continue;const alpha=(1-d/135)*.25*a.link*b.link*system.ambientLinkAlpha(a.x,a.y,b.x,b.y)*Math.min(influence(a.x,a.y).alpha,influence(b.x,b.y).alpha);if(alpha<.004)continue;ctx.globalAlpha=alpha;ctx.strokeStyle='#b9c4cc';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
 if(running&&!reduced.matches)system.drawLines(ctx,frame,w,h);
 points.forEach((p,i)=>{const e=running&&!reduced.matches?system.dotEffect(i,frame,w,h):{offset:0,offsetY:0},alpha=p.alpha*influence(p.x,p.y).alpha*(p.member?1:system.ambientAlpha(p.x,p.y));ctx.globalAlpha=alpha;ctx.fillStyle='#d3d8d6';ctx.beginPath();ctx.arc(p.x+(e.offset||0),p.y+(e.offsetY||0),p.radius,0,Math.PI*2);ctx.fill();
  if(e.fringe){for(const [sign,color]of [[1,'#66b8e6'],[-1,'#e6cf82']]){ctx.globalAlpha=alpha*e.fringe;ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x+(e.offset||0)+sign*.9,p.y+(e.offsetY||0),p.radius,0,Math.PI*2);ctx.fill();}}
 });if(running&&!reduced.matches)system.drawLabels(ctx,frame,w,h);ctx.globalAlpha=1;
}
reduced.addEventListener('change',()=>{window.ScrippsConstellations.reset();last=0;});requestAnimationFrame(animate);
// Compact read-only diagnostics for reproducible QA; no telemetry is transmitted.
window.StarsDebug={get settings(){return {...settings};},get running(){return running;},get waves(){return waves;},get hiddenSince(){return hiddenSince;},snapshot:()=>window.ScrippsConstellations.snapshot()};
