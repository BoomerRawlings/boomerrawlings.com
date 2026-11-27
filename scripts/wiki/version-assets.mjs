import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';

const root='public/wiki-assets/';
const hash=name=>createHash('sha256').update(readFileSync(root+name,'utf8').replaceAll('\r\n','\n')).digest('hex').slice(0,12);
for(const dependency of ['offices.js','shared.js']){
  const version=hash(dependency);
  for(const name of dependency==='offices.js'?['shared.js','wiki.js','map.js']:['wiki.js','map.js']){
    const path=root+name,before=readFileSync(path,'utf8');
    const after=before.replaceAll(new RegExp(dependency.replace('.','\\.')+'\\?v=[a-zA-Z0-9]+','g'),dependency+'?v='+version);
    if(after!==before)writeFileSync(path,after);
  }
}
console.log('Wiki module cache keys match their dependencies.');
