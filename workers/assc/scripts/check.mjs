import { readdir,readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
let count=0;
for(const dir of ['.','client','scripts','test']) {
  for(const file of await readdir(path.join(root,dir),{withFileTypes:true})) {
    if(!file.isFile() || !/\.(mjs|js)$/.test(file.name))continue;
    const target=path.join(root,dir,file.name);const result=spawnSync(process.execPath,['--check',target],{encoding:'utf8'});
    if(result.status){process.stderr.write(result.stderr);process.exit(1);}count++;
  }
}
for(const name of ['gate.html','app.html']) {
  const html=await readFile(path.join(root,'client',name),'utf8');
  if(!/name="robots"[^>]+noindex/.test(html))throw new Error(`${name}: missing noindex`);
  if(/<script[^>]*src="https?:/i.test(html))throw new Error(`${name}: external script`);
}
console.log(`Syntax checked ${count} JavaScript files; noindex and local scripts verified.`);
