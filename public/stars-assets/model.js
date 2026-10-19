// Stars browser runtime © 2026 Boomer Rawlings. GPL-3.0-or-later.
export const intervals=[0,5,10,15,20,30,60];
export function tipsLabel(value){return value===0?'Disabled':value===60?'Once an hour':'Every '+value+' minutes';}
export function constellationOptions(settings){const n=normalize(settings).constellationInterval;return {interval:[n,n],initialDelay:[0,0],cadence:n};}
const validZones=new Set(),formatters=new Map();let systemName,systemChecked=0;
export function zone(value='system'){
 if(value==='system'&&(!systemName||Date.now()-systemChecked>60000)){systemName=Intl.DateTimeFormat().resolvedOptions().timeZone;systemChecked=Date.now();}
 const name=value==='system'?systemName:value;
 if(!validZones.has(name)){new Intl.DateTimeFormat('en',{timeZone:name}).format();validZones.add(name);}return name;
}
export function defaults(){return {clock:Intl.DateTimeFormat(undefined,{hour:'numeric'}).resolvedOptions().hour12?'12':'24',seconds:true,zone:'system',surf:true,sky:true,tips:15,constellationInterval:10};}
export function normalize(raw={}){
 const d=defaults(),v={...d,...raw};v.clock=['12','24','off'].includes(v.clock)?v.clock:d.clock;
 v.seconds=typeof v.seconds==='boolean'?v.seconds:d.seconds;v.surf=typeof v.surf==='boolean'?v.surf:d.surf;v.sky=typeof v.sky==='boolean'?v.sky:d.sky;
 v.tips=intervals.includes(Number(v.tips))?Number(v.tips):d.tips;
 const cadence=Number(v.constellationInterval);v.constellationInterval=Number.isFinite(cadence)&&cadence>=10&&cadence<=60?Math.round(cadence/5)*5:d.constellationInterval;
 try{zone(v.zone);}catch{v.zone='system';}return v;
}
export function parts(now,tz){const name=zone(tz);if(!formatters.has(name)){if(formatters.size>16)formatters.clear();formatters.set(name,new Intl.DateTimeFormat('en-GB',{timeZone:name,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));}return Object.fromEntries(formatters.get(name).formatToParts(new Date(now)).map(p=>[p.type,p.value]));}
export function clock(now,settings){
 const p=parts(now,settings.zone),h=Number(p.hour);return {main:(settings.clock==='12'?String(h%12||12):p.hour)+':'+p.minute,seconds:p.second,period:settings.clock==='12'?(h<12?'AM':'PM'):''};
}
export function reminder(now,settings,messages){
 if(!settings.tips)return null;const p=parts(now,settings.zone),minute=Number(p.hour)*60+Number(p.minute),age=(minute%settings.tips)*60000+Number(p.second)*1000+((now%1000)+1000)%1000;
 return age<30150?{text:messages[Math.floor(minute/5)],age,slot:Math.floor(minute/5)}:null;
}
export function tipOpacity(age,x=0){const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);},delay=Math.max(0,Math.min(1,x))*55;return age<30000?smooth((age-delay)/95):1-smooth((age-30000-delay)/95);}
export function countdown(target,now){const s=Math.max(0,Math.ceil((target-now)/1000));return Math.floor(s/3600)+'h '+String(Math.floor(s/60)%60).padStart(2,'0')+'m '+String(s%60).padStart(2,'0')+'s';}
export function marine(data,now=Date.now()){
 const c=data?.current,t=Number(c?.time)*1000;
 if(!Number.isFinite(c?.wave_height)||c.wave_height<0||c.wave_height>30||!Number.isFinite(t)||Math.abs(now-t)>3*3600000)return null;
 return {feet:c.wave_height*3.28084,period:Number.isFinite(c.wave_period)?c.wave_period:null,time:t};
}
