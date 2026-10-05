import { topics, sources } from '../../../../public/brain/curriculum.js';
import type { LectureCourse, Lecture, LectureSlide, LectureResource } from './types';

export class LectureAccessError extends Error {
  readonly code:'password'|'unavailable';
  constructor(code:'password'|'unavailable') {
    super(code==='password'?'Could not unlock this collection. Check the password.':'Lecture collection unavailable. Try again.');
    this.name='LectureAccessError';this.code=code;
  }
}

export const lecturePackLimits={payloadBytes:64*1024*1024,manifestBytes:96*1024*1024,records:8,minIterations:310000,maxIterations:600000} as const;
export type EncryptedLectureRecord={id:string;kdf:'PBKDF2-SHA256';iterations:number;cipher:'AES-256-GCM';salt:string;nonce:string;ciphertext:string};
export type LectureManifest={version:1;collections:EncryptedLectureRecord[]};
const knownTopics=new Set(topics.map(topic=>topic.id)),knownSources=new Set(Object.keys(sources));
const encoder=new TextEncoder();
function invalid():never{throw new LectureAccessError('unavailable');}
function object(value:unknown,keys:string[]):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))return invalid();
  const record=value as Record<string,unknown>;
  if(Object.keys(record).some(key=>!keys.includes(key)))return invalid();return record;
}
function text(value:unknown,max=2000):string{
  if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))return invalid();return value;
}
function id(value:unknown):string{const v=text(value,80);if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v))return invalid();return v;}
function integer(value:unknown,min:number,max:number):number{if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max)return invalid();return value;}
function list(value:unknown,max:number,min=0):unknown[]{if(!Array.isArray(value)||value.length<min||value.length>max)return invalid();return value;}
function optionalText(value:unknown,max=2000):string|undefined{return value===undefined?undefined:text(value,max);}
function unique(values:string[]):void{if(new Set(values).size!==values.length)invalid();}
function topic(value:unknown):string{const v=id(value);if(!knownTopics.has(v))return invalid();return v;}
function base64(value:unknown,maxBytes:number):string{
  if(typeof value!=='string'||!value.length||value.length%4||value.length>Math.ceil(maxBytes/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))return invalid();
  try{if(btoa(atob(value.slice(-4)))!==value.slice(-4))return invalid();}catch{return invalid();}
  const length=value.length/4*3-(value.endsWith('==')?2:value.endsWith('=')?1:0);if(length>maxBytes)return invalid();return value;
}
function decode(value:string):ArrayBuffer{const raw=atob(value),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes.buffer;}
function image(value:unknown):string{
  const v=text(value,17*1024*1024),match=/^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(v);if(!match)return invalid();
  base64(match[2],12*1024*1024);const prefix=atob(match[2].slice(0,24));
  if(match[1]==='png'&&!prefix.startsWith('\x89PNG\r\n\x1a\n')||match[1]==='jpeg'&&!prefix.startsWith('\xff\xd8\xff')||match[1]==='webp'&&!(prefix.startsWith('RIFF')&&prefix.slice(8,12)==='WEBP'))return invalid();return v;
}
function resource(value:unknown):LectureResource{
  const r=object(value,['kind','title','url','optional','slides']);if(!['slides','paper','video'].includes(String(r.kind)))return invalid();
  const result:LectureResource={kind:r.kind as LectureResource['kind'],title:text(r.title,500)};
  if(r.url!==undefined){const raw=text(r.url,4096);let url:URL;try{url=new URL(raw);}catch{return invalid();}if(raw!==raw.trim()||/[\s\u0000-\u001f]/.test(raw)||url.protocol!=='https:'||url.username||url.password||!url.hostname)return invalid();result.url=raw;}
  if(r.optional!==undefined){if(typeof r.optional!=='boolean')return invalid();result.optional=r.optional;}if(r.slides!==undefined){result.slides=list(r.slides,200).map(slide);unique(result.slides.map(s=>s.id));}return result;
}
function slide(value:unknown):LectureSlide{
  const r=object(value,['id','title','kicker','takeaway','bullets','notes','sourceIds','source','reference','visual','teaching','presentation']);
  const result:LectureSlide={id:id(r.id),title:text(r.title,500),takeaway:text(r.takeaway,6000),bullets:list(r.bullets,20).map(v=>text(v,3000)),sourceIds:list(r.sourceIds,30).map(v=>id(v)),visual:null as unknown as LectureSlide['visual']};
  unique(result.sourceIds);if(result.sourceIds.some(v=>!knownSources.has(v)))return invalid();
  const kicker=optionalText(r.kicker,500),notes=optionalText(r.notes,16000);if(kicker!==undefined)result.kicker=kicker;if(notes!==undefined)result.notes=notes;
  if(r.source!==undefined){const s=object(r.source,['title','page']);result.source={title:text(s.title,500),page:integer(s.page,1,10000)};}
  if(r.reference!==undefined){const s=object(r.reference,['image','alt']);result.reference={image:image(s.image),alt:text(s.alt,2000)};}
  if(r.presentation!==undefined){
    const p=object(r.presentation,['title','eyebrow','layout','groups','figures','takeaway']);
    if(!['title','text','split','gallery','comparison'].includes(String(p.layout)))return invalid();
    result.presentation={title:text(p.title,500),layout:p.layout as NonNullable<LectureSlide['presentation']>['layout'],groups:list(p.groups,12).map(value=>{const g=object(value,['title','items']),title=optionalText(g.title,500);return{...(title?{title}:{}),items:list(g.items,30).map(v=>text(v,5000))};}),figures:list(p.figures,8).map(value=>{const f=object(value,['image','alt','caption']),caption=optionalText(f.caption,3000);return{image:image(f.image),alt:text(f.alt,3000),...(caption?{caption}:{})};})};
    const eyebrow=optionalText(p.eyebrow,500),takeaway=optionalText(p.takeaway,4000);if(eyebrow)result.presentation.eyebrow=eyebrow;if(takeaway)result.presentation.takeaway=takeaway;
  }
  if(r.teaching!==undefined){
    const t=object(r.teaching,['steps','demo']);
    result.teaching={steps:list(t.steps,8).map(value=>{
      const s=object(value,['title','explanation','region']);
      const step:NonNullable<LectureSlide['teaching']>['steps'][number]={title:text(s.title,250),explanation:text(s.explanation,4000)};
      if(s.region!==undefined){const box=object(s.region,['x','y','width','height']);for(const k of ['x','y','width','height'])if(typeof box[k]!=='number'||!Number.isFinite(box[k])||(box[k] as number)<0||(box[k] as number)>1)return invalid();const {x,y,width,height}=box as Record<string,number>;if(width<=0||height<=0||x+width>1.001||y+height>1.001)return invalid();step.region={x,y,width,height};}return step;
    })};
    if(t.demo!==undefined){const d=object(t.demo,['label','purpose','kind']);if(d.kind!=='existing'&&d.kind!=='propagation')return invalid();result.teaching.demo={label:text(d.label,250),purpose:text(d.purpose,4000),kind:d.kind};}
  }
  const v=object(r.visual,['kind','topicId','representation','lab','image','alt','caption','hotspots','prompt','choices']);
  if(v.kind==='none'){object(r.visual,['kind']);if(!result.presentation)return invalid();result.visual={kind:'none'};
  }else if(v.kind==='model'){
    object(r.visual,['kind','topicId','representation']);const representation=optionalText(v.representation,80);if(representation!==undefined&&!/^[a-z0-9-]+$/.test(representation))return invalid();
    result.visual={kind:'model',topicId:topic(v.topicId),...(representation!==undefined?{representation}:{})};
  }else if(v.kind==='lab'){
    object(r.visual,['kind','lab']);if(!['spike','summation','rate-code','methods','propagation'].includes(String(v.lab)))return invalid();result.visual={kind:'lab',lab:v.lab as Extract<LectureSlide['visual'],{kind:'lab'}>['lab']};
  }else if(v.kind==='comparison'){
    object(r.visual,['kind','prompt','choices']);result.visual={kind:'comparison',prompt:text(v.prompt,3000),choices:list(v.choices,6,2).map(value=>{const c=object(value,['label','explanation']);return{label:text(c.label,1000),explanation:text(c.explanation,6000)};})};
  }else if(v.kind==='figure'){
    object(r.visual,['kind','image','alt','caption','hotspots']);const caption=optionalText(v.caption,4000);
    const visual:Extract<LectureSlide['visual'],{kind:'figure'}>={kind:'figure',image:image(v.image),alt:text(v.alt,2000),...(caption!==undefined?{caption}:{})};
    if(v.hotspots!==undefined)visual.hotspots=list(v.hotspots,30).map(value=>{const h=object(value,['x','y','label','explanation']);if(typeof h.x!=='number'||typeof h.y!=='number'||!Number.isFinite(h.x)||!Number.isFinite(h.y)||h.x<0||h.x>1||h.y<0||h.y>1)return invalid();return{x:h.x,y:h.y,label:text(h.label,500),explanation:text(h.explanation,6000)};});
    result.visual=visual;
  }else return invalid();
  if(result.teaching&&!result.presentation&&!result.reference&&result.visual.kind!=='figure')return invalid();
  return result;
}

/** Validate and copy only supported fields. No decrypted strings enter persistence. */
export function validateLectureCourse(value:unknown):LectureCourse{
  const r=object(value,['version','id','title','instructor','term','moduleTitle','description','lectures','connections','preview']);if(r.version!==1)return invalid();
  const lectures:Lecture[]=list(r.lectures,40,1).map(value=>{
    const l=object(value,['id','number','title','week','summary','status','topics','resources','slides']);if(l.status!=='ready'&&l.status!=='awaiting-slides')return invalid();
    const slides=list(l.slides,200,l.status==='ready'?1:0).map(slide);unique(slides.map(s=>s.id));
    return{id:id(l.id),number:integer(l.number,1,1000),title:text(l.title,500),week:text(l.week,500),summary:text(l.summary,12000),status:l.status,topics:list(l.topics,30).map(value=>{const t=object(value,['label','topicId']);return{label:text(t.label,500),...(t.topicId!==undefined?{topicId:topic(t.topicId)}:{})};}),resources:list(l.resources,30).map(resource),slides};
  });
  unique(lectures.map(l=>l.id));unique(lectures.map(l=>String(l.number)));const lectureIds=new Set(lectures.map(l=>l.id));
  const p=object(r.preview,['title','description','slides']),preview={title:text(p.title,500),description:text(p.description,12000),slides:list(p.slides,200).map(slide)};unique(preview.slides.map(s=>s.id));
  const connections=list(r.connections,300).map(value=>{const c=object(value,['from','to','label','kind']);const from=id(c.from),to=id(c.to);if(!lectureIds.has(from)||!lectureIds.has(to)||from===to||c.kind!=='sequence'&&c.kind!=='concept')return invalid();return{from,to,label:text(c.label,1000),kind:c.kind as 'sequence'|'concept'};});unique(connections.map(c=>`${c.from}/${c.to}/${c.kind}`));
  return{version:1,id:id(r.id),title:text(r.title,500),instructor:text(r.instructor,500),term:text(r.term,500),moduleTitle:text(r.moduleTitle,500),description:text(r.description,16000),lectures,connections,preview};
}

export function validateLectureManifest(value:unknown):LectureManifest{
  const r=object(value,['version','collections']);if(r.version!==1)return invalid();
  const collections=list(r.collections,lecturePackLimits.records,1).map(value=>{
    const c=object(value,['id','kdf','iterations','cipher','salt','nonce','ciphertext']);
    if(typeof c.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(c.id)||c.kdf!=='PBKDF2-SHA256'||c.cipher!=='AES-256-GCM')return invalid();
    const salt=base64(c.salt,16),nonce=base64(c.nonce,12),ciphertext=base64(c.ciphertext,lecturePackLimits.payloadBytes+16);
    if(decode(salt).byteLength!==16||decode(nonce).byteLength!==12||ciphertext.length<24)return invalid();
    return{id:c.id,kdf:c.kdf,iterations:integer(c.iterations,lecturePackLimits.minIterations,lecturePackLimits.maxIterations),cipher:c.cipher,salt,nonce,ciphertext} as EncryptedLectureRecord;
  });
  unique(collections.map(c=>c.id));unique(collections.map(c=>c.salt));unique(collections.map(c=>c.nonce));if(collections.reduce((sum,c)=>sum+c.ciphertext.length,0)>lecturePackLimits.manifestBytes)return invalid();return{version:1,collections};
}

/** Authenticates record identity and all public cryptographic parameters. */
export function lectureRecordAAD(record:Omit<EncryptedLectureRecord,'ciphertext'>):ArrayBuffer{
  return encoder.encode(JSON.stringify(['brain-lectures',1,record.id,record.kdf,record.iterations,record.cipher,record.salt,record.nonce])).buffer;
}
function abort(signal?:AbortSignal):void{if(signal?.aborted)throw new DOMException('Request canceled.','AbortError');}
async function fetchManifest(signal?:AbortSignal):Promise<LectureManifest>{
  const response=await fetch('/brain/lectures/collections.json',{signal,cache:'no-cache',credentials:'omit',redirect:'error'});abort(signal);
  if(!response.ok||!response.body)return invalid();const advertised=response.headers.get('content-length');
  if(advertised!==null&&(!/^\d+$/.test(advertised)||Number(advertised)>lecturePackLimits.manifestBytes))return invalid();
  const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true}),parts:string[]=[];let count=0;
  try{for(;;){abort(signal);const next=await reader.read();if(next.done)break;count+=next.value.byteLength;if(count>lecturePackLimits.manifestBytes||parts.length>=8192){await reader.cancel();return invalid();}parts.push(decoder.decode(next.value,{stream:true}));}parts.push(decoder.decode());}
  finally{reader.releaseLock();}abort(signal);return validateLectureManifest(JSON.parse(parts.join('')));
}

export async function unlockLectures(password:string,signal?:AbortSignal):Promise<LectureCourse>{
  abort(signal);if(typeof password!=='string'||!password.length||password.length>1024)throw new LectureAccessError('password');
  const bytes=encoder.encode(password);if(bytes.byteLength>1024){bytes.fill(0);throw new LectureAccessError('password');}
  try{
    if(!globalThis.crypto?.subtle)return invalid();const manifest=await fetchManifest(signal),subtle=globalThis.crypto.subtle;
    const material=await subtle.importKey('raw',bytes,{name:'PBKDF2'},false,['deriveKey']);bytes.fill(0);abort(signal);
    for(const record of manifest.collections){
      abort(signal);const key=await subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:decode(record.salt),iterations:record.iterations},material,{name:'AES-GCM',length:256},false,['decrypt']);abort(signal);
      let plaintext:ArrayBuffer;try{plaintext=await subtle.decrypt({name:'AES-GCM',iv:decode(record.nonce),additionalData:lectureRecordAAD(record),tagLength:128},key,decode(record.ciphertext));}
      catch(error){abort(signal);if(error&&typeof error==='object'&&'name' in error&&error.name==='OperationError')continue;return invalid();}
      try{abort(signal);if(plaintext.byteLength>lecturePackLimits.payloadBytes)return invalid();const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plaintext));const course=validateLectureCourse(value);abort(signal);return course;}
      finally{new Uint8Array(plaintext).fill(0);}
    }
    throw new LectureAccessError('password');
  }catch(error){abort(signal);if(error instanceof LectureAccessError)throw error;throw new LectureAccessError('unavailable');}
  finally{bytes.fill(0);}
}
