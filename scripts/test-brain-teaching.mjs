import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { transformSync, buildSync } from 'esbuild';
import { createHash } from 'node:crypto';
const source = readFileSync('src/scripts/brain/guitar-learning-model.ts','utf8');
const {code} = transformSync(source,{loader:'ts',format:'esm'});
const model = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
let checks=0;
const motionCode=buildSync({entryPoints:['src/scripts/brain/guitar-learning-motion.ts'],bundle:true,write:false,platform:'node',format:'esm'}).outputFiles[0].text;
const motion=await import(`data:text/javascript;base64,${Buffer.from(motionCode).toString('base64')}`);
for(const key of ['cortex','gpi','thalamus','snc']){
 let prior=0;
 for(let t=0;t<=30;t+=.05){const q=motion.focusAt(t)[key];assert.ok(q>=0&&q<=1&&Math.abs(q-prior)<.08,'Box emphasis fades continuously');prior=q;}
 assert.equal(motion.focusAt(30)[key],0);checks++;
}
assert.equal(model.markerScale(0),1);assert.equal(model.markerScale(3),1.58);assert.equal(model.markerScale(-3),.6);checks+=3;
for(const outcome of ['good','poor']){
  const before={go:0,nogo:0},after={go:outcome==='good'?1:-1,nogo:outcome==='good'?-1:1};
  assert.deepEqual(motion.cycleFrame(17.9,outcome,before,after).strength,before,'No growth before dopamine feedback');checks++;
  let previous=0;
  for(let t=18;t<24;t+=.05){const frame=motion.cycleFrame(t,outcome,before,after);assert.ok(frame.growth>=previous&&frame.growth-previous<.02,'Growth is gradual and monotone');previous=frame.growth;checks++;}
  assert.deepEqual(motion.cycleFrame(motion.CYCLE_SECONDS,outcome,before,after).strength,after,'Learned strength persists when motion stops');checks++;
  assert.deepEqual(motion.activityAt(motion.CYCLE_SECONDS,outcome),motion.activityAt(0,outcome),'Firing returns to baseline');checks++;
  assert.deepEqual(motion.signalClock(motion.CYCLE_SECONDS),motion.signalClock(0),'Rest and next click show identical signal positions');checks++;
  assert.equal(motion.signalClock(29).opacity,0,'Signal phase reset is invisible');checks++;
}
assert.ok(motion.activityAt(5,'good').go>1&&motion.activityAt(7,'good').gpi<1&&motion.activityAt(9,'good').thalamus>1,'Direct movement has the correct inhibitory signs');checks++;
assert.ok(motion.activityAt(20,'good').dopamine>1&&motion.activityAt(20,'poor').dopamine<1,'Outcome controls burst versus dip');checks++;
for(let pattern=0;pattern<8;pattern++){
  let state=model.initialLearningState();
  for(let trial=0;trial<3;trial++){
    const outcome=(pattern>>trial)&1?'good':'poor';
    const before={...state.strength};
    state=model.beginTrial(state,outcome);
    assert.equal(model.beginTrial(state,'poor'),state,'Cannot overlap a pending trial');checks++;
    assert.deepEqual(model.displayedStrength(state),before);checks++;
    for(let step=0;step<3;step++)state=model.moveTrial(state,1);
    assert.equal(model.displayedStrength(state).go,before.go+(outcome==='good'?1:-1));checks++;
    assert.equal(model.displayedStrength(state).nogo,before.nogo+(outcome==='good'?-1:1));checks++;
    assert.equal(state.completed,trial,'Learning view alone does not count twice');checks++;
    state=model.moveTrial(state,1);
    assert.equal(state.completed,trial+1);checks++;
    state=model.moveTrial(model.moveTrial(state,-1),1);
    assert.equal(state.completed,trial+1,'Revisiting final step cannot add learning');checks++;
  }
  assert.equal(model.beginTrial(state,'good'),state,'Fourth trial is blocked');checks++;
  assert.deepEqual(model.initialLearningState().strength,{go:0,nogo:0});checks++;
}
const registry=buildSync({entryPoints:['src/data/brain/teaching-library.ts'],bundle:true,write:false,platform:'node',format:'esm'}).outputFiles[0].text;
const {modules,mediaUrl}=await import(`data:text/javascript;base64,${Buffer.from(registry).toString('base64')}`);
const downloads=JSON.parse(readFileSync('src/data/brain/teaching-downloads.json','utf8'));
assert.equal(modules.find(module=>module.id==='l15').assets.filter(asset=>asset.type!=='interactive').length,9,'Complete L15 package includes9 GIF assets');checks++;
for(const module of modules){
 const bundle=downloads[module.id];
 assert.ok(bundle&&bundle.file===module.downloadBundle&&/^[a-f0-9]{64}$/.test(bundle.sha256)&&bundle.bytes>0,'Verified release bundle metadata');checks++;
 assert.equal(bundle.url,`https://github.com/BoomerRawlings/boomerrawlings.com/releases/download/psyc108-teaching/${bundle.file.replace('.zip',`-${bundle.sha256.slice(0,12)}.zip`)}`);checks++;
 assert.equal(mediaUrl(module.downloadBundle,module.id),bundle.url);checks++;
 assert.ok(!existsSync(`public/brain/teaching/${module.id}/${module.downloadBundle}`),'ZIP is not duplicated in Pages');checks++;
 assert.ok(readFileSync('dist/brain/psyc108/index.html','utf8').includes(bundle.url),'Library links to versioned release ZIP');checks++;
 for(const asset of module.assets){
  const page=readFileSync(`dist/brain/psyc108/${module.id}/${asset.id}/index.html`,'utf8');
  assert.ok(asset.slides.length && asset.sources.length,`Missing source mapping: ${asset.id}`);checks++;
  assert.ok(page.includes('noindex')&&!page.includes('portal-intro'));checks++;
  if(asset.type==='interactive'){
    assert.ok(!page.includes('download-gif'),'No GIF download for interactable');checks++;continue;
  }
  for(const kind of ['gif','video','poster']){
    const file=`public/brain/teaching/${module.id}/${asset[kind].split(/[\\/]/).pop()}`;
    assert.ok(existsSync(file),`Missing ${file}`);checks++;
    const version=createHash('sha256').update(readFileSync(file)).digest('hex').slice(0,12);
    assert.ok(page.includes(`/brain/teaching/${module.id}/${asset[kind]}?v=${version}`),`Unversioned or stale ${kind}: ${asset.id}`);checks++;
  }
  const gif=readFileSync(`public/brain/teaching/${module.id}/${asset.gif}`);
  assert.equal(gif.subarray(0,6).toString(),'GIF89a');assert.equal(gif.readUInt16LE(6),1280);assert.equal(gif.readUInt16LE(8),720);assert.ok(gif.includes(Buffer.from('NETSCAPE2.0')));checks+=4;
  assert.ok(page.includes('data-teaching-video'));
  if(module.id==='l13'||module.id==='l16'&&asset.id!=='go-no-go-plasticity'||module.id==='l19'&&['sleep-master','two-stage-model','awake-sleep-replay','cortical-strengthening'].includes(asset.id)){
    assert.ok(page.includes('data-chapter-offset="2.1"'),'Source-figure chapters, including reset, open after their readable fades');checks++;
  }
  if(module.id==='l14'){assert.ok(page.includes('data-chapter-offset="2.6"'),'Paused viewpoint chapters finish the turn');checks++;}
  assert.ok(!/<video\b[^>]*\bautoplay/.test(page),'Direct entry starts paused');checks+=2;
  assert.ok(page.includes('download') && page.includes('.gif'),'GIF download exposed');checks++;
 }
}
assert.equal(createHash('sha256').update(readFileSync('public/brain/teaching/l15/circuit-master.gif')).digest('hex'),'b4e2806ad6585b137761551af1aa4c4a8ecdcf7d63290ad2c230289b3b5e6b28','Approved master remains byte-identical');checks++;
for(const id of ['l16','l17']){
 if(!modules.some(module=>module.id===id))continue;
 const config=JSON.parse(readFileSync(`src/data/brain/${id}-interactions.json`,'utf8'));
 assert.ok(modules.find(module=>module.id===id).assets.some(asset=>asset.id===config.id&&asset.type==='interactive'),'Step illustration has a published route');checks++;
 for(const mode of config.modes)for(const step of mode.steps){
  const png=readFileSync(`public/brain/teaching/${id}/${step.poster}`);
  assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1280);assert.equal(png.readUInt32BE(20),720);assert.ok(step.title&&step.caption);checks+=4;
 }
}
for(const id of ['l12','l13','l14','l16','l17','l18','l19']){
 if(modules.some(module=>module.id===id))continue;
 for(const path of [`public/brain/teaching/${id}`,`dist/brain/teaching/${id}`,`dist/brain/psyc108/${id}`]){
  assert.ok(!existsSync(path),`Unreleased module must remain unavailable: ${path}`);checks++;
 }
}
console.log(`Brain teaching: ${checks} content, finite-state, route and artifact checks passed.`);
