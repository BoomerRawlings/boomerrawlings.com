import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, pbkdf2Sync, createCipheriv } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { topics, sources } from '../public/brain/curriculum.js';
import { buildLecturePack } from './build-brain-lecture-pack.mjs';

const project=fileURLToPath(new URL('../',import.meta.url));
const compiled=await build({entryPoints:[path.join(project,'src/scripts/brain/lectures/access.ts')],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const {unlockLectures,validateLectureCourse,validateLectureManifest,LectureAccessError,lecturePackLimits}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const password='Fixture-'+randomUUID(),secondPassword='Other-'+randomUUID();
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1cAAAAASUVORK5CYII=';
const model={id:'source-page-1',title:'Source page',takeaway:'A synthetic test takeaway.',bullets:['A synthetic test idea.'],notes:'Private notes marker for integrity testing.',sourceIds:[Object.keys(sources)[0]],source:{title:'Synthetic document',page:1},reference:{image:png,alt:'Test reference'},visual:{kind:'model',topicId:topics[0].id,representation:'measured'}};
const course={version:1,id:'private-test-collection',title:'Private synthetic lecture collection',instructor:'Synthetic teacher',term:'Test term',moduleTitle:'Test module',description:'Original synthetic fixture, never user course material.',lectures:[{id:'lecture-one',number:1,title:'First test lecture',week:'Week 1',summary:'A synthetic lecture.',status:'ready',topics:[{label:'Test topic',topicId:topics[0].id}],resources:[{kind:'paper',title:'Test reading',url:'https://example.org/paper',optional:true,slides:[{...model,id:'reading-page'}]}],slides:[model,{...model,id:'source-page-2',visual:{kind:'figure',image:png,alt:'Test figure',caption:'Figure caption',hotspots:[{x:.2,y:.8,label:'Test location',explanation:'A test explanation.'}]}},{...model,id:'source-page-3',visual:{kind:'lab',lab:'spike'}},{...model,id:'source-page-4',visual:{kind:'comparison',prompt:'Choose the supported claim.',choices:[{label:'One',explanation:'First explanation.'},{label:'Two',explanation:'Second explanation.'}]}}]}],connections:[],preview:{title:'Preview',description:'No copied private content.',slides:[]}};
const clone=value=>structuredClone(value);
// Independent Node crypto construction proves compatibility, not a loader round-trip.
function encrypted(value,secret=password){
  const record={id:randomUUID(),kdf:'PBKDF2-SHA256',iterations:310000,cipher:'AES-256-GCM',salt:randomBytes(16).toString('base64'),nonce:randomBytes(12).toString('base64'),ciphertext:''};
  const key=pbkdf2Sync(secret,Buffer.from(record.salt,'base64'),record.iterations,32,'sha256');
  const cipher=createCipheriv('aes-256-gcm',key,Buffer.from(record.nonce,'base64'));
  cipher.setAAD(Buffer.from(JSON.stringify(['brain-lectures',1,record.id,record.kdf,record.iterations,record.cipher,record.salt,record.nonce])));
  record.ciphertext=Buffer.concat([cipher.update(Buffer.from(JSON.stringify(value))),cipher.final(),cipher.getAuthTag()]).toString('base64');key.fill(0);return record;
}
const originalFetch=globalThis.fetch;
async function withManifest(manifest,callback){
  globalThis.fetch=async(url,options)=>{assert.equal(url,'/brain/lectures/collections.json');assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-cache');assert.equal(options.redirect,'error');return new Response(JSON.stringify(manifest),{headers:{'content-type':'application/json'}});};
  try{return await callback();}finally{globalThis.fetch=originalFetch;}
}
const failure=code=>error=>error instanceof LectureAccessError&&error.code===code&&!error.message.includes(password)&&!error.message.includes(course.title);
const validRecord=encrypted(course),manifest={version:1,collections:[validRecord]};

test('Independent AES-GCM fixture unlocks the full validated course, source figure, lab and reading guide',async()=>{
  await withManifest(manifest,async()=>assert.deepEqual(await unlockLectures(password),course));
  const validated=validateLectureCourse(course);validated.lectures[0].slides[0].bullets.push('Changed in caller');assert.equal(course.lectures[0].slides[0].bullets.length,1,'Validator must copy arrays');
});
test('Passwords remain exact; wrong passwords and ciphertext/AAD tampering never return plaintext',async()=>{
  for(const wrong of [secondPassword,password.toLowerCase(),' '+password])await withManifest(manifest,()=>assert.rejects(unlockLectures(wrong),failure('password')));
  for(const mutate of [r=>{const bytes=Buffer.from(r.ciphertext,'base64');bytes[0]^=1;r.ciphertext=bytes.toString('base64');},r=>{r.id=randomUUID();},r=>{r.nonce=randomBytes(12).toString('base64');}]){
    const damaged=clone(manifest);mutate(damaged.collections[0]);await withManifest(damaged,()=>assert.rejects(unlockLectures(password),failure('password')));
  }
});
test('Different future passwords try independent records and return only their matching collection',async()=>{
  const other=clone(course);other.id='other-private-collection';other.title='Other private lecture';
  const future={version:1,collections:[validRecord,encrypted(other,secondPassword)]};
  await withManifest(future,async()=>assert.deepEqual(await unlockLectures(secondPassword),other));
  await withManifest(future,async()=>assert.deepEqual(await unlockLectures(password),course));
});
test('Authenticated but malformed payloads fail as unavailable with no decrypted payload in the error',async()=>{
  const bad=clone(course);bad.lectures[0].slides[0].visual.topicId='not-an-existing-topic';
  await withManifest({version:1,collections:[encrypted(bad)]},()=>assert.rejects(unlockLectures(password),failure('unavailable')));
});
test('Malformed crypto parameters, counts, base64 and duplicate identities are rejected before KDF',async()=>{
  const native=globalThis.crypto,descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');let derives=0;
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{subtle:{importKey:native.subtle.importKey.bind(native.subtle),deriveKey(){derives++;throw Error('KDF should not run');}}}});
  try{
    const mutations=[m=>m.version=2,m=>m.collections[0].iterations=0,m=>m.collections[0].iterations=600001,m=>m.collections[0].iterations=Infinity,m=>m.collections[0].cipher='AES-CBC',m=>m.collections[0].salt='AAAA',m=>m.collections[0].nonce='not-base64',m=>m.collections[0].ciphertext='AAAA',m=>m.collections.push(clone(m.collections[0])),m=>m.collections=Array.from({length:9},()=>clone(m.collections[0])),m=>m.collections[0].courseId=course.id];
    for(const mutate of mutations){const bad=clone(manifest);mutate(bad);await withManifest(bad,()=>assert.rejects(unlockLectures(password),failure('unavailable')));}
    assert.equal(derives,0);
  }finally{Object.defineProperty(globalThis,'crypto',descriptor);}
});
test('Network errors, HTTP errors, non-JSON and advertised/streamed size limits produce generic unavailable errors',async()=>{
  try{
    for(const fetcher of [async()=>{throw Error('Sensitive '+password);},async()=>new Response('Missing',{status:404}),async()=>new Response('<html>Unexpected response</html>'),async()=>new Response('{}',{headers:{'content-length':String(lecturePackLimits.manifestBytes+1)}})]){
      globalThis.fetch=fetcher;await assert.rejects(unlockLectures(password),failure('unavailable'));
    }
    let canceled=false,released=false;
    globalThis.fetch=async()=>({ok:true,headers:new Headers(),body:{getReader:()=>({read:async()=>({done:false,value:{byteLength:lecturePackLimits.manifestBytes+1}}),cancel:async()=>{canceled=true;},releaseLock(){released=true;}})}});
    await assert.rejects(unlockLectures(password),failure('unavailable'));assert.ok(canceled&&released);
  }finally{globalThis.fetch=originalFetch;}
});
test('Abort before fetching and during a KDF never yields a decrypted course',async()=>{
  const before=new AbortController();before.abort();let fetched=false;globalThis.fetch=async()=>{fetched=true;throw Error('Must not fetch');};
  try{await assert.rejects(unlockLectures(password,before.signal),error=>error.name==='AbortError');assert.equal(fetched,false);}finally{globalThis.fetch=originalFetch;}
  const controller=new AbortController(),native=globalThis.crypto,descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');let decrypts=0;
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{subtle:{importKey:native.subtle.importKey.bind(native.subtle),async deriveKey(...args){assert.equal(args[3],false,'Derived key must be nonextractable');const key=await native.subtle.deriveKey(...args);controller.abort();return key;},decrypt(){decrypts++;throw Error('Canceled request decrypted');}}}});
  try{await withManifest(manifest,()=>assert.rejects(unlockLectures(password,controller.signal),error=>error.name==='AbortError'));assert.equal(decrypts,0);}finally{Object.defineProperty(globalThis,'crypto',descriptor);}
});
test('Decrypted validation rejects unsafe links, active images, bad hotspots, unknown references and broken graph endpoints',()=>{
  const mutations=[
    c=>c.lectures[0].resources[0].url='javascript:alert(1)',c=>c.lectures[0].resources[0].url='http://example.org',c=>c.lectures[0].resources[0].url='https://user:pass@example.org',c=>c.lectures[0].resources[0].url='https://example.org/\nfoo',
    c=>c.lectures[0].slides[1].visual.image='data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',c=>c.lectures[0].slides[1].visual.image='data:image/png;base64,AAAA',c=>c.lectures[0].slides[1].visual.hotspots[0].x=1.1,
    c=>c.lectures[0].slides[0].sourceIds=['imaginary-source'],c=>c.lectures[0].slides[0].source.page=0,c=>c.lectures[0].slides[0].visual.topicId='unknown-topic',c=>c.lectures[0].slides[2].visual.lab='unknown-lab',
    c=>c.lectures[0].resources[0].slides[0].visual.topicId='unknown-topic',c=>c.connections=[{from:'lecture-one',to:'missing-lecture',kind:'concept',label:'Invalid'}],c=>c.lectures[0].slides.push(clone(c.lectures[0].slides[0])),c=>c.lectures[0].slides=[],c=>c.lectures[0].slides[0].extra='Unexpected',
  ];
  for(const mutate of mutations){const bad=clone(course);mutate(bad);assert.throws(()=>validateLectureCourse(bad),failure('unavailable'));}
});
test('Access writes no password, decrypted payload or identifiers to browser storage or URLs',async()=>{
  const descriptors=new Map();for(const name of ['localStorage','sessionStorage','location']){descriptors.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{configurable:true,get(){throw Error('Forbidden persistence access: '+name);}});}
  try{await withManifest(manifest,async()=>assert.equal((await unlockLectures(password)).id,course.id));}finally{for(const [name,descriptor] of descriptors){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
});
test('Builder keeps input outside repo, adds independent records, replaces by opaque ID and never emits private metadata',async()=>{
  const temporary=await mkdtemp(path.join(os.tmpdir(),'brain-lecture-test-')),input=path.join(temporary,'private.json'),output=path.join(temporary,'encrypted.json'),saved=process.env.BRAIN_LECTURE_PASSWORD;
  try{
    await writeFile(input,JSON.stringify(course));process.env.BRAIN_LECTURE_PASSWORD=password;
    await assert.rejects(buildLecturePack({input:path.join(project,'scripts/test-brain-lecture-access.mjs'),output}),/outside the repository/);
    const first=await buildLecturePack({input,output});const one=JSON.parse(await readFile(output,'utf8'));assert.equal(one.collections[0].iterations,600000);
    process.env.BRAIN_LECTURE_PASSWORD=secondPassword;const second=await buildLecturePack({input,output});const two=JSON.parse(await readFile(output,'utf8'));
    assert.equal(two.collections.length,2);assert.notEqual(first.id,second.id);assert.notEqual(two.collections[0].salt,two.collections[1].salt);assert.notEqual(two.collections[0].nonce,two.collections[1].nonce);assert.notEqual(two.collections[0].ciphertext,two.collections[1].ciphertext);
    const before=clone(two.collections[0]);await buildLecturePack({input,output,replaceId:second.id});const replaced=JSON.parse(await readFile(output,'utf8'));assert.deepEqual(replaced.collections[0],before);assert.equal(replaced.collections[1].id,second.id);assert.notEqual(replaced.collections[1].salt,two.collections[1].salt);assert.notEqual(replaced.collections[1].nonce,two.collections[1].nonce);
    await withManifest(replaced,async()=>assert.deepEqual(await unlockLectures(secondPassword),course));
    const publicText=await readFile(output,'utf8');for(const secret of [password,secondPassword,course.id,course.title,course.instructor,model.notes])assert.ok(!publicText.includes(secret),'Private metadata leaked into pack');
    for(const record of replaced.collections)assert.deepEqual(Object.keys(record).sort(),['id','kdf','iterations','cipher','salt','nonce','ciphertext'].sort());validateLectureManifest(replaced);
    delete process.env.BRAIN_LECTURE_PASSWORD;await assert.rejects(buildLecturePack({input,output}),/environment/);assert.equal(await readFile(output,'utf8'),publicText);
    process.env.BRAIN_LECTURE_PASSWORD=secondPassword;await writeFile(output,'{"broken":true}');await assert.rejects(buildLecturePack({input,output}));assert.equal(await readFile(output,'utf8'),'{"broken":true}');
  }finally{
    if(saved===undefined)delete process.env.BRAIN_LECTURE_PASSWORD;else process.env.BRAIN_LECTURE_PASSWORD=saved;
    const resolved=path.resolve(temporary),parent=path.resolve(os.tmpdir());assert.equal(path.dirname(resolved),parent);assert.ok(path.basename(resolved).startsWith('brain-lecture-test-'));await rm(resolved,{recursive:true,force:true});
  }
});
