import {NA} from './model.js';
const superscript=n=>String(n).replace(/[-\d]/g,c=>({'-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'}[c]));
export const number=n=>Math.abs(n)>=1e6?Number(n.toExponential(3).split('e')[0])+' × 10'+superscript(Number(n.toExponential(3).split('e')[1])):String(Number(n.toPrecision(4)));
const sub=n=>String(n).replace(/\d/g,c=>'₀₁₂₃₄₅₆₇₈₉'[c]);
const step=(title,why,work)=>({title,why,work});
const quiz=(prompt,options,correct,why)=>({prompt,options,correct,why});
export function makeLessons(random=()=>.5){
  const pick=values=>values[Math.floor(random()*values.length)];
  const mass=pick([8,16,32,64]),mol=mass/32,molecules=mol*NA,atoms=molecules*2;
  const water=pick([.01802,.1802,1.802,18.02]),waterGrams=water*1000,waterMol=waterGrams/18.02;
  const gasMol=pick([.25,.5,1,2]),gasVolume=gasMol*.0821*300;
  const k=pick([2,3,6]),formula=`C${sub(k)}H${sub(2*k)}O${sub(k)}`;
  return [
    {id:'count',title:'1. Atoms, molecules & moles',given:'One O₂ molecule',wanted:'Know what each word counts',source:'particles',signal:'names-entities',terms:'Atom: one unit of an element. Molecule: bonded atoms. Mole: a counting unit, like a dozen but much larger.',steps:[
      step('Read the small number','The subscript tells you how many atoms are in ONE molecule.','O₂ = O—O = 2 oxygen atoms in 1 molecule'),
      step('Separate element from compound','An element has one type of atom. A compound has more than one type.','O₂: only O → element\nCO₂: C and O → compound'),
      step('Scale up with a mole','One mole contains 6.022 × 10²³ of the entity you name.','1 mol O₂ = 6.022 × 10²³ O₂ molecules\nEach molecule has 2 O atoms → 2 mol O atoms'),
      step('Name the thing before counting','Atoms and molecules are different counts. Equal moles of molecules need not have equal masses.','1 mol He: 1 mol atoms\n 1 mol O₂: 1 mol molecules, 2 mol atoms'),
    ],quiz:quiz('You have 4 O₂ molecules. How many O atoms?',['4 atoms','8 atoms','2 atoms'],1,'Each O₂ molecule contains 2 O atoms: 4 × 2 = 8.')},
    {id:'mass-count',title:'2. Grams → molecules → atoms',given:`${mass} g O₂`,wanted:'Number of O atoms',source:'conversions',signal:'show-work',terms:'Molar mass: grams in one mole. For O₂, it is 32.00 g/mol. Nₐ: 6.022 × 10²³ entities per mole.',steps:[
      step('Find grams per mole','O₂ has two O atoms. Each contributes about 16.00 g/mol.','M(O₂) = 2 × 16.00 = 32.00 g/mol'),
      step('Turn grams into moles','Put grams below so grams cancel. Moles remain.',`${mass} g O₂ × (1 mol O₂ / 32.00 g O₂)\n= ${number(mol)} mol O₂`),
      step('Turn moles into molecules','One mole contains Avogadro’s number of molecules.',`${number(mol)} mol O₂ × (${number(NA)} molecules O₂ / 1 mol O₂)\n= ${number(molecules)} molecules O₂`),
      step('Turn molecules into atoms','Multiply by the number of O atoms in each molecule.',`${number(molecules)} molecules O₂ × (2 O atoms / 1 molecule O₂)\n= ${number(atoms)} O atoms`),
      step('Check what you counted','The answer must say O atoms. Stopping at molecules misses a factor of two.',`${mass} g O₂ → ${number(mol)} mol O₂\n→ ${number(molecules)} molecules O₂ → ${number(atoms)} O atoms`),
    ],quiz:quiz('What converts O₂ molecules into O atoms?',['Multiply by 2','Divide by 2','Multiply by 32'],0,'Two O atoms belong to every O₂ molecule. The 32 is molar mass, not atoms per molecule.')},
    {id:'count-mass',values:{mass,mol,molecules,atoms},title:'3. Atoms → molecules → grams',given:`${number(atoms)} O atoms contained in O₂`,wanted:'Grams of O₂',source:'conversions',signal:'reverse',terms:'Read the given carefully: an atom count is not a molecule count. H₂,N₂,O₂,F₂,Cl₂,Br₂,I₂ each contain two atoms per molecule.',steps:[
      step('Turn atoms into molecules','Two O atoms make one O₂ molecule. Divide by two.',`${number(atoms)} O atoms × (1 molecule O₂ / 2 O atoms)\n≈ ${number(molecules)} molecules O₂`),
      step('Turn molecules into moles','Divide by Avogadro’s number because you are undoing the counting step.',`${number(molecules)} molecules O₂ × (1 mol O₂ / ${number(NA)} molecules O₂)\n≈ ${number(mol)} mol O₂`),
      step('Turn moles into grams','Each mole of O₂ has mass 32.00 g.',`${number(mol)} mol O₂ × (32.00 g O₂ / 1 mol O₂)\n≈ ${mass} g O₂`),
      step('Compare the two directions','Use the same equalities. Flip their fractions and reverse their order.','Forward: g → mol → molecules → atoms\nBackward: atoms → molecules → mol → g'),
    ],quiz:quiz('A sample contains 10 N atoms, all paired as N₂. How many N₂ molecules?',['20 molecules','10 molecules','5 molecules'],2,'Each N₂ contains 2 N atoms.10 atoms ÷2 =5 molecules. This factor applies to all seven common diatomic elements.')},
    {id:'liquid',title:'4. Liquid volume → particle count',given:`${water} L liquid H₂O; density 1.00 g/mL`,wanted:'Number of H₂O molecules',source:'conversions',signal:'every-unit',terms:'Density connects volume to mass. Molar mass connects mass to moles. The 1.00 g/mL density here is an approximation for liquid water.',steps:[
      step('Match the volume units','Density uses mL, so first change L to mL.',`${water} L × (1000 mL / 1 L) = ${number(waterGrams)} mL`),
      step('Use density to get grams','The number stays the same here, but the unit changes. Show this factor.',`${number(waterGrams)} mL × (1.00 g / 1 mL)\n= ${number(waterGrams)} g H₂O`),
      step('Use molar mass to get moles','One mole of water has mass 18.02 g.',`${number(waterGrams)} g H₂O × (1 mol H₂O / 18.02 g H₂O)\n= ${number(waterMol)} mol H₂O`),
      step('Count the molecules','Multiply moles by molecules per mole.',`${number(waterMol)} mol H₂O × (${number(NA)} molecules H₂O / 1 mol H₂O)\n= ${number(waterMol*NA)} molecules H₂O`),
      step('Reverse it if asked for volume','Undo each factor. Use liquid density only for the stated liquid conditions.','Molecules → mol → g → mL → L\nUse mol/molecules, g/mol, mL/g, then L/mL.'),
    ],quiz:quiz('What extra fact connects a liquid volume to mass?',['Density','Avogadro’s number','The number of isotopes'],0,'Density is mass per volume. You need it before using molar mass.')},
    {id:'gas',title:'5. Gas questions',given:`P=1.00 atm; V=${number(gasVolume)} L; T=26.85°C`,wanted:'Moles of ideal gas',source:'gases',signal:'gas-reasoning',terms:'P: pressure. V: volume. n: moles. T: kelvin temperature. R=0.0821 L·atm/(mol·K) for these units.',steps:[
      step('Change Celsius to kelvin','The gas constant uses kelvin, so the temperature must match.','T = 26.85 + 273.15 = 300.00 K'),
      step('Choose the gas equation','You know pressure, volume and temperature. Solve for the missing amount.','PV = nRT\nn = PV / (RT)'),
      step('Put in the values and units','L and atm cancel; kelvin cancels; moles remain.',`n = (1.00 atm × ${number(gasVolume)} L)\n/ (0.0821 L·atm/(mol·K) × 300.00 K)\n≈ ${number(gasMol)} mol gas`),
      step('Connect moles to particles','The gas law gives moles. You already know how to turn moles into particle counts.',`${number(gasMol)} mol × (${number(NA)} particles / 1 mol)\n≈ ${number(gasMol*NA)} gas particles`),
      step('Predict before calculating','With amount and volume fixed, higher kelvin temperature means higher pressure.','Double T, fixed n and V → double P\nUse 22.4 L/mol only at 273.15 K and 1 atm, not for a liquid.'),
    ],quiz:quiz('A sealed rigid ideal-gas bottle warms from 300 K to 600 K. Its pressure…',['stays the same','doubles','halves'],1,'The amount and volume stay fixed. P follows kelvin temperature, so 600/300=2.')},
    {id:'isotopes',title:'6. Isotopes & averages',given:'Hypothetical isotope masses 10 u and 11 u; heights 25 and 100',wanted:'Average atomic mass',source:'isotopes',signal:'weighted-average',terms:'Isotopes: same protons, different neutrons. Relative height: signal compared with a reference peak, not automatically percent abundance.',steps:[
      step('Add the relevant heights','To find fractions, divide each height by the total. Assume comparable detector response.','Total = 25 + 100 = 125'),
      step('Turn heights into fractions','Use the same denominator for both isotopes.','Light isotope: 25/125 = 0.20 = 20%\nHeavy isotope: 100/125 = 0.80 = 80%'),
      step('Weight each mass and add','A common isotope should contribute more to the average.','Average = (0.20 × 10 u) + (0.80 × 11 u)\n= 10.80 u'),
      step('Check the meaning','The mean lies between 10 and 11 and closer to the more common 11. It is not a third isotope.','No atom must weigh10.80 u.\nIsotopes change neutrons; +1 ionization removes one electron.'),
    ],quiz:quiz('Isotopes of masses 20 u and 22 u occur at 25% and 75%. The average is…',['21.0 u','21.5 u','22.0 u'],1,'0.25(20)+0.75(22)=21.5 u. The heavier isotope is more common, so the mean is closer to 22.')},
    {id:'instrument',title:'7. Inside a mass spectrometer',given:'A sample entering the classroom magnetic-sector instrument',wanted:'Explain the steps in order',source:'mass-spec',signal:'fragments',terms:'Ion: a charged particle. Fragmentation: a molecule breaking into smaller pieces. Deflection: a moving ion’s path bending.',steps:[
      step('1. Vaporize','Make gas-phase particles that can move through the instrument. This is a phase change.','Sample → gas-phase particles\nVaporization is not the same as breaking molecular bonds.'),
      step('2. Ionize','Energetic electrons knock electrons off sample particles. Unstable molecular ions may also break apart.','Neutral particle → positive ion\nSome products are charged fragments; neutral fragments do not give their own ion peaks.'),
      step('3. Accelerate','Electric fields speed up the ions into a beam.','Same charge + same accelerating voltage → same kinetic energy\nThat does NOT mean same speed.'),
      step('4. Deflect','The analyzing magnetic field bends moving ions. Under equal charge and kinetic energy, lighter ions bend more tightly.','This is where deflection happens.\nThe instrument separates ions by mass-to-charge ratio, m/z.'),
      step('5. Detect','Ions reaching the detector produce a signal. Vacuum reduces unwanted collisions along the way.','Detector signal → peaks on a spectrum\nOrder: vaporize → ionize → accelerate → deflect → detect'),
    ],quiz:quiz('Where does magnetic deflection occur?',['During vaporization','In the analyzing magnetic field, after acceleration','At the detector'],1,'The beam must first contain moving ions. The magnetic analyzer bends their paths.')},
    {id:'spectrum',title:'8. Read a spectrum & explain fragments',given:'Illustrative methanol spectrum: m/z 31 is tallest; intact +1 ion at 32',wanted:'Tell what the peaks mean',source:'spectrum',signal:'spectrum-cues',terms:'x-axis: mass-to-charge ratio. y-axis: detector signal (read its label). Base peak: tallest peak. Molecular ion: the intact molecule after electron removal.',steps:[
      step('Read the axes first','Peak position and peak height answer different questions.','Position: which m/z?\nHeight: how much signal? A relative height is not automatically a population percentage.'),
      step('Find the intact molecule','The problem labels 32 as the intact +1 ion. Tallest does not mean intact.','CH₃OH nominal mass = 12 + 4(1) + 16 = 32\nMolecular-ion peak: m/z 32'),
      step('Explain a smaller fragment','An ion at 31 can be consistent with losing neutral H from the ion at 32. Mass difference alone does not prove a unique mechanism.','32 − 31 = 1 u lost\nPossible pathway: CH₃OH⁺• → CH₃O⁺ + H•\nBase peak:31; molecular ion:32'),
      step('Do not mistake combinations for new isotopes','Two chlorine isotopes can produce five peaks when atomic fragments and molecular ions are both present.','Cl⁺:35,37\nCl₂⁺:35+35=70; 35+37=72; 37+37=74\nMixed-pair probability:2 pq, because there are two arrangements.'),
      step('Check the charge assumption','For charge+1, nominal mass and m/z have the same numerical value. Charge+2 changes the position.','Ion mass 32 u, charge+1 → m/z 32\nIon mass 32 u, charge+2 → m/z 16'),
    ],quiz:quiz('A spectrum has tallest peak 31 and a labeled intact +1 ion at 32. The molecular-ion peak is…',['31','32','whichever peak is tallest'],1,'Molecular ion means intact molecule. The base peak is simply the tallest peak.')},
    {id:'formula',title:'9. Find a chemical formula',given:`40.00% C,6.71% H,53.29% O; molar mass≈${number(30.026*k)} g/mol`,wanted:'Empirical and molecular formulas',source:'formulas',signal:'formula-method',terms:'Empirical formula: smallest whole-number atom ratio. Molecular formula: actual atom counts in one molecule.',steps:[
      step('Pretend you have 100 g','Percent by mass now becomes grams. This is a convenient basis, not a claim about the actual sample size.','40.00 g C; 6.71 g H; 53.29 g O'),
      step('Change each mass to moles','Atom ratios come from moles, not directly from mass percentages.','C:40.00 g ÷12.01 g/mol ≈3.331 mol\nH:6.71 g ÷1.008 g/mol ≈6.657 mol\nO:53.29 g ÷16.00 g/mol ≈3.331 mol'),
      step('Divide every amount by the smallest','This makes the smallest mole ratio 1. Clear fractional ratios when needed; do not round 1.5 to 2.','C:H:O ≈1:2:1\nEmpirical formula: CH₂O\nA ratio 1:1.5 instead becomes 2:3.'),
      step('Find how many copies of that ratio fit','Divide the molecular molar mass by the empirical-formula molar mass.',`M(CH₂O) = 12.01 + 2(1.008) + 16.00 = 30.026 g/mol\n${number(30.026*k)} g/mol ÷30.026 g/mol ≈${k}`),
      step('Multiply every subscript','The multiplier changes all atom counts. A formula alone need not identify one unique structure.',`(CH₂O) ×${k} → ${formula}\nC:${k}; H:${2*k}; O:${k}`),
    ],quiz:quiz('Empirical formula CH₂O; molecular molar mass≈180.16 g/mol. Molecular formula?',['CH₂O','C₆H₁₂O₆','C₃H₆O₃'],1,'180.16/30.026≈6. Multiply every subscript by 6: C₆H₁₂O₆.')},
    {id:'energy',title:'10. Phases, energy & particle models',given:'A pure substance is boiling at constant pressure',wanted:'Explain what changes and what stays the same',source:'connections',signal:'heating-curves',terms:'Kinetic energy (KE): motion. Potential energy (PE): interactions. Temperature tracks average KE. A phase change does not require changing molecular identity.',steps:[
      step('Notice the flat part of the heating curve','Energy is still added while temperature stays approximately constant during the boiling plateau.','Heating plateau: energy added; T unchanged'),
      step('Explain where the energy goes','Energy changes the particles’ interactions as they separate. It does not raise their average KE during this plateau.','PE increases; average KE stays approximately constant\nThe particles keep moving.'),
      step('Connect pressure and boiling','A liquid boils when its vapor pressure matches the external pressure.','Lower external pressure → lower boiling temperature\nAt liquid–vapor equilibrium, evaporation and condensation still occur at equal rates.'),
      step('Read the interaction model','With PE defined as 0 at infinite separation, a deeper negative well means more energy is needed to separate the pair.','Well minimum−4 → separated reference 0: ΔPE=+4\nAt the minimum, forces balance; particles are not necessarily motionless.'),
    ],quiz:quiz('During that boiling plateau, average KE…',['increases','stays approximately constant','falls to zero'],1,'Temperature is approximately constant, so average KE is too. Added energy changes interactions/PE.')},
  ];
}
