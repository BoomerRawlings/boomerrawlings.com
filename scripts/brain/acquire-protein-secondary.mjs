/** Secondary-structure annotations for custom ribbons; deposited coordinates remain untouched. */
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const entries=['6J8J','2R9R','7MIY','3KG2','4PE5','6D6T'];
const output={version:1,representation:'Deposited PDB HELIX and SHEET annotations. Unannotated or unresolved residues are not assigned invented secondary structures.',entries:{}};
for(const pdb of entries){
  const source=`https://files.rcsb.org/download/${pdb}.pdb`;
  const response=await fetch(source);if(!response.ok)throw new Error(`${pdb}: ${response.status}`);
  const text=await response.text(),helices=[],sheets=[];
  for(const line of text.split(/\r?\n/)){
    if(line.startsWith('HELIX '))helices.push({chain:line[19],start:Number(line.slice(21,25)),endChain:line[31],end:Number(line.slice(33,37)),class:Number(line.slice(38,40))});
    if(line.startsWith('SHEET '))sheets.push({chain:line[21],start:Number(line.slice(22,26)),endChain:line[32],end:Number(line.slice(33,37))});
  }
  for(const range of [...helices,...sheets])if(range.chain!==range.endChain||!Number.isFinite(range.start)||range.end<range.start)throw new Error(`Unsupported range ${pdb}`);
  if(!helices.length)throw new Error(`No helix records for ${pdb}`);
  output.entries[pdb]={source,sourceSha256:createHash('sha256').update(text).digest('hex'),helices,sheets};
  console.log(pdb,helices.length,'helices',sheets.length,'strands');
}
await fs.writeFile('public/brain/models/protein-secondary.json',JSON.stringify(output));
