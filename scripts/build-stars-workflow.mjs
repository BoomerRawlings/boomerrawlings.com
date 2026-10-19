import {readFileSync,writeFileSync} from 'node:fs';
import {renderWorkflow} from './vendor/workflow-display/scripts/build.mjs';
const dir='public/stars-assets/',read=name=>readFileSync(dir+name,'utf8');
const excerpt=(file,from,to)=>{const s=read(file),a=s.indexOf(from),b=s.indexOf(to,a+from.length);if(a<0||b<0)throw Error('Missing excerpt '+file);return s.slice(a,b).trim();};
const step=(id,title,description,artifact,code,related=[])=>({id,title,description,artifact:{title:artifact,language:'JavaScript',code},...(related.length?{related}:{} )});
const data={title:'Stars: from drifting points to a quiet screen',eyebrow:'BOOMER RAWLINGS / DEVELOPMENT',description:'Actual design decisions paired with their data and implementation. A curated account of the work, not a verbatim session transcript.',footer:'Figure provenance and software licenses: /stars-assets/credits.txt. The display illustrates constellation figures; it is not a live sky chart.',plans:[
 {id:'development',title:'Build the constellation behavior',summary:'Source the figures, preserve the wandering, then refine the lock and release.',steps:[
  {id:'sources',title:'Separate the figure from the surrounding sky',description:'Transcribe explicit figure membership and catalog coordinates. Chart regions contain many background stars; they must not become part of the recognizable figure by accident.',artifact:{title:'Audited catalog record: Hercules',language:'JSON',code:JSON.stringify(JSON.parse(read('constellations.json')).constellations.find(p=>p.id==='Her'),null,2)},resources:[{label:'Full figure database',url:'https://boomerrawlings.com/stars-assets/constellations.json'}]},
  step('fit','Borrow a display pose, preserve the live path','Assign existing nearby dots to a rigid shape. The running particle state is not rewritten, so it remains available when the constellation releases.','Actual assignment and safety checks',excerpt('constellations.js','  function candidate(','  function admit('),['sources']),
  step('lock','Make the visible figure and its name arrive together','Hercules exposed a polish problem: catalog lines could finish appearing before the shared named lock. Keep explicit lines and contrast hidden during gathering. Reserve a 15–20 second readable hold after the lock sweep.','Actual lock and reveal code',excerpt('constellations.js','    var until=','    g.exitAge=')+'\n\n'+excerpt('constellations.js','   c.start=','   c.entryDirection='),['fit']),
  step('release','Retract connections before returning to drift','Each edge splits at its center and shortens into both endpoint stars. A cardinal sweep staggers the retraction; stars remain fixed until their lines clear.','Actual edge retraction',excerpt('constellations.js',' function pieces(',' function fold('),['lock']),
  step('clearance','Reject a cramped or misleading result','The complete source figure and name must fit on the screen and avoid clock, reminders, surf and other figures. Five is a maximum, not a demand to fill the screen.','Actual bounds and overlap rule',excerpt('constellations.js',' function safe(',' // Rectangular'),['fit'])
 ]},
 {id:'browser',title:'Make it a browser screensaver',summary:'Give the visitor control, then remove the interface and keep the display honest.',steps:[
  step('settings','Start with the device, then allow a choice','Normalize persisted settings, validate IANA zones, and keep optional panels independent. Reminder and constellation sliders keep their choices in local browser storage. Constellation target interval defaults to10 seconds, adjustable through60; gathering and safety still apply.','Actual settings model',excerpt('model.js','export const intervals=','export function parts(')),
  step('tips','Schedule tips in the selected local time','Use local wall-clock boundaries. Show a message for 30 seconds, then glitch it out. Never replay missed reminders after a backgrounded tab resumes.','Actual reminder schedule',excerpt('model.js','export function reminder(','export function countdown('),['settings']),
  step('water','Distinguish a wave model from observed surf','Request offshore wave height and period only after waves are enabled. Validate timestamps and numeric ranges; unavailable data must not look current.','Actual forecast validation',excerpt('model.js','export function marine(','\n}')+'\n}',['settings']),
  step('quiet','Leave only the configured display','After confirmation, remove the settings, fade controls after inactivity, support fullscreen, and pause work in background tabs. Reduced motion keeps the ambient scene still.','Actual idle-control behavior',excerpt('stars.js','function reveal(){','document.querySelector(\'#edit\')'),['settings']),
  {id:'checks',title:'Check the behavior, then publish',description:'The desktop constellation work passed 150 database, geometry, timing and overlay checks. The browser adaptation adds focused model and page tests plus the existing website build. Browser layout and interactions are checked separately.',artifact:{title:'Reproducible checks',language:'shell',code:'node scripts/build-stars-workflow.mjs\nnode --test scripts/test-stars.mjs\nnpm test'},related:['tips','water','quiet']}
 ]}
]};
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
