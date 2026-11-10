// Publish an already reviewed package without duplicating ZIPs in the Pages site.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {resolve,join,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const source=resolve(process.argv[2]),manifest=JSON.parse(readFileSync(join(source,'manifest.json'),'utf8'));
const id=`l${manifest.module}`,file=manifest.downloadBundle;
if(!/^l1[2-9]$/.test(id)||file!==`psyc108-${id}-gifs.zip`||basename(file)!==file)throw Error('Unexpected package');
const bytes=readFileSync(join(source,file)),sha=createHash('sha256').update(bytes).digest('hex');
if(bytes.readUInt32LE(0)!==0x04034b50)throw Error('Expected a ZIP package');
if(existsSync(join(source,'COMPLETE.json'))){
 const complete=JSON.parse(readFileSync(join(source,'COMPLETE.json'),'utf8'));
 const recorded=complete.zipSha256||complete.gif_bundle_sha256;
 if(recorded&&recorded!==sha)throw Error('Package differs from validation record');
}
const repo='BoomerRawlings/boomerrawlings.com',tag='psyc108-teaching';
const gh=args=>execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
let release;
try{release=JSON.parse(gh(['release','view',tag,'--repo',repo,'--json','assets']));}
catch(error){
 if(!String(error.stderr).includes('release not found'))throw error;
 mkdirSync('tmp/teaching-bundles',{recursive:true});
 writeFileSync('tmp/teaching-bundles/notes.md','Reviewed PSYC 108 GIF packages for lecture slides.\n\nPlayers and source references: https://boomerrawlings.com/brain/psyc108/\n');
 gh(['release','create',tag,'--repo',repo,'--target','main','--title','PSYC 108 teaching GIF packages','--notes-file','tmp/teaching-bundles/notes.md','--latest=false']);
 release={assets:[]};
}
const name=file.replace('.zip',`-${sha.slice(0,12)}.zip`),url=`https://github.com/${repo}/releases/download/${tag}/${name}`;
if(!release.assets.some(a=>a.name===name)){
 mkdirSync('tmp/teaching-bundles',{recursive:true});const upload=join('tmp/teaching-bundles',name);copyFileSync(join(source,file),upload);
 gh(['release','upload',tag,upload,'--repo',repo]);
}
const response=await fetch(url);if(!response.ok)throw Error(`Download failed: ${response.status}`);
const actual=Buffer.from(await response.arrayBuffer());
if(createHash('sha256').update(actual).digest('hex')!==sha)throw Error('Published ZIP hash mismatch');
const path='src/data/brain/teaching-downloads.json',downloads=JSON.parse(readFileSync(path,'utf8'));
downloads[id]={file,url,sha256:sha,bytes:bytes.length};
writeFileSync(path,JSON.stringify(downloads,null,2)+'\n');
console.log(`Verified ${id} release ZIP: ${bytes.length} bytes, ${sha}`);
