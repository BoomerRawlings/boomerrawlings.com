// Original instructional content; numerical solutions are reused from the current problem.
const base='https://boomerrawlings.com/chem/';
const concept=(id,title,description,code,source,related=[])=>({id,title,description,
  checkpoint:'Explain the rule, identify its conditions, and reconstruct the example before proceeding.',
  artifact:{title:`Foundation: ${title}`,language:'chemistry',code},related,
  resources:[{label:'Source-backed explanation on this page',url:`${base}#${source}`}]});

export const fundamentals=[
  concept('entity','Name the particle and substance','Start by distinguishing the sample, its chemical formula, and what the question counts. An elemental substance can consist of molecules.',
    'O₂ = one molecule with two O atoms; one element, not a compound.\nCO₂ = one molecule with one C atom and two O atoms; a compound.\nA mixture contains multiple substances. One substance can occupy multiple phases.\nBinary covalent names use prefixes: CO = carbon monoxide; CO₂ = carbon dioxide.','particles'),
  concept('units','Build a route by canceling units','Read given → wanted. Choose equalities that connect them. A factor changes the unit only when the current unit appears on its opposite side.',
    'Given 2.00 L liquid water; want molecules.\nL → mL → g → mol → molecules.\n2.00 L × (1000 mL / 1 L) = 2000 mL.\nReverse: invert each factor and apply factors in reverse order.','method',['entity']),
  concept('density','Bridge liquid volume and mass','Density is mass divided by volume at stated conditions. It is a phase-specific property, not a particle count.',
    'ρ = m/V; m = ρV; V = m/ρ.\n0.500 mL liquid × (0.789 g / 1 mL) = 0.3945 g.\nReverse: 0.3945 g × (1 mL / 0.789 g) = 0.500 mL.\nDo not carry liquid density into the gas phase.','conversions',['units']),
  concept('molar','Derive molar mass from the formula','Add each element’s molar mass multiplied by its subscript. Specify whether the moles refer to atoms, molecules, or formula units.',
    'M(O atoms) = 16.00 g/mol; M(O₂) = 2(16.00) = 32.00 g/mol.\nM(C₂H₆O) = 2(12.01)+6(1.008)+16.00 ≈ 46.07 g/mol.\n32.00 g O₂ × (1 mol O₂ / 32.00 g O₂) = 1 mol O₂.','conversions',['entity','units']),
  concept('mole','Bridge moles and entity counts','A mole specifies a number of the named entity. Avogadro’s number does not change the chemical formula or convert molecules into atoms by itself.',
    'N = nNₐ; n = N/Nₐ; Nₐ ≈ 6.022 × 10²³ entities/mol.\n0.250 mol CO₂ × (6.022 × 10²³ molecules / 1 mol)\n= 1.5055 × 10²³ CO₂ molecules.','particles',['entity','units']),
  concept('subscript','Bridge molecule counts and atom counts','Formula subscripts count atoms within each molecule. H₂, N₂, O₂, F₂, Cl₂, Br₂, and I₂ have two atoms per molecule in these common elemental forms.',
    '1 mol O₂ contains 1 mol molecules and 2 mol O atoms.\nN(O atoms) = 2 × N(O₂ molecules).\nN(O₂ molecules) = N(O atoms)/2.\nEthanol: 6 H atoms per C₂H₆O molecule; never substitute 6 for its molar mass.','particles',['entity','mole']),
  concept('gas','Connect macroscopic gas variables to moles','Use the ideal gas model only with stated conditions. Fix the amount before applying the combined law. Kelvin temperature and consistent pressure/volume units are required.',
    'PV = nRT; n = PV/(RT); T(K) = T(°C)+273.15.\nR ≈ 0.0821 L·atm/(mol·K).\nFixed n: V₂/V₁ = (T₂/T₁)(P₁/P₂).\n22.4 L/mol is the course-rounded value at 273.15 K and 1 atm only.\nGas moles → molecules → atoms uses the same count factors as a solid or liquid.','gases',['units','mole']),
  concept('motion','Explain gas behavior with particles','Pressure results from wall collisions. Equal temperature means equal mean translational kinetic energy, not equal speeds for different particle masses.',
    'KE = ½mv²; characteristic speed ∝ √(T/M).\nAt equal n,T,V: same ideal-gas pressure, even for different gases.\nAt fixed n,V: higher T → higher P. At fixed n,T: smaller V → higher P.\nA heavier gas has lower characteristic speeds at equal T.','gases',['entity','gas']),
  concept('atomic','Separate atomic number, isotope, and ion','Elemental identity depends on protons. Isotopes change neutrons. Ionization changes electrons, not the nucleus.',
    'Z = protons; A = protons+neutrons; neutrons = A−Z.\nFor a positive ion with charge +z: electrons = Z−z.\n³⁵Cl⁺: 17 protons, 18 neutrons, 16 electrons.','isotopes',['entity']),
  concept('isotope','Normalize peak heights before averaging','Read the y-axis. Percent abundance partitions a relevant population; relative intensity references the base peak. An average is not a new isotope.',
    'Heights25 and100 → fractions25/125=0.20 and100/125=0.80.\nFor isotope masses10 and11 u: mean=0.20(10)+0.80(11)=10.80 u.\nReverse: 10x+11(1−x)=10.80 → x=0.20.\nUse only the relevant isotope family, with comparable response.','isotopes',['atomic','units']),
  concept('charge','Read m/z before assigning ion mass','The horizontal axis is mass-to-charge ratio. The charge assumption matters when translating peak position into a nominal mass.',
    'Nominal mass40 u, z=1 → m/z40.\nNominal mass40 u, z=2 → m/z20.\nBase peak = tallest peak; molecular ion = intact molecule after electron removal.\nNeither label guarantees the other.','spectrum',['atomic']),
  concept('magnet','Locate ion formation, bending, and detection','The classroom magnetic-sector sequence separates sample preparation, charge formation, acceleration, magnetic analysis, and signal detection.',
    'Vaporize → ionize → accelerate → magnetically deflect → detect.\nEqual charge + same accelerating voltage → equal KE, not equal speed.\nr = √(2mKE)/(qB): larger m at equal q,KE,B → larger radius → less bending.\nVacuum reduces unwanted collisions.','mass-spec',['charge','motion']),
  concept('fragment','Balance a possible fragmentation without overclaiming','Electron impact can leave an unstable ion whose bonds break. Fragmentation is different from vaporization, ionization itself, and magnetic bending. Some fragmentation can occur after the source.',
    'CH₃OH⁺• → CH₃O⁺ + H• is one possible pathway.\nNominal masses:32 = 31+1; charge:+1 = +1+0.\nOnly the charged product gives its own directly detected positive-ion peak.\nA mass difference can suggest a neutral loss; it does not prove a unique structure or mechanism.','mass-spec',['entity','charge']),
  concept('pairing','Combine isotope probabilities for diatomic ions','Two positions give two ways to form a mixed-isotope molecule. Atomic fragments and intact molecular ions belong to different peak families.',
    'For light-isotope fraction p and heavy fraction q=1−p:\nCl₂⁺ near70: p²; near72: 2pq; near74: q².\np=.76,q=.24 → .5776, .3648, .0576. Sum=1.\nCl⁺ fragments near35 and37. Their absolute heights relative to Cl₂⁺ require fragmentation/response information.','spectrum',['isotope','fragment','subscript']),
  concept('empirical','Convert composition by mass into an atom ratio','Percent by mass is not an atom-count ratio. Choose a100g basis, convert each element’s grams to moles, then normalize and clear fractional ratios.',
    '50.0% S/50.0% O → 50.0g S/(32.06g/mol) ≈ 1.56mol S;\n50.0g O/(16.00g/mol) = 3.125mol O.\nDivide both by1.56 → S:O ≈ 1:2 → empirical formula SO₂.\nA ratio1:1.5 must be doubled to2:3; do not round1.5 to2.','formulas',['molar','units']),
  concept('molecular','Scale the empirical formula to the molecular formula','The simplest ratio and actual molecule size are separate information. Use an independently justified molecular molar mass, rather than assuming the tallest spectral peak is the parent.',
    'Empirical CH₂O: empirical molar mass≈30.026g/mol.\nMeasured molecular molar mass≈180.16g/mol.\nMultiplier≈180.16/30.026≈6 → C₆H₁₂O₆.\nMultiply every subscript. Composition plus mass does not necessarily distinguish structural isomers.','formulas',['empirical','charge']),
  concept('energy','Connect particle interactions, phases, and energy','Particle drawings are models: they omit motion and distort scale. Potential energy reflects interactions; temperature tracks mean kinetic energy. State the system and constraints.',
    'PE reference at infinite separation:0. A well minimum−4 requires ΔPE=+4 to reach0.\nIn an isolated system: ΔKE=−ΔPE. At a PE minimum, net force is0, not necessarily speed.\nPure-substance constant-pressure melting/boiling plateau: T and mean KE approximately constant; PE increases as energy is added.\nCondensation reverses the PE change; particles continue moving.','connections',['motion']),
  concept('phase','Use characteristic properties and phase equilibrium','Mass and volume depend on sample amount; density and phase-change temperatures can help distinguish substances under specified conditions. Compare multiple properties.',
    'Boiling: vapor pressure equals external pressure.\nLower external pressure → lower boiling temperature.\nAt liquid–vapor equilibrium, evaporation and condensation continue at equal rates.\nLower normal boiling point generally indicates greater volatility; distillation exploits volatility differences.','connections',['entity','energy']),
];

export const topicConcepts={
  'Classification & naming':['entity'],
  'Conversion chains':['entity','units','density','molar','mole','subscript'],
  'Diatomic molecules':['entity','molar','mole','subscript'],
  'Gas laws':['units','gas','motion'],
  'Ideal gas → particles':['entity','gas','mole','subscript'],
  'Isotopes & graph heights':['atomic','isotope','charge'],
  'Diatomic isotope spectrum':['atomic','isotope','charge','fragment','pairing'],
  'Fragmentation & reading spectra':['entity','charge','fragment'],
  'Instrument sequence & deflection':['atomic','charge','motion','magnet'],
  'Composition → formulas':['units','molar','empirical','molecular'],
  'Matter & identifying properties':['entity','units','density','phase'],
  'Phases, energy & separation':['motion','energy','phase'],
  'Particle models & potential energy':['motion','energy'],
};
const topicDecisions={
  'Classification & naming':['Read element identities and formula subscripts','Separate the elemental molecule from the compound'],
  'Conversion chains':['Choose the correct conditions and equality','Orient the next factor to cancel the current unit','Apply the next bridge and keep the entity label','Continue until only the wanted unit remains','Reverse the same equalities to test the result'],
  'Diatomic molecules':['Identify whether the given counts atoms or molecules','Use the formula to check the factor of two','Finish the requested atom count'],
  'Gas laws':['Solve the combined gas law with fixed amount','Explain temperature and pressure changes separately'],
  'Ideal gas → particles':['Solve PV=nRT with consistent units','Convert moles to molecules, then atoms'],
  'Isotopes & graph heights':['Normalize the relevant isotope family','Weight each isotope mass by its number fraction','Count protons, neutrons and electrons separately'],
  'Diatomic isotope spectrum':['Enumerate both mixed-isotope arrangements','Separate atomic fragments from molecular ions'],
  'Fragmentation & reading spectra':['Assign the parent and base peak, then balance a possible loss','Locate fragmentation and account for undetected neutrals'],
  'Instrument sequence & deflection':['Use charge to interpret the x-axis; order the instrument stages','Hold charge and KE fixed before comparing curvature'],
  'Composition → formulas':['Use a100g basis and convert every mass to moles','Normalize mole ratios to get the empirical formula','Use molar mass to scale all subscripts'],
  'Matter & identifying properties':['Use density to compare the two sample volumes','Distinguish identifying properties from amount and chemical identity'],
  'Phases, energy & separation':['Compare boiling points and volatility','Explain energy input during a phase plateau','Apply the pressure condition for boiling'],
  'Particle models & potential energy':['Compare the PE minimum with the stated reference','Conserve total energy and recognize model limits'],
};

function prerequisites(ids){
  const needed=new Set(ids);
  function include(id){const entry=fundamentals.find(f=>f.id===id);if(!entry)throw new Error(`Unknown foundation ${id}`);for(const other of entry.related){if(!needed.has(other)){needed.add(other);include(other);}}}
  ids.forEach(include);
  return fundamentals.filter(f=>needed.has(f.id)).map(f=>({...f,related:f.related.filter(id=>needed.has(id))}));
}
export const foundationPlan={id:'foundations',title:'Fundamentals → connected chemistry problems',summary:'Start with particle identity and units. Trace the branches into conversions, gases, spectra, formulas, and phase behavior. These are preparation targets supported by the supplied material, not a prediction of the exam.',steps:[...fundamentals,
  concept('integration','Combine measurements into a defensible answer','The same inferred formula and amount connect a liquid measurement, a gas measurement, an atom count, and a mass spectrum. Keep phase changes separate from molecular fragmentation.',
    'Example: liquid C₂H₆O, ρ=.789g/mL, M=46.07g/mol.\n.500mL × (.789g/mL) × (1mol/46.07g) × (6.022×10²³ molecules/mol)\n≈5.16×10²¹ molecules; ×6 H atoms/molecule ≈3.09×10²² H atoms.\nThe same .008563mol, fully vaporized into .500L at300K:\nP=nRT/V≈.422atm using R=.0821 L·atm/(mol·K).\nAn intact +1 ion near46, fragment31, and isotope partner47 are different kinds of evidence. Tallest peak need not be the parent.\nComposition plus justified molecular mass gives a formula; a formula alone need not identify an isomer.','q6',['density','molar','mole','subscript','gas','fragment','molecular','phase'])]};

export function problemPlan({id,title,prompt,answers,concepts,decisions,source,dependencies}){
  const steps=prerequisites(concepts);
  const foundationIds=steps.map(s=>s.id);
  steps.push({id:'read-problem',title:'Read the given and wanted quantities',description:'Before calculating, identify each entity and condition. State what must be found; do not replace the question with a familiar example.',artifact:{title:'This exact problem',language:'question',code:prompt},related:concepts.filter(id=>foundationIds.includes(id)),checkpoint:'You can name each given, its unit/entity, the target, and the assumptions.'});
  answers.forEach((answer,index)=>{
    steps.push({id:`solve-${index+1}`,title:decisions[index]??`Apply the next justified step (${index+1})`,description:decisions[index]??'Use the preceding output as the next input. Keep the named entities and units, and defend the inference with the linked fundamentals.',
      artifact:{title:`Worked component ${index+1}`,language:'worked chemistry',code:answer,note:'Display rounding may differ slightly; carry unrounded intermediate values.'},
      related:dependencies?.[index]??['read-problem',...concepts],
      checkpoint:'Recreate this component without looking; explain why each factor or inference is valid.',
      resources:[{label:'Review this topic on the CHEM page',url:`${base}#${source}`}]});
  });
  steps.push({id:'connect-check',title:'Check the result and connect the concepts',description:'A high-level answer combines these fundamentals rather than applying an isolated definition. Use the dependency buttons to return to any missing prerequisite.',
    artifact:{title:'Reconstruction checklist',language:'checklist',code:`[ ] Answer every requested part, with units and entity labels.\n[ ] Keep conditions and charge assumptions explicit.\n[ ] Defend the result in words, not just arithmetic.\n[ ] Catch the likely wrong turn using these foundations:\n${concepts.map(id=>'• '+fundamentals.find(f=>f.id===id).title).join('\n')}\n[ ] If this is a conversion, reverse it; if an inference, state what the evidence cannot establish.`},related:[`solve-${answers.length}`,...concepts],checkpoint:'You can solve a changed numerical example and explain which rules stay the same.'});
  return {id,title,summary:prompt,steps};
}

export function randomPlans(rows){
  return rows.map((row,i)=>{
    const concepts=topicConcepts[row.topic];
    const dependencies=row.steps.map((_,j)=>{
      const usesPrevious=j>0&&(
        row.topic==='Conversion chains'&&j>1||
        row.topic==='Diatomic molecules'&&row.steps.length===3||
        row.topic==='Ideal gas → particles'||row.topic==='Composition → formulas'||
        row.topic==='Isotopes & graph heights'&&j===1);
      return [usesPrevious?`solve-${j}`:'read-problem',...concepts];
    });
    return problemPlan({id:`random-${i+1}`,title:`${i+1}. ${row.topic}`,prompt:row.prompt,answers:row.steps,concepts,dependencies,decisions:row.topic==='Conversion chains'?row.steps.map((_,j)=>j===0?'Check the substance, phase and stated conditions':j===row.steps.length-1?'Reverse the route as a consistency check':`Apply conversion factor ${j}: cancel the current unit`):topicDecisions[row.topic],source:row.source});
  });
}

export function quizPlans(questions){
  const conceptsForSource={conversions:['units','molar','mole','subscript'],particles:['entity','mole','subscript'],gases:['gas','motion'],isotopes:['atomic','isotope'], 'mass-spec':['charge','magnet','fragment'],spectrum:['charge','isotope','fragment','pairing'],formulas:['empirical','molecular'],connections:['energy','phase'],method:['entity','units']};
  return questions.map((q,i)=>problemPlan({id:`quiz-${q.id}`,title:`Q${i+1}. ${q.prompt}`,prompt:q.prompt,answers:[q.options[q.correct],q.explanation],concepts:conceptsForSource[q.source]??['entity'],decisions:['Choose the statement supported by the conditions','Explain why the answer follows from the model'],source:q.source}));
}

export const practiceConcepts=[
  ['entity','mole','molar','subscript','gas','motion'],
  ['units','gas','mole','molar','motion'],
  ['atomic','isotope','charge','mole','molar','magnet'],
  ['atomic','charge','fragment','isotope','pairing'],
  ['units','empirical','molecular','mole','subscript'],
  ['units','density','molar','mole','subscript','gas','charge','fragment','magnet','empirical','molecular'],
];
export const practiceDependencies=[
  [['mole'],['molar'],['solve-1','subscript'],['gas'],['motion','molar'],['entity','subscript']],
  [['units','gas','mole'],['solve-1','molar'],['gas'],['motion']],
  [['isotope'],['solve-1','isotope'],['atomic','charge'],['magnet'],['solve-2','molar','mole'],['isotope']],
  [['charge','atomic','fragment','pairing'],['isotope','pairing'],['isotope'],['fragment'],['fragment','pairing']],
  [['empirical'],['solve-1','molecular'],['solve-2','mole','subscript'],['empirical']],
  [['empirical','molecular','charge'],['solve-1','density','molar','mole','subscript'],['solve-2','density','units'],['solve-2','gas'],['fragment','charge'],['magnet','fragment']],
];
