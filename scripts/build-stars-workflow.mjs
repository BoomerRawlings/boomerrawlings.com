import {readFileSync,writeFileSync} from 'node:fs';
import {renderWorkflow} from './vendor/workflow-display/scripts/build.mjs';
const dir='public/stars-assets/',read=name=>readFileSync(dir+name,'utf8');
const excerpt=(file,from,to)=>{const s=read(file),a=s.indexOf(from),b=s.indexOf(to,a+from.length);if(a<0||b<0)throw Error('Missing excerpt '+file);return s.slice(a,b).trim();};
const step=(id,title,description,artifact,code,related=[])=>({id,title,description,artifact:{title:artifact,language:'JavaScript',code},...(related.length?{related}:{} )});
const data={title:'How Stars works',eyebrow:'BOOMER RAWLINGS / STRUCTURE & CODE',description:'Follow the data, animation and interface through ten connected explanations, each beside the code that makes it work.',footer:'Figure data, software credits and licenses: /stars-assets/credits.txt.',plans:[
 {id:'development',title:'Build the constellation behavior',summary:'Source the figures, preserve the wandering, then refine the lock and release.',steps:[
  {id:'sources',title:'Separate the figure from the surrounding sky',description:'Transcribe explicit figure membership and catalog coordinates. Chart regions contain many background stars; they must not become part of the recognizable figure by accident.',artifact:{title:'Audited catalog record: Hercules',language:'JSON',code:JSON.stringify(JSON.parse(read('constellations.json')).constellations.find(p=>p.id==='Her'),null,2)},resources:[{label:'Full figure database',url:'https://boomerrawlings.com/stars-assets/constellations.json'}]},
  step('fit','Match drifting points to a figure','The assignment algorithm pairs nearby dots with catalog points, then refines the rotation, scale and position. Its result is a list of particle indices and target coordinates that the animation can interpolate.','Particle assignment and fitting',excerpt('constellations.js','  function candidate(','  function admit('),['sources']),
  step('lock','Animate the approach, hold and release','One motion clock drives the transition. The figure, name and underline resolve together with a brief blue-and-gold scan accent. The finished figure remains readable for15–20 seconds. The frequency slider sets the pace of new formations.','Animation time and opacity',excerpt('constellations.js','    var until=','    g.exitAge=')+'\n\n'+excerpt('constellations.js','   var approach=','   c.entryDirection='),['fit']),
  step('release','Retract connections before returning to drift','Each edge splits at its center and shortens into both endpoint stars. A cardinal sweep staggers the retraction; stars remain fixed until their lines clear.','Actual edge retraction',excerpt('constellations.js',' function pieces(',' function fold('),['lock']),
  step('clearance','Compose the figure and its label','A figure is a set of points plus its name. The layout function measures the point extents, centers the text beneath them, and returns a shared bounding rectangle. This gives the whole composition a coherent position.','Figure and label geometry',excerpt('constellations.js',' function bounds(',' function obstacles('),['fit'])
 ]},
 {id:'browser',title:'Build the browser interface',summary:'Connect settings, local time, reminders and wave data to one quiet display.',steps:[
  step('settings','Define one settings model','One object describes the clock, timezone, optional panels and both frequency sliders. defaults() returns10-second constellations and5-minute reminders. normalize() merges a saved choice into that object; the same model drives both the form and the renderer.','Defaults and configuration model',excerpt('model.js','export const intervals=','export function parts(')),
  step('tips','Turn wall-clock time into reminders','Convert the chosen timezone into hour, minute and second values. A modulo calculation finds progress through the selected interval; the first30 seconds display the corresponding line from a288-message daily sequence.','Local-time reminder schedule',excerpt('model.js','export function reminder(','export function countdown('),['settings']),
  step('water','Connect wave data to the scene','The Marine API supplies wave height and period near Scripps Pier. The model converts metres to feet for display, and the renderer uses the height to shape its small animated wave. The panel labels this as an offshore model estimate.','Wave data model',excerpt('model.js','export function marine(','\n}')+'\n}',['settings']),
  step('quiet','Start the scene with one action','Jump in passes defaults() directly to enterStars(). Applying custom settings calls the same function with the form values. It creates the configured constellation system, closes settings, and gives the canvas the full screen.','Scene entry and Jump in',excerpt('stars.js','function enterStars(','form.addEventListener('),['settings']),
  {id:'checks',title:'Check the behavior, then publish',description:'The desktop constellation work passed 150 database, geometry, timing and overlay checks. The browser adaptation adds focused model and page tests plus the existing website build. Browser layout and interactions are checked separately.',artifact:{title:'Reproducible checks',language:'shell',code:'node scripts/build-stars-workflow.mjs\nnode --test scripts/test-stars.mjs\nnpm test'},related:['tips','water','quiet']}
 ]}
]};
const notes={sources:'Each star has a catalog ID and normalized x/y coordinates. An edge stores two indices into that star array; it describes a connection without duplicating positions.',fit:'assign() minimizes combined travel between particles and target stars. refine() adjusts one uniform transform. indices identifies the particles; targets gives their display destinations.',lock:'snapMotion is the end of the approach. Subtracting it from motion gives the age of the hold. visible and labelAlpha feed drawing opacity; cadence determines the next formation time.',release:'pieces() returns two shortened segments, one anchored at each endpoint. The factor f shrinks from one-half to zero, so each connection retracts toward its stars.',clearance:'The minimum and maximum point coordinates define the figure rectangle. label.width determines text centering. union() combines both into one layout footprint.',settings:'The reminder slider uses seven positions mapped through intervals[]. The constellation slider stores seconds directly. constellationOptions() passes that interval to the animation scheduler.',tips:'minute % settings.tips is the number of minutes into the current reminder interval. slot selects one of288 five-minute messages; age controls the30-second visibility and fade.',water:'wave_height arrives in metres. Multiplying by3.28084 yields feet. period is kept in seconds and time is stored as a JavaScript timestamp.',quiet:'The two entry paths share initialization, so default and customized screens use the same rendering code. The configuration object is saved locally before the canvas takes over.',checks:'The focused tests cover time formatting, reminder intervals, slider values and actual constellation lock spacing. The site build checks the published pages and their links.'};
for(const plan of data.plans)for(const item of plan.steps)item.artifact.note=notes[item.id];
writeFileSync(dir+'workflow.json',JSON.stringify(data,null,2)+'\n');
let html=await renderWorkflow(data);html=html.replace('<title>Workflow Display</title>','<title>Stars development workflow | Boomer Rawlings</title><meta name="description" content="Stars development decisions paired with catalog data and actual implementation."/><link rel="canonical" href="https://boomerrawlings.com/stars-assets/workflow.html"/>');
html=html.replace('</style>','\n:root{--wf-background:#080e13;--wf-surface:#0f1920;--wf-accent:#7eb7d4;--wf-dependency:#e6cf82;--wf-border:#3c505c}.plan-choice{border-radius:2px}.workspace{max-width:1200px}\n</style>');
const embedded=`
if(new URLSearchParams(location.search).has('embed')){
 document.documentElement.classList.add('embedded');
 const node=document.getElementById('workflow-data'),all=JSON.parse(node.textContent);
 all.plans=[{id:'full',title:'The complete Stars workflow',summary:'Ten connected steps: audited figures, motion, lock, release, clearance, settings, reminders, wave data, quiet controls and verification.',steps:all.plans.flatMap(p=>p.steps)}];
 node.textContent=JSON.stringify(all);
 window.addEventListener('load',()=>{
  document.querySelector('.plan-choice').click();
  let last=0;
  const report=()=>{const height=Math.max(320,Math.ceil(document.body.getBoundingClientRect().height+2));if(height!==last){last=height;parent.postMessage({type:'stars-workflow-height',height},location.origin);}};
  new ResizeObserver(report).observe(document.body);
  window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='stars-workflow-measure'){last=0;report();}});
  report();
 });
}
`;
html=html.replace('<script>',`<script>${embedded}`)
 .replace('if (open) focusTimer =','if (open && !document.documentElement.classList.contains("embedded")) focusTimer =')
 .replace('</style>','\n.embedded{overflow:hidden}.embedded .page-heading,.embedded .plan-launcher{display:none}.embedded .workspace{padding:0 20px}.embedded .guide-heading{padding-top:24px}\n</style>');
writeFileSync(dir+'workflow.html',html);
console.log('Stars workflow built from current source.');
