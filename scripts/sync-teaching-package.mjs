import { readFileSync, writeFileSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';
const source = resolve(process.argv[2] || '../Packages/L15');
const manifest = JSON.parse(readFileSync(join(source,'manifest.json'),'utf8'));
if(!Number.isInteger(manifest.module) || manifest.module < 12 || manifest.module > 19) throw new Error('Expected a reviewed lecture12–19 package.');
const moduleId = `l${manifest.module}`;
const target = `public/brain/teaching/${moduleId}`;
const webOnly = process.argv.includes('--web-only');
mkdirSync(target,{recursive:true});
function sourceLabel(item){
  if(typeof item==='string')return item;
  return `${item.file}${item.pages?.length ? ` · pages ${item.pages.join(', ')}` : ''}${item.lines ? ` · lines ${Array.isArray(item.lines)?item.lines.join('–'):item.lines}` : ''}${item.note?` · ${item.note}`:''}`;
}
const normalized = {...manifest,assets:manifest.assets.map(asset=>{
  const result={...asset,sources:asset.sources.map(sourceLabel)};
  for(const kind of (webOnly ? ['video','poster'] : ['gif','video','poster'])){
    const name=asset[kind];
    if(name!==basename(name) || !/^[a-z0-9-]+\.(gif|mp4|png)$/.test(name))throw new Error(`Unexpected exported filename: ${name}`);
    if(statSync(join(source,name)).size===0)throw new Error(`Incomplete export: ${name}`);
    copyFileSync(join(source,name),join(target,name));
  }
  return result;
})};
if (!webOnly && manifest.downloadBundle) {
  const bundle = manifest.downloadBundle;
  if (bundle !== basename(bundle) || bundle !== `psyc108-${moduleId}-gifs.zip`) throw new Error('Unexpected bundle name.');
  if (statSync(join(source,bundle)).size === 0) throw new Error('Incomplete GIF bundle.');
  copyFileSync(join(source,bundle),join(target,bundle));
}
writeFileSync(`src/data/brain/${moduleId}-teaching.json`,JSON.stringify(normalized,null,2)+'\n');
console.log(`Integrated ${normalized.assets.length} reviewed ${moduleId.toUpperCase()} animations${webOnly ? ' (web preview only)' : ' and GIF package'}.`);
