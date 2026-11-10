import {readFileSync,writeFileSync,mkdirSync,copyFileSync,statSync} from 'node:fs';
import {resolve,join,basename} from 'node:path';
const source=resolve(process.argv[2]);
const manifest=JSON.parse(readFileSync(join(source,'manifest.json'),'utf8'));
if(!Number.isInteger(manifest.module)||manifest.module<12||manifest.module>19)throw new Error('Expected a reviewed lecture12–19 package.');
const config=JSON.parse(readFileSync(join(source,'interactions.json'),'utf8'));
if(!config.id||!Array.isArray(config.modes)||!config.modes.length)throw new Error('Missing interactive modes.');
const moduleId=`l${manifest.module}`,target=`public/brain/teaching/${moduleId}`;
mkdirSync(target,{recursive:true});
let count=0;
for(const mode of config.modes){
  if(!mode.id||!mode.title||!Array.isArray(mode.steps)||!mode.steps.length)throw new Error('Incomplete mode.');
  for(const step of mode.steps){
    if(!step.title||!step.caption||step.poster!==basename(step.poster)||!/^interactive-[a-z0-9-]+\.png$/.test(step.poster))throw new Error('Invalid interactive step.');
    if(statSync(join(source,step.poster)).size===0)throw new Error(`Incomplete ${step.poster}`);
    copyFileSync(join(source,step.poster),join(target,step.poster));count++;
  }
}
writeFileSync(`src/data/brain/${moduleId}-interactions.json`,JSON.stringify(config,null,2)+'\n');
console.log(`Integrated ${count} reviewed ${moduleId.toUpperCase()} interactive steps.`);
