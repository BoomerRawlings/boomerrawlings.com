import {NA,routes,convert} from './model.js';

const fmt=n=>Number(n.toPrecision(4)).toString();
export function generatePractice(random=Math.random){
  const pick=a=>a[Math.floor(random()*a.length)];
  const integer=(a,b)=>a+Math.floor(random()*(b-a+1));
  const rows=[];
  const add=(topic,prompt,steps,source)=>rows.push({topic,prompt,steps,source});
  const [binary,name]=pick([['CO','carbon monoxide'],['CO₂','carbon dioxide'],['NCl₃','nitrogen trichloride'],['CF₄','carbon tetrafluoride'],['N₂O','dinitrogen monoxide']]);
  add('Classification & naming',`Name ${binary} as a binary covalent compound. Is it an element, compound, or mixture? Explain what its subscripts count and contrast it with O₂.`,[
    `${binary}: ${name}. It is a compound: two different elements bonded in fixed proportions. Subscripts count atoms per molecule, not moles in the entire sample.`,
    'O₂ has two bonded atoms but only one element, so it is an elemental molecular substance. A mixture contains multiple substances; molecule count alone cannot distinguish element from compound.'
  ],'source-m2');
  const routeId=pick(Object.keys(routes)),amount=integer(15,250)/10;
  const start=(routeId.includes('reverse')&&routes[routeId].unit.includes('molecules'))||routeId==='oxygen-atoms'?amount*1e22:amount;
  const result=convert(routeId,start);
  add('Conversion chains',`Convert ${fmt(start)} ${result.route.unit}: ${result.route.title}. Show every factor, then explain how to reverse the route.`,[
    result.route.note,...result.steps.map(s=>`${fmt(s.before)} ${s.from} × (${fmt(s.num)} ${s.to} / ${fmt(s.den)} ${s.from}) = ${fmt(s.value)} ${s.to}. ${s.reason}`),
    'Reverse: start with the final quantity and apply every factor inverted, in reverse order. Keep unrounded intermediate values.'
  ],'conversions');
  const [symbol,atomic]=pick([['H',1.008],['N',14.01],['O',16],['F',19],['Cl',35.45],['Br',79.90],['I',126.90]]);
  const grams=integer(10,300)/10,molar=2*atomic,reverse=random()<.5,count=grams/molar*NA*2;
  add('Diatomic molecules',reverse?`A sample of ${symbol}₂ contains ${fmt(count)} ${symbol} atoms (not molecules). Find grams of ${symbol}₂.`:`For ${fmt(grams)} g ${symbol}₂, find moles, molecules, and total ${symbol} atoms.`,reverse?[
    `${fmt(count)} ${symbol} atoms × (1 molecule ${symbol}₂ / 2 ${symbol} atoms) × (1 mol ${symbol}₂ / ${fmt(NA)} molecules ${symbol}₂) × (${fmt(molar)} g ${symbol}₂ / 1 mol ${symbol}₂) = ${fmt(count/2/NA*molar)} g ${symbol}₂.`,
    `M(${symbol}₂) = 2 × ${atomic} = ${fmt(molar)} g/mol. Divide atoms by two before using a molecular count.`
  ]:[`${fmt(grams)} g ${symbol}₂ × (1 mol ${symbol}₂ / ${fmt(molar)} g ${symbol}₂) = ${fmt(grams/molar)} mol ${symbol}₂.`,`${fmt(grams/molar)} mol ${symbol}₂ × (${fmt(NA)} molecules / 1 mol) = ${fmt(grams/molar*NA)} molecules ${symbol}₂.`,`${fmt(grams/molar*NA)} molecules ${symbol}₂ × (2 ${symbol} atoms / 1 molecule ${symbol}₂) = ${fmt(count)} ${symbol} atoms.`],'particles');
  const volume=integer(2,20),t1=integer(250,320),t2=integer(330,500),p1=integer(1,3),p2=integer(1,4);
  add('Gas laws',`A sealed flexible ideal-gas sample has V₁=${volume} L, T₁=${t1} K, P₁=${p1} atm. At T₂=${t2} K and P₂=${p2} atm, find V₂ and explain each change.`,[
    `Fixed amount: P₁V₁/T₁=P₂V₂/T₂. V₂ = ${volume} L × (${t2} K / ${t1} K) × (${p1} atm / ${p2} atm) = ${fmt(volume*t2/t1*p1/p2)} L.`,
    `Increasing kelvin temperature favors expansion; ${p2>p1?'increasing external pressure favors compression':p2<p1?'decreasing external pressure also favors expansion':'unchanged pressure contributes a factor of one'}. Never substitute Celsius into temperature ratios or use 22.4 L/mol at arbitrary conditions.`
  ],'gases');
  const pressure=integer(1,3),gasV=integer(3,24),temp=integer(280,400),n=pressure*gasV/(.08206*temp);
  add('Ideal gas → particles',`Ideal O₂ gas: P=${pressure} atm, V=${gasV} L, T=${temp} K. Use R=0.08206 L·atm/(mol·K). Find moles and O atoms.`,[
    `n=PV/RT=(${pressure} atm × ${gasV} L)/(0.08206 L·atm/(mol·K) × ${temp} K)=${fmt(n)} mol O₂.`,
    `${fmt(n)} mol O₂ × (${fmt(NA)} molecules O₂ / mol O₂) × (2 O atoms / molecule O₂) = ${fmt(n*NA*2)} O atoms.`
  ],'gases');
  const light=pick([20,24,28,32]),heavy=light+2,atomicNumber=light/2,a=integer(50,90),b=integer(5,40),sum=a+b;
  add('Isotopes & graph heights',`Hypothetical X⁺ sample has atomic number ${atomicNumber} and isotope mass numbers ${light} and ${heavy}, with relative heights ${a} and ${b}. Assume +1 ions, equal response and nominal masses. Find isotope percentages, average atomic mass, base peak, and proton/neutron/electron counts.`,[
    `Normalize the family: total height=${a}+${b}=${sum}; fractions=${a}/${sum} and ${b}/${sum}, giving ${fmt(100*a/sum)}% and ${fmt(100*b/sum)}%.`,
    `Average=(${light} u × ${a}/${sum})+(${heavy} u × ${b}/${sum})=${fmt((light*a+heavy*b)/sum)} u. Base peak: m/z ${light}. A height is not automatically a population percentage.`,
    `Each ion has ${atomicNumber} protons and ${atomicNumber-1} electrons. Neutrons=A−Z: ${light-atomicNumber} and ${heavy-atomicNumber}. Ionization changes electrons; isotopes differ in neutrons. Hypothetical abundances and nominal masses are not measured natural isotope data.`
  ],'isotopes');
  const p=integer(65,85)/100,q=1-p;
  add('Diatomic isotope spectrum',`Hypothetical chlorine has ${fmt(p*100)}% ³⁵Cl and ${fmt(q*100)}% ³⁷Cl. Predict Cl₂⁺ molecular peaks and probabilities; locate atomic fragments. Can you predict fragment heights?`,[
    `Random pairing: m/z70: p²=${fmt(p*p*100)}%; m/z72: 2pq=${fmt(2*p*q*100)}%; m/z74: q²=${fmt(q*q*100)}%. Mixed pairs have two arrangements. These percentages refer only to the molecular family.`,
    'Atomic fragments appear near35 and37 for +1 ions. Their heights relative to molecular peaks require fragmentation/response information; isotope abundances alone do not determine them.'
  ],'spectrum');
  const [parent,fragment,formula,assignment,loss]=pick([[32,31,'CH₃OH','CH₃O⁺','H•'],[32,15,'CH₃OH','CH₃⁺','OH•'],[16,15,'CH₄','CH₃⁺','H•'],[16,14,'CH₄','CH₂⁺','H₂']]);
  const parentHeight=integer(15,80);
  add('Fragmentation & reading spectra',`Illustrative electron-impact spectrum of ${formula}: intact +1 ion at m/z ${parent} (height ${parentHeight}); fragment at m/z ${fragment} (height100). Assign the base peak, mass loss, and a possible neutral loss. Where does fragmentation occur?`,[
    `Base peak=${fragment}, not ${parent}; molecular ion=${parent}. Nominal mass loss=${parent}−${fragment}=${parent-fragment} u. A possible assignment is ${assignment} plus neutral ${loss}. Mass balance alone does not prove a unique mechanism.`,
    'Energetic electron impact in the ionization region can leave an unstable molecular ion that breaks bonds (fragmentation can also occur later). Neutral fragments are not directly recorded as positive-ion peaks. Vaporization is distinct from bond breaking.'
  ],'mass-spec');
  const m=integer(10,30)*2,z=pick([1,2]);
  add('Instrument sequence & deflection',`An ion of nominal mass ${m} u has charge +${z}. Where does it appear? Compare the curvature of two +1 ions of masses ${m} and ${2*m} u accelerated through the same voltage. Name every instrument stage.`,[
    `m/z=${m}/${z}=${m/z}. Sequence: vaporization → ionization → acceleration → magnetic deflection → detection. Deflection occurs in the analyzing magnetic field, after acceleration.`,
    'Equal charge and accelerating voltage give equal kinetic energy, not speed. r=√(2mKE)/(qB); the heavier ion has √2 times the radius and bends less. Vacuum reduces collisions.'
  ],'mass-spec');
  const [emp,c,h,o,efMass]=pick([['CH₂O',1,2,1,30.026],['CHO',1,1,1,29.018],['C₂H₄O',2,4,1,44.052]]);
  const k=emp==='CHO'?pick([2,4]):integer(2,4);
  const pc=c*12.01/efMass*100,ph=h*1.008/efMass*100,po=o*16/efMass*100;
  add('Composition → formulas',`Hypothetical C/H/O compound: ${pc.toFixed(3)}% C, ${ph.toFixed(3)}% H, ${po.toFixed(3)}% O; molar mass ${(efMass*k).toFixed(3)} g/mol. Find empirical and molecular formulas. Use C12.01,H1.008,O16.00 g/mol.`,[
    `Choose100g: C=${pc.toFixed(3)}g/(12.01g/mol)≈${fmt(pc/12.01)}mol; H=${ph.toFixed(3)}g/(1.008g/mol)≈${fmt(ph/1.008)}mol; O=${po.toFixed(3)}g/(16.00g/mol)≈${fmt(po/16)}mol.`,
    `Divide all mole values by the smallest: C:H:O≈${c}:${h}:${o}. Empirical formula=${emp}; empirical molar mass=${efMass}g/mol.`,
    `Multiplier=(${(efMass*k).toFixed(3)}g/mol)/(${efMass}g/mol)=${k}. Molecular atom counts: C${c*k}H${h*k}O${o*k}. Percent rounding is intentional; molecular formula need not uniquely identify structure.`
  ],'formulas');
  const mass=integer(10,90),mult=integer(2,5),density=integer(8,20)/10;
  add('Matter & identifying properties',`A pure liquid has mass ${mass}g and density ${density}g/mL. Scale the sample mass by ${mult}. Find both volumes. Which quantities identify the substance? Contrast physical mixing with chemical reaction.`,[
    `V₁=${mass}g × (1mL/${density}g)=${fmt(mass/density)}mL; V₂=${mass*mult}g × (1mL/${density}g)=${fmt(mass*mult/density)}mL. Mass and volume scale; density is intensive at fixed conditions.`,
    'A single property may not uniquely identify a substance; compare several characteristic properties at specified conditions. Mixtures combine substances without requiring new chemical identities; reactions change chemical identities. Diatomic elements remain elements, not compounds.'
  ],'source-m2');
  const boiling=integer(60,120),lower=boiling-integer(10,30);
  add('Phases, energy & separation',`Pure liquid A boils at ${boiling}°C and B at ${lower}°C at1atm. Compare volatility. Explain a heating plateau and predict boiling-temperature change when external pressure drops.`,[
    'B has the lower normal boiling point and is more volatile; comparative distillation exploits volatility differences (a mixture need not separate perfectly in one step).',
    'At a constant-pressure boiling plateau, added energy changes intermolecular potential energy while temperature and average kinetic energy remain approximately constant. Particles remain in motion; vaporization does not split molecules.',
    'Boiling occurs when vapor pressure equals external pressure. Lower external pressure lowers the boiling temperature. In a closed liquid–vapor equilibrium, evaporation and condensation continue at equal rates.'
  ],'connections');
  const well=integer(2,8),kinetic=integer(1,5);
  add('Particle models & potential energy',`An illustrative two-particle potential has a minimum at −${well} energy units and approaches0 at infinite separation. What increase in potential energy takes the pair from the minimum to infinite separation? If total energy is conserved and PE falls by ${kinetic} units, what happens to KE?`,[
    `Energy to reach separated reference=0−(−${well})=${well} units. A deeper well means stronger binding in this model. At the minimum, attractive and repulsive forces balance; the particles are not necessarily motionless.`,
    `ΔKE=−ΔPE=+${kinetic} units in an isolated system. A static particle drawing omits motion and may distort particle sizes/spacings. At equal temperature, ideal gases have equal mean translational KE; heavier particles have lower characteristic speeds.`
  ],'connections');
  return rows;
}

if(typeof document!=='undefined'){
  const container=document.getElementById('random-problems');
  let batch=0;
  function render(){
    const rows=generatePractice();
    container.replaceChildren(...rows.map((row,index)=>{
      const article=document.createElement('article');article.className='qa-item';
      const heading=document.createElement('h3');heading.textContent=`${index+1}. ${row.topic}`;
      const prompt=document.createElement('p');prompt.textContent=row.prompt;
      const detail=document.createElement('details');detail.className='qa-solution';
      const summary=document.createElement('summary');summary.textContent='Show worked answer & reasoning';
      const list=document.createElement('ol');
      row.steps.forEach(step=>{const li=document.createElement('li');li.textContent=step;list.append(li);});
      const link=document.createElement('a');link.href=`#${row.source}`;link.textContent='Review source topic ↑';
      detail.append(summary,list,link);article.append(heading,prompt,detail);return article;
    }));
    document.getElementById('random-status').textContent=`Set ${++batch}: ${rows.length} problems. New values and scenarios; all answers hidden.`;
  }
  document.getElementById('random-new').addEventListener('click',render);render();
}
