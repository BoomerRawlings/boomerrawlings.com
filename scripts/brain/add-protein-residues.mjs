/** Enrich existing coordinate assets without replacing or changing any coordinates. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
for (const id of ['sodium','potassium','calcium','ampa','nmda']) {
  const file=`public/brain/models/micro-${id}.json`, data=JSON.parse(await fs.readFile(file,'utf8'));
  const response=await fetch(data.source); assert(response.ok,`${id}: source download failed`);
  const records=new Map(); let model='1';
  for (const line of (await response.text()).split('\n')) {
    if (line.startsWith('MODEL')) model=line.slice(10).trim();
    if (!line.startsWith('ATOM  ')||line.slice(12,16).trim()!=='CA'||![' ','A'].includes(line[16])) continue;
    const key=`${line[21]}.${model}:${Number(line.slice(22,26))}`;
    if (!records.has(key)) records.set(key,{name:line.slice(17,20).trim(),point:[30,38,46].map(i=>Number(line.slice(i,i+8)))});
  }
  for (const chain of data.chains) {
    const points=chain.segments.flat();
    chain.residueNames=chain.residues.map((residue,i)=>{
      const record=records.get(`${chain.id}:${residue}`); assert(record,`${id} ${chain.id}:${residue} missing source record`);
      assert(points[i].every((p,j)=>Math.abs(p-record.point[j])<.011),`${id} ${chain.id}:${residue} coordinate alignment mismatch`);
      return record.name;
    });
  }
  await fs.writeFile(file,JSON.stringify(data)); console.log(`${id}: residue identities verified against exact deposited C-alpha positions`);
}
