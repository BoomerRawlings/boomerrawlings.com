import { convert, routes, spectra } from './model.js';

const $ = (id) => document.getElementById(id);
const format = (n) => n === 0 ? '0' : Math.abs(n) >= 1e6 || Math.abs(n) < .001
  ? n.toExponential(4).replace('e+', ' × 10^').replace('e-', ' × 10^-')
  : Number(n.toPrecision(5)).toLocaleString('en-US', {maximumSignificantDigits:5});
const fraction = (num,den,to,from,cancelTop=false) => `<span class="fraction"><span>${format(num)} ${cancelTop ? `<s>${to}</s>` : to}</span><span>${format(den)} <s>${from}</s></span></span>`;
const routeSelect = $('route');
const quantity = $('quantity');
function renderConversion() {
  const id = routeSelect.value;
  const route = routes[id];
  $('route-description').textContent = route.note;
  quantity.setAttribute('aria-label', `Starting quantity in ${route.unit}`);
  try {
    if (quantity.value.trim() === '') throw new Error('Enter a starting quantity to see the conversion chain.');
    const result = convert(id,Number(quantity.value));
    $('conversion-output').innerHTML = `<h3>${route.title}</h3>` + result.steps.map((s,i) => `<div class="conversion-step"><h4>Step ${i+1} · ${s.from} → ${s.to}</h4><p>${s.reason}</p><div class="chain">${format(s.before)} <s>${s.from}</s> × ${fraction(s.num,s.den,s.to,s.from)} = <strong>${format(s.value)} ${s.to}</strong></div></div>`).join('') +
      `<h4>One connected chain</h4><div class="chain">${format(Number(quantity.value))} <s>${route.unit}</s> × ${result.steps.map((s,i) => fraction(s.num,s.den,s.to,s.from,i < result.steps.length-1)).join(' × ')} = <strong>${format(result.value)} ${result.unit}</strong></div><p class="small">Struck units cancel with the matching unit in the adjacent factor. Density and formula subscripts are distinct conversion factors. Display rounded to five significant digits; carry unrounded values internally.</p>`;
  } catch (err) {
    $('conversion-output').textContent = err.message;
  }
}
routeSelect.addEventListener('change', () => {quantity.value = String(routes[routeSelect.value].start);renderConversion();});
quantity.addEventListener('input',renderConversion);
$('reset-conversion').addEventListener('click', () => {quantity.value = String(routes[routeSelect.value].start);renderConversion();});
renderConversion();

const stageNotes = [
  'Vaporization supplies gas-phase particles that can travel independently through the instrument. It changes phase; it does not itself require breaking molecules into atoms.',
  'Ionization occurs in the source. Energetic electron impact can remove an electron, producing a positive molecular ion. Excess internal energy may also break bonds into fragments here—before the analyzer.',
  'Acceleration uses electric fields and charged plates. Under the activity’s equal-charge conditions, the ions reach equal kinetic energy but different speeds: heavier ions are slower.',
  'Deflection occurs inside the analyzing magnetic field after acceleration. Moving charged ions follow curved paths. At equal charge and KE, smaller masses bend more tightly. Deflection is not fragmentation.',
  'The detector registers arriving ions as electrical signals. Scanning the field brings different m/z ions to the detector. Signal heights generate the spectrum; a tall peak is not automatically an intact molecule.'
];
document.querySelectorAll('[data-stage]').forEach(button => button.addEventListener('click', () => {
  const n = Number(button.dataset.stage);
  document.querySelectorAll('[data-stage]').forEach(b => b.setAttribute('aria-pressed',String(b===button)));
  document.querySelectorAll('[data-zone]').forEach(g => g.classList.toggle('active',Number(g.dataset.zone)===n));
  $('stage-note').textContent = stageNotes[n];
  const container = document.querySelector('.instrument');
  const zone = document.querySelector(`[data-zone="${n}"]`).getBoundingClientRect();
  if (container.scrollWidth > container.clientWidth) container.scrollLeft += zone.left - container.getBoundingClientRect().left + (zone.width-container.clientWidth)/2;
}));
document.querySelector('[data-zone="0"]').classList.add('active');

function renderSpectrum(selected=0) {
  const data = spectra[$('spectrum-choice').value];
  const min = data.min ?? 0;
  const x = (v) => 76+(v-min)/(data.max-min)*635;
  const svg = $('spectrum-svg');
  svg.innerHTML = `<title id="spectrum-title">${data.title}</title><desc id="spectrum-desc">${data.note} Equivalent peak positions and heights follow in the table.</desc><rect x="0" y="0" width="760" height="330" rx="6" fill="white"/><g font-family="system-ui" font-size="12" fill="#526574">` +
    [0,25,50,75,100].map(v => `<line x1="76" x2="710" y1="${270-v*2}" y2="${270-v*2}" stroke="#e3e8e9"/><text x="64" y="${274-v*2}" text-anchor="end">${v}</text>`).join('') +
    `<path d="M76 48V270H715" fill="none" stroke="#526574" stroke-width="1.5"/><text x="396" y="318" text-anchor="middle">Mass-to-charge ratio, m/z</text><text x="18" y="160" text-anchor="middle" transform="rotate(-90 18 160)">${data.y}</text>` +
    data.peaks.map(([m,height],i)=>`<line x1="${x(m)}" x2="${x(m)}" y1="270" y2="${270-height*2}" stroke="${i===selected?'#b77719':'#12646f'}" stroke-width="${i===selected?7:4}"/><text x="${x(m)}" y="289" text-anchor="middle">${m}</text><text x="${x(m)}" y="${258-height*2}" text-anchor="middle" fill="#182b49">${format(height)}</text>`).join('') + '</g>';
  $('peak-buttons').innerHTML = data.peaks.map(([m],i)=>`<button type="button" data-peak="${i}" aria-pressed="${i===selected}">m/z ${m}</button>`).join('');
  $('peak-note').textContent = data.peaks[selected][2];
  $('spectrum-table').innerHTML = `<p class="small">${data.note}</p><table><caption>${data.title}</caption><thead><tr><th>m/z</th><th>Relative intensity</th><th>Interpretation</th></tr></thead><tbody>`+data.peaks.map(([m,h,n])=>`<tr><td>${m}</td><td>${format(h)}</td><td>${n}</td></tr>`).join('')+'</tbody></table>';
  $('peak-buttons').querySelectorAll('[data-peak]').forEach(b=>b.addEventListener('click',()=>{
    const i=Number(b.dataset.peak);
    renderSpectrum(i);
    $('peak-buttons').querySelector(`[data-peak="${i}"]`).focus({preventScroll:true});
  }));
  const chart = svg.parentElement;
  if (chart.scrollWidth > chart.clientWidth) chart.scrollLeft = x(data.peaks[selected][0]) * svg.clientWidth / 760 - chart.clientWidth / 2;
}
$('spectrum-choice').addEventListener('change',()=>renderSpectrum());
renderSpectrum();

const answerDetails = [...document.querySelectorAll('details.answer')];
$('open-answers').addEventListener('click',()=>answerDetails.forEach(d=>d.open=true));
$('close-answers').addEventListener('click',()=>answerDetails.forEach(d=>d.open=false));
function revealHash(){
  const id=decodeURIComponent(location.hash.slice(1));
  const target=$(id);
  if(target?.matches('details')) target.open=true;
}
window.addEventListener('hashchange',revealHash);
document.querySelectorAll('.answer-jump').forEach(a=>a.addEventListener('click',()=>{
  const d=$(a.hash.slice(1)); if(d)d.open=true;
}));
revealHash();
let printState;
window.addEventListener('beforeprint',()=>{
  printState=[...document.querySelectorAll('details')].map(d=>[d,d.open]);
  printState.forEach(([d])=>d.open=true);
});
window.addEventListener('afterprint',()=>printState?.forEach(([d,open])=>d.open=open));
$('print-guide').addEventListener('click',()=>window.print());

if ('IntersectionObserver' in window) {
  const navLinks=[...document.querySelectorAll('aside nav a')];
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        navLinks.forEach(a=>{ if(a.hash===`#${entry.target.id}`)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current'); });
      }
    });
  },{rootMargin:'-10% 0px -65% 0px'});
  document.querySelectorAll('main>section').forEach(s=>observer.observe(s));
}
