import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { transformSync } from 'esbuild';
const source = readFileSync('src/scripts/brain/guitar-learning-model.ts','utf8');
const {code} = transformSync(source,{loader:'ts',format:'esm'});
const model = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
let checks=0;
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
const manifest=JSON.parse(readFileSync('src/data/brain/l15-teaching.json','utf8'));
assert.equal(manifest.assets.length,9,'Complete L15 package includes9 GIF assets');checks++;
for(const asset of manifest.assets){
  assert.ok(asset.slides.length && asset.sources.length,`Missing source mapping: ${asset.id}`);checks++;
  for(const kind of ['gif','video','poster']){
    const file=`public/brain/teaching/l15/${asset[kind].split(/[\\/]/).pop()}`;
    assert.ok(existsSync(file),`Missing ${file}`);checks++;
  }
  const page=readFileSync(`dist/brain/psyc108/l15/${asset.id}/index.html`,'utf8');
  assert.ok(page.includes('noindex') && page.includes('data-teaching-video') && !page.includes('portal-intro'));
  assert.ok(!/<video\b[^>]*\bautoplay/.test(page),'Direct entry starts paused');checks+=2;
  assert.ok(page.includes('download') && page.includes('.gif'),'GIF download exposed');checks++;
}
const interaction=readFileSync('dist/brain/psyc108/l15/guitar-learning/index.html','utf8');
assert.ok(!interaction.includes('download-gif'),'No GIF download for interactable');checks++;
assert.ok(interaction.includes('noindex') && !interaction.includes('portal-intro'));checks++;
console.log(`Brain teaching: ${checks} content, finite-state, route and artifact checks passed.`);
