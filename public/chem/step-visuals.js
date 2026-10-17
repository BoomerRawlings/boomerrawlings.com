import {NA} from './model.js';
import {number} from './simple-lessons.js';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const text=(x,y,s)=>'<text x="'+x+'" y="'+y+'" text-anchor="middle">'+esc(s)+'</text>';
const atom=(x,y,label='O',charge='')=>'<circle cx="'+x+'" cy="'+y+'" r="18" class="atom"/>'+text(x,y+5,label)+(charge?text(x+22,y-16,charge):'');
const pair=(x,y,a='O',b='O')=>'<path d="M'+x+' '+y+'h38" class="bond"/>'+atom(x,y,a)+atom(x+38,y,b);
const arrow=(x,y,length=40)=>'<path d="M'+x+' '+y+'h'+length+'m-8 -6 8 6 -8 6" class="arrow"/>';
const svg=(body,label)=>'<svg viewBox="0 0 400 160" role="img" aria-label="'+esc(label)+'">'+body+'</svg>';
const flow=items=>'<div class="visual-flow" role="img" aria-label="'+esc(items.join(' to '))+'">'+items.map((s,i)=>'<span class="flow-item">'+(i?'<b aria-hidden="true">→</b>':'')+'<span>'+esc(s)+'</span></span>').join('')+'</div>';
function cancel(value,unit,top,remaining,bottom,result){return '<div class="unit-picture" role="img" aria-label="'+esc(unit+' cancels with '+unit+'; '+remaining+' remains')+'"><div class="unit-equation"><span>'+esc(value)+' <del>'+esc(unit)+'</del></span><b>×</b><span class="unit-fraction"><span>'+esc(top)+' <strong>'+esc(remaining)+'</strong></span><span>'+esc(bottom)+' <del>'+esc(unit)+'</del></span></span></div><p><del>'+esc(unit)+'</del> cancels → <strong>'+esc(remaining)+' remains</strong></p><p class="visual-result">'+esc(result)+'</p></div>';}
export function stepVisual(lesson,index){
 const id=lesson.id,s=lesson.steps[index],last=s.work.split('\n').at(-1);let body;
 const mass=Number(lesson.given.split(' ')[0]),m=mass/32;
 if(id==='mass-count'&&index>0&&index<4){const rows=[[mass,'g O₂','1','mol O₂','32.00'],[number(m),'mol O₂',number(NA),'O₂ molecules','1'],[number(m*NA),'O₂ molecules','2','O atoms','1']];return cancel(...rows[index-1],last);}
 if(id==='count-mass'&&index<3){const rows=[[number(lesson.values.atoms),'O atoms','1','O₂ molecule','2'],[number(lesson.values.molecules),'O₂ molecules','1','mol O₂',number(NA)],[number(lesson.values.mol),'mol O₂','32.00','g O₂','1']];return cancel(...rows[index],last);}
 if(id==='liquid'&&index<4){const v=Number(lesson.given.split(' ')[0]),g=v*1000,n=g/18.02;const rows=[[v,'L','1000','mL','1'],[number(g),'mL','1.00','g H₂O','1'],[number(g),'g H₂O','1','mol H₂O','18.02'],[number(n),'mol H₂O',number(NA),'H₂O molecules','1']];return cancel(...rows[index],last);}
 if(id==='instrument'){
 const scenes=[
 pair(45,115)+pair(90,65)+arrow(150,85)+pair(240,40)+pair(300,115)+text(90,150,'liquid')+text(285,150,'gas: spread apart'),
 pair(55,80)+text(100,28,'fast electron →')+arrow(120,80)+atom(210,80,'O','+')+atom(270,80,'O')+atom(340,45,'e','−')+text(205,130,'ion +')+text(325,118,'neutral')+text(200,150,'O₂ breakup'),
 atom(55,80,'ion','+')+arrow(90,80,58)+atom(200,80,'ion','+')+arrow(238,80,125)+text(200,28,'Electric field speeds ions up')+text(200,145,'Same charge + voltage → same KE'),
 '<rect x="130" y="15" width="210" height="120" rx="10" class="field"/>'+text(235,40,'MAGNETIC FIELD')+'<path d="M20 115H140Q210 115 210 65 M140 115Q300 115 300 65" class="arrow"/>'+atom(210,64,'L','+')+atom(300,64,'H','+')+text(210,115,'lighter')+text(300,115,'heavier')+text(200,154,'Equal charge & KE'),
 '<path d="M15 80H230" class="arrow"/>'+atom(70,80,'ion','+')+'<rect x="240" y="40" width="18" height="80" class="detector"/>'+arrow(270,80,35)+'<path d="M320 110V80M345 110V38M370 110V65" class="peak"/>'+text(110,140,'ion hits detector')+text(340,140,'peaks')
 ];return svg(scenes[index],s.title+'. '+s.why);
 }
 if(id==='spectrum'){
 const heights=[30,105,58],xs=[175,319,328];body='<path d="M35 15V125H365" class="axis"/>'+xs.map((x,i)=>'<path d="M'+x+' 125v-'+heights[i]+'" class="peak '+((index===1&&i===2||index===2&&i===1)?'selected':'')+'"/>'+(i?'<path d="M'+x+' 127L'+[0,285,355][i]+' 135" class="axis"/>':'')+text([175,285,355][i],155,[15,31,32][i])).join('')+text(55,25,'signal')+text(380,120,'m/z');
 if(index===3)return flow(['Cl:35,37','35+35:70','35+37:72','37+37:74']);
 if(index===4)return flow(['mass 32','charge +2','32 ÷ 2','m/z 16']);
 return svg(body,'Teaching spectrum: fragment31 tallest; intact ion32. Peak heights are illustrative.');
 }
 if(id==='count'||id==='mass-count'){
 if(id==='mass-count'||index===0)body=pair(145,65)+text(200,130,id==='mass-count'?'2 × 16.00 = 32.00 g per mole':'O₂ = two O atoms');
 else if(index===1)body=pair(65,60)+text(85,125,'one element')+pair(255,60,'O','C')+'<path d="M293 60H333" class="bond"/>'+atom(333,60)+text(290,125,'two elements');
 else if(index===2)return flow(['1 mol O₂','huge count','2 O each','2 mol O']);
 else body=atom(65,60,'He')+text(65,125,'1 atom')+pair(245,60)+text(265,125,'1 molecule, 2 atoms');
 return svg(body,s.why);
 }
 if(id==='isotopes'){
 if(index<2)body='<path d="M70 120V95M180 120V20" class="peak"/>'+text(70,145,'25')+text(180,145,'100')+text(300,65,index===0?'25 + 100':'25 / 125')+text(300,100,index===0?'total 125':'20% light');
 else body='<path d="M60 95H340" class="axis"/>'+text(60,125,'10')+text(340,125,'11')+'<circle cx="284" cy="95" r="9" class="atom"/>'+text(284,65,'mean 10.80')+text(200,150,'Closer to common isotope');
 return svg(body,s.why);
 }
 if(id==='gas'){
 if(index===0)return flow(['26.85°C','add 273.15','300 K']);
 if(index===1)return flow(['P × V','divide R × T','moles n']);
 if(index===2)return '<div class="unit-picture" role="img" aria-label="Atmosphere, liter and kelvin units cancel; moles remain"><div class="gas-units"><del>atm</del> × <del>L</del><hr><del>L</del> × <del>atm</del> / (<strong>mol</strong> × <del>K</del>) × <del>K</del></div><p>Matching units cancel. <strong>Moles remain.</strong></p></div>';
 if(index===3)return cancel('Mole count','mol',number(NA),'particles','1',last);
 return svg('<rect x="25" y="35" width="120" height="80" class="tile"/><rect x="245" y="35" width="120" height="80" class="tile"/>'+atom(58,75,'•')+atom(110,75,'•')+atom(278,75,'•')+atom(330,75,'•')+arrow(155,75,70)+text(85,145,'300 K → P')+text(305,145,'600 K → 2P')+text(200,20,'Same n and V'),s.why);
 }
 if(id==='formula'){
 const rows=[['100 g sample','40 g C','6.71 g H','53.29 g O'],['grams','÷ g/mol','moles'],['mole amounts','÷ smallest','1:2:1'],['molecular mass','÷ CH₂O mass','multiplier'],['CH₂O','× every count',last.split('\n')[0].split('→').at(-1).trim()]];return flow(rows[index]);
 }
 if(id==='energy'){
 if(index<2)body='<path d="M35 125H360M35 125V15" class="axis"/><path d="M35 120L140 65H265L345 22" class="curve"/>'+text(205,48,'boiling plateau')+text(200,150,index===0?'Energy in; same temperature':'PE rises; same average KE');
 else if(index===2)return flow(['lower pressure','easier to boil','lower boiling T']);
 else body='<path d="M30 50H370M30 135V15" class="axis"/><path d="M50 15Q85 155 140 112Q200 50 365 50" class="curve"/>'+text(140,145,'well: −4')+text(320,30,'apart: 0')+text(265,120,'energy needed: +4');
 return svg(body,s.why);
 }
 return flow(id==='count-mass'?['atoms','molecules','mol','grams']:['molecules','mol','grams','volume']);
}
export function notationHelp(text){
 const bits=[];if(/[₀-₉]/.test(text))bits.push('Small lower number = atoms in one molecule (O₂ = O–O).');
 if(/10[⁰-⁹⁻]+/.test(text))bits.push('10²³ means 10 multiplied by itself 23 times.');
 if(/[⁺⁻]/.test(text))bits.push('Raised + / − = electric charge; a dot • means an unpaired electron.');
 return bits.join(' ');
}
