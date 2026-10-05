import { randomBytes, randomUUID, pbkdf2, createCipheriv } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile, writeFile, stat, mkdir, rename, unlink, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const project=fileURLToPath(new URL('../',import.meta.url));
const derive=promisify(pbkdf2);
let accessModule;
async function access(){
  if(!accessModule){const result=await build({entryPoints:[path.join(project,'src/scripts/brain/lectures/access.ts')],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});accessModule=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));}
  return accessModule;
}
async function boundedJSON(filename,limit){
  if((await stat(filename)).size>limit)throw new Error('Input exceeds supported size.');
  const bytes=await readFile(filename);try{if(bytes.length>limit)throw new Error('Input exceeds supported size.');return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}finally{bytes.fill(0);}
}

/** Password comes only from the environment; public identity is an opaque UUID. */
export async function buildLecturePack({input,output=path.join(project,'public/brain/lectures/collections.json'),replaceId}={}){
  const password=process.env.BRAIN_LECTURE_PASSWORD;
  if(typeof password!=='string'||!password.length||Buffer.byteLength(password,'utf8')>1024)throw new Error('Password environment variable required.');
  if(typeof input!=='string'||!input)throw new Error('Private input JSON required.');
  const source=await realpath(path.resolve(input)),relative=path.relative(await realpath(project),source);
  if(relative===''||!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative))throw new Error('Private input must be outside the repository.');
  const {validateLectureCourse,validateLectureManifest,lectureRecordAAD,lecturePackLimits}=await access();
  const course=validateLectureCourse(await boundedJSON(source,lecturePackLimits.payloadBytes));
  const destination=path.resolve(output);let manifest={version:1,collections:[]};
  try{manifest=validateLectureManifest(await boundedJSON(destination,lecturePackLimits.manifestBytes));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(replaceId!==undefined&&!manifest.collections.some(record=>record.id===replaceId))throw new Error('Replacement record not found.');
  if(replaceId===undefined&&manifest.collections.length>=lecturePackLimits.records)throw new Error('Maximum collection count reached.');
  const record={id:replaceId??randomUUID(),kdf:'PBKDF2-SHA256',iterations:600000,cipher:'AES-256-GCM',salt:randomBytes(16).toString('base64'),nonce:randomBytes(12).toString('base64'),ciphertext:''};
  const plaintext=Buffer.from(JSON.stringify(course),'utf8'),passwordBytes=Buffer.from(password,'utf8');let key;
  try{
    if(plaintext.length>lecturePackLimits.payloadBytes)throw new Error('Payload exceeds supported size.');
    key=await derive(passwordBytes,Buffer.from(record.salt,'base64'),record.iterations,32,'sha256');
    const cipher=createCipheriv('aes-256-gcm',key,Buffer.from(record.nonce,'base64'));cipher.setAAD(Buffer.from(lectureRecordAAD(record)));
    record.ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final(),cipher.getAuthTag()]).toString('base64');
  }finally{plaintext.fill(0);passwordBytes.fill(0);key?.fill(0);}
  const collections=replaceId===undefined?[...manifest.collections,record]:manifest.collections.map(existing=>existing.id===replaceId?record:existing);
  const next=validateLectureManifest({version:1,collections}),serialized=JSON.stringify(next,null,2)+'\n';
  if(Buffer.byteLength(serialized,'utf8')>lecturePackLimits.manifestBytes)throw new Error('Manifest exceeds supported size.');
  await mkdir(path.dirname(destination),{recursive:true});const temporary=destination+'.'+randomUUID()+'.tmp';
  try{await writeFile(temporary,serialized,{flag:'wx'});await rename(temporary,destination);}finally{try{await unlink(temporary);}catch(error){if(error.code!=='ENOENT')throw error;}}
  return{id:record.id,records:collections.length,bytes:Buffer.byteLength(serialized,'utf8')};
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  try{
    const options={};const names={'--input':'input','--output':'output','--replace':'replaceId'};
    for(let i=2;i<process.argv.length;i+=2){const name=names[process.argv[i]],value=process.argv[i+1];if(!name||!value||value.startsWith('--')||name in options)throw new Error('Invalid command arguments.');options[name]=value;}
    const result=await buildLecturePack(options);console.log(`Encrypted lecture pack saved: ${result.records} record(s), ${result.bytes} bytes. Record ID: ${result.id}`);
  }catch{console.error('Lecture pack not written. Check private input, password environment, bounds and replacement ID.');process.exitCode=1;}
}
