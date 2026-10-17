// Explicit conversion factors: each denominator cancels the preceding unit.
export const NA = 6.022e23;
export const routes = {
  'ethanol-forward': {start:11.5,unit:'g C₂H₆O',title:'Ethanol mass → molecules → hydrogen atoms',note:'M(C₂H₆O) = 2(12.01) + 6(1.008) + 16.00 ≈ 46.07 g/mol. Six H atoms occur in each molecule.',steps:[
    [1,46.07,'mol C₂H₆O','g C₂H₆O','Molar mass bridges grams and moles. Grams must cancel, so g goes below.'],
    [NA,1,'molecules C₂H₆O','mol C₂H₆O','Avogadro’s number bridges moles and molecules. Moles must cancel below.'],
    [6,1,'H atoms','molecules C₂H₆O','The molecular formula supplies six H atoms per ethanol molecule. Cancel molecules.']
  ]},
  'ethanol-reverse':{start:1.503e23,unit:'molecules C₂H₆O',title:'Ethanol molecules → mass',note:'Same equalities as the forward route, inverted to cancel a different starting unit.',steps:[
    [1,NA,'mol C₂H₆O','molecules C₂H₆O','Divide by entities per mole; molecules cancel.'],
    [46.07,1,'g C₂H₆O','mol C₂H₆O','Multiply by molar mass; moles cancel and grams remain.']
  ]},
  'water-forward':{start:2,unit:'L liquid H₂O',title:'Liquid water liters → mass → moles → molecules',note:'Use the stated lecture approximation ρ = 1.00 g/mL and M(H₂O) = 18.02 g/mol. This route is for liquid water, not water vapor.',steps:[
    [1000,1,'mL liquid H₂O','L liquid H₂O','There are 1000 mL in 1 L; place L below to cancel.'],
    [1,1,'g H₂O','mL liquid H₂O','Density connects volume to mass. Even when the number stays the same, show the unit change.'],
    [1,18.02,'mol H₂O','g H₂O','Use the substance’s molar mass, inverted to cancel grams.'],
    [NA,1,'molecules H₂O','mol H₂O','Multiply by molecules per mole.']
  ]},
  'water-reverse':{start:6.6836847946725866e25,unit:'molecules H₂O',title:'Water molecules → liquid liters',note:'Use ρ = 1.00 g/mL and M(H₂O) = 18.02 g/mol. Density must be inverted when converting grams to mL.',steps:[
    [1,NA,'mol H₂O','molecules H₂O','Count to moles: molecules below, moles above.'],
    [18.02,1,'g H₂O','mol H₂O','Molar mass converts moles to grams.'],
    [1,1,'mL liquid H₂O','g H₂O','Invert density: mL per g, not g per mL.'],
    [1,1000,'L liquid H₂O','mL liquid H₂O','Invert the metric equality to cancel mL.']
  ]},
  'oxygen-reverse':{start:5e21,unit:'molecules O₂',title:'Oxygen molecules → grams',note:'Elemental oxygen here is O₂, so use 32.00 g/mol O₂, not 16.00 g/mol O atoms.',steps:[
    [1,NA,'mol O₂','molecules O₂','A molecule count divided by Avogadro’s number gives moles of molecules.'],
    [32,1,'g O₂','mol O₂','Multiply by the molar mass of O₂.']
  ]},
  'oxygen-atoms':{start:5e21,unit:'O atoms',title:'O atoms contained in O₂ → grams of O₂',note:'The given counts atoms, while molar mass refers to O₂ molecules. Insert an atom-to-molecule factor first.',steps:[
    [1,2,'molecules O₂','O atoms','Two O atoms belong to each O₂ molecule; divide the atom count by two.'],
    [1,NA,'mol O₂','molecules O₂','Convert the molecule count to moles of O₂.'],
    [32,1,'g O₂','mol O₂','Use 32.00 g per mole of O₂ molecules.']
  ]},
  'gas-forward':{start:11.2,unit:'L O₂ gas',title:'Gas volume at course STP → O₂ mass',note:'Only at 273.15 K and 1.00 atm, assuming ideal behavior, use the rounded 22.4 L/mol. It does not apply to liquid oxygen.',steps:[
    [1,22.4,'mol O₂','L O₂ gas','Molar volume at the stated conditions connects gas liters to moles.'],
    [32,1,'g O₂','mol O₂','Molar mass converts moles of O₂ to grams.']
  ]},
  'gas-reverse':{start:16,unit:'g O₂',title:'O₂ mass → gas volume at course STP',note:'Same 273.15 K and 1.00 atm assumptions. At different P or T, use PV = nRT instead of this shortcut.',steps:[
    [1,32,'mol O₂','g O₂','Invert molar mass to cancel grams.'],
    [22.4,1,'L O₂ gas','mol O₂','Multiply by the stated molar volume.']
  ]}
};

export function convert(id, input) {
  const route = routes[id];
  if (!route || !Number.isFinite(input) || input < 0) throw new Error('Enter a finite, nonnegative starting quantity.');
  let current = input;
  const steps = route.steps.map(([num,den,to,from,reason]) => {
    const before = current;
    current = current * (num / den);
    if (!Number.isFinite(current)) throw new Error('That quantity is too large to display. Use a smaller starting amount.');
    return {num,den,to,from,reason,before,value:current};
  });
  return {route,steps,value:current,unit:steps.at(-1).to};
}

export const spectra = {
  methanol:{title:'Methanol · illustrative relative intensities',max:36,y:'Relative intensity (base peak = 100)',note:'Illustrative rounded heights for CH₃OH: the fragment at 31 is taller than the intact ion at 32. The graph is a teaching reconstruction, not measured source data.',peaks:[
    [15,25,'CH₃⁺ fragment: carbon plus three hydrogens. A possible fragment assignment, not the full molecule.'],
    [29,15,'A smaller fragment peak. Its lower m/z means a lower mass-to-charge ratio, not a lower concentration of whole methanol.'],
    [31,100,'Base peak: a fragment consistent with CH₃O⁺. Tallest does not mean molecular ion.'],
    [32,55,'Molecular ion CH₃OH⁺: the intact molecule, approximate nominal mass 12 + 4 + 16 = 32.']
  ]},
  magnesium:{title:'Magnesium · rounded activity intensities',min:22,max:28,y:'Relative intensity (base peak = 100)',note:'Activity 6 uses rounded relative heights 100, 13, 14. Divide by their sum 127 for percentages. The exact 79%/10%/11% panel differs slightly because of rounding.',peaks:[
    [24,100,'²⁴Mg⁺: 100/127 = 78.74% of these relative count units, not 100% of the population.'],
    [25,13,'²⁵Mg⁺: 13/127 = 10.24%. This peak is 13% as tall as the base peak.'],
    [26,14,'²⁶Mg⁺: 14/127 = 11.02%. Normalize the same relevant isotope family.']
  ]},
  chlorine:{title:'Cl₂ · molecular isotope family only',min:68,max:76,y:'Relative intensity (70 peak = 100)',note:'Calculated from random pairing of 76% ³⁵Cl and 24% ³⁷Cl, assuming equal response within this molecular family. Atomic fragment peaks at 35 and 37 are omitted from this view.',peaks:[
    [70,100,'³⁵Cl–³⁵Cl⁺. Pair probability 0.76² = 57.76%; this family’s reference height is 100.'],
    [72,63.1578947368,'Mixed ³⁵Cl–³⁷Cl⁺. Two pairings give 2(0.76)(0.24) = 36.48%, or relative height 63.16.'],
    [74,9.97229916898,'³⁷Cl–³⁷Cl⁺. Pair probability 0.24² = 5.76%, or relative height 9.97.']
  ]}
};
