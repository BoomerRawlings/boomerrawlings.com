import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
const {code}=transformSync(readFileSync('src/scripts/brain/attention-illustrations.ts','utf8'),{loader:'ts',format:'esm'});
const {salienceResult,toggleParietalLesion}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
// L14 slides14–16: stimulation contrast follows salience, not global/local scale.
const cases=[
 ['global','global','pre',true,false,true],['global','global','left',true,false,false],['global','global','right',true,true,false],
 ['global','local','pre',false,false,true],['global','local','left',false,true,false],['global','local','right',false,false,false],
 ['local','global','pre',false,false,true],['local','global','left',false,true,false],['local','global','right',false,false,false],
 ['local','local','pre',true,false,true],['local','local','left',true,false,false],['local','local','right',true,true,false]
];
for(const [bias,target,condition,salient,impaired,reference] of cases)assert.deepEqual(salienceResult(bias,target,condition),{salient,impaired,reference},`${bias}/${target}/${condition}`);
console.log('Attention teaching: all12 source-mapped salience conditions passed.');
// Every allowed transition: apply, move, and remove exactly one lesion.
for(const [current,side,expected] of [[null,'left','left'],[null,'right','right'],['left','right','right'],['right','left','left'],['left','left',null],['right','right',null]])assert.equal(toggleParietalLesion(current,side),expected,`${current} → ${side}`);
console.log('Parietal teaching: all6 lesion transitions passed.');