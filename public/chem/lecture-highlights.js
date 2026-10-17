// Only the blockquote text is verbatim. Emphasis/worked-method summaries are paraphrases.
export const lectureHighlights=[
  {id:'show-work',kind:'quote',section:'method',concepts:['units','molar'],lecture:6,lines:[725,726],source:'source-l6',title:'Show how you reached the answer',text:'I also want to see all the stuff you did to get to this answer.'},
  {id:'names-entities',kind:'emphasis',section:'particles',concepts:['entity','subscript'],lecture:6,lines:[212,238],source:'source-l6',title:'Names ↔ formulas; atoms ≠ molecules',text:'Be able to move from names to formulas and back, and distinguish different atom types in particulate models. The lecturer explicitly reminds the class that naming may reappear on Learning Check 2.'},
  {id:'reverse',kind:'quote',section:'conversions',concepts:['mole'],lecture:6,lines:[878,879],source:'source-l6',title:'Run the conversion backward',text:'So this works in both directions.',note:'mass ↔ moles ↔ particle count, using molar mass and Avogadro’s number.'},
  {id:'every-unit',kind:'quote',section:'conversions',concepts:['density','units'],lecture:6,lines:[978,979],source:'source-l6',title:'Show every unit change—even if the number stays the same',text:'Your math still needs to include how you got from one unit to another unit.',note:'the liquid-water density step changes mL into g even with the stated 1 g/mL approximation.'},
  {id:'gas-reasoning',kind:'emphasis',section:'gases',concepts:['gas','motion'],lecture:7,lines:[149,199],source:'source-l7',title:'Explain the gas-law relationships; match the units',text:'Explain why PV = nRT represents the relationships among the variables, rather than just substituting numbers. Convert Celsius to Kelvin to match the gas constant’s units.',note:'For any proportional comparison, state which other variables are held fixed.'},
  {id:'weighted-average',kind:'worked',section:'isotopes',concepts:['atomic','isotope'],lecture:7,lines:[703,725],source:'source-l7',title:'Weight isotope masses by their abundances',text:'Convert percent abundance to a decimal, multiply each isotope mass by its fraction, then add the contributions. The periodic-table average is not the mass of one specific atom.'},
  {id:'fragments',kind:'emphasis',section:'mass-spec',concepts:['fragment','magnet'],lecture:7,lines:[790,829],source:'source-l7',title:'Five chlorine peaks do not mean five isotopes',text:'Distinguish atomic fragments from intact Cl₂ ions. Two chlorine isotopes produce atomic peaks near 35/37 and molecular combinations near 70/72/74. The lecturer calls attention to fragmentation when molecules enter the instrument.'},
  {id:'spectrum-cues',kind:'quote',section:'spectrum',concepts:['charge','pairing'],lecture:7,lines:[1017,1018],source:'source-l7',title:'The instructor described cues for reading spectra',text:'I will point to the peaks that are important when we get to learning checks',note:'This describes the lecturer’s stated plan for cues. It does not make the tallest peak the molecular ion or remove the need to distinguish fragments and isotope effects.'},
  {id:'formula-method',kind:'worked',section:'formulas',concepts:['empirical','molecular'],lecture:7,lines:[1180,1217],source:'source-l7',title:'Mass percentages → moles → simplest whole-number ratio',text:'Convert each element’s mass to moles, divide by the smallest mole value, and interpret the resulting atom ratio. The lecture reaches CH, then compares its mass with 78.1 g/mol to show that CH is not the final molecular formula.',note:'The lecturer defers the completed molecular-formula step to the next class; this guide’s completed method is supported by M4 notes.'},
  {id:'heating-curves',kind:'emphasis',section:'connections',concepts:['energy','phase'],lecture:2,lines:[646,666],source:'source-m2',title:'Interpret the graph—and reconstruct the other representation',text:'Move between time–temperature heating curves and temperature–energy representations. Be able to sketch and interpret them, including where energy is added while temperature stays constant.'},
];
const labels={quote:'DIRECT QUOTE',emphasis:'LECTURER EMPHASIS',worked:'LECTURE WORKED METHOD'};
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const highlightsForSection=section=>lectureHighlights.filter(item=>item.section===section);
export const highlightsForConcept=id=>lectureHighlights.filter(item=>item.concepts.includes(id));
export function highlightHTML(items,{anchors=false,compact=false}={}){
  return items.map(item=>`<div role="note" ${anchors?`id="lecture-${escape(item.id)}" `:''}class="lecture-highlight lecture-${item.kind}${compact?' lecture-compact':''}" aria-label="${labels[item.kind]}: ${escape(item.title)}"><p class="lecture-signal">${item.kind==='quote'?'“':'★'} ${labels[item.kind]}${item.kind!=='quote'?' · PARAPHRASED':''}</p><h3 class="lecture-title">${escape(item.title)}</h3>${item.kind==='quote'?`<blockquote><p>“${escape(item.text)}”</p></blockquote>`:`<p class="lecture-statement">${escape(item.text)}</p>`}${item.note?`<p class="lecture-context"><strong>Study context:</strong> ${escape(item.note)}</p>`:''}<p class="lecture-evidence"><a href="#${escape(item.source)}">Lecture ${item.lecture} · transcript lines ${item.lines[0]}–${item.lines[1]}</a>${item.kind==='quote'?' · Exact supplied transcript wording':' · Source-based summary, not a quotation'}</p></div>`).join('');
}
export function annotateGuide(html){
  return html.replace(/(<section id="([^"]+)"[^>]*><div class="section-head">[\s\S]*?<\/div>)/g,(opening,id,section)=>opening+highlightHTML(highlightsForSection(section),{anchors:true}));
}
export function insertHighlights(container,items,options){
  const template=document.createElement('template');template.innerHTML=highlightHTML(items,options);
  container.append(template.content.cloneNode(true));
}
export function practiceBadge(section){
  const items=highlightsForSection(section);
  if(!items.length)return null;
  const link=document.createElement('a');link.className='lecture-practice-badge';link.href=`#lecture-${items[0].id}`;
  link.textContent='★ Practices a lecture-highlighted topic · see the source';
  return link;
}
