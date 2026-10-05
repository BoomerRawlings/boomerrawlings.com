import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {topics} from '../public/brain/curriculum.js';
import {recognition} from '../public/brain/recognition.js';
import {chemistry} from '../public/brain/chemistry.js';
const read=async p=>JSON.parse(await fs.readFile(`public/brain/${p}`,'utf8'));
assert.deepEqual(Object.keys(recognition).sort(),topics.map(t=>t.id).sort());
for(const t of topics){const r=recognition[t.id];assert(r.view&&r.landmarks.length===3);assert(r.sources.length);r.sources.forEach(url=>assert.match(url,/^https:\/\//));}
const manifest=await read('reference/molecules/manifest.json');
assert.deepEqual(chemistry,manifest.molecules);
assert.deepEqual(Object.keys(chemistry).sort(),topics.filter(t=>t.scene==='molecule').map(t=>t.id).sort());
for(const[id,c]of Object.entries(chemistry)){
 const sdf=await fs.readFile(`public/brain/reference/molecules/${id}.sdf`),svg=await fs.readFile(`public${c.image}`,'utf8');
 assert.equal(createHash('sha256').update(sdf).digest('hex'),c.sourceSha256,`${id}: formula source changed`);
 assert.match(svg,/<svg/);assert(!/<script|https?:\/\//.test(svg.replace(/xmlns[^>]+/g,'')),`${id}: diagram must be self-contained`);
 assert.equal(c.formalCharge,id==='acetylcholine'?1:0);
}
assert.deepEqual(chemistry.glutamate.stereocenters.map(x=>x[1]),['S']);
assert.deepEqual(chemistry.norepinephrine.stereocenters.map(x=>x[1]),['R']);
assert.deepEqual(chemistry.neuropeptides.stereocenters.map(x=>x[1]),['S','S','S']);
const peptide=await read('models/micro-peptide.json'),counts={},atoms=new Map(peptide.atoms.map(a=>[a.id,a])),valence=new Map();
for(const a of peptide.atoms){counts[a.element]=(counts[a.element]||0)+1;assert(a.position.every(Number.isFinite));valence.set(a.id,0);}
assert.deepEqual(counts,{1:35,6:27,7:5,8:7,16:1});
for(const[a,b,order]of peptide.bonds){assert(atoms.has(a)&&atoms.has(b));valence.set(a,valence.get(a)+order);valence.set(b,valence.get(b)+order);const p=atoms.get(a).position,q=atoms.get(b).position,d=Math.hypot(...p.map((x,i)=>x-q[i]));assert(d>.7&&d<2.1,'Peptide covalent bond length');}
for(const a of atoms.values())assert.equal(valence.get(a.id),{1:1,6:4,7:3,8:2,16:2}[a.element],'Peptide atom valence');
assert.match(peptide.representation,/computed conformer/);
const secondary=await read('models/protein-secondary.json'),orientation=await read('models/protein-orientation.json');
assert.deepEqual(Object.keys(secondary.entries).sort(),['2R9R','3KG2','4PE5','6D6T','6J8J','7MIY']);
assert.deepEqual(Object.keys(secondary.entries).sort(),Object.keys(orientation.entries).sort());
for(const[pdb,r]of Object.entries(orientation.entries)){
 assert(r.matchedAlphaCarbons>600&&r.rmsdAngstrom<.02,`${pdb}: rigid fit must retain deposited geometry`);
 const m=r.rotation;assert.equal(m.length,9);
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)assert(Math.abs([0,1,2].reduce((s,k)=>s+m[i*3+k]*m[j*3+k],0)-(i===j?1:0))<1e-8,`${pdb}: rotation must preserve distances`);
 const det=m[0]*(m[4]*m[8]-m[5]*m[7])-m[1]*(m[3]*m[8]-m[5]*m[6])+m[2]*(m[3]*m[7]-m[4]*m[6]);assert(Math.abs(det-1)<1e-8,`${pdb}: no reflected protein stereochemistry`);
 const s=secondary.entries[pdb];assert(s.helices.length&&s.sheets.length);for(const r of [...s.helices,...s.sheets])assert(r.chain===r.endChain&&r.end>=r.start);
}
console.log('Brain recognition passed: 50 landmark references; 9 source-hashed formulas; stereochemical metadata; complete peptide graph; 6 distance- and handedness-preserving protein orientations.');
