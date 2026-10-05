/** Download public structural coordinates; run explicitly, never during the website build. */
import fs from 'node:fs/promises';
import path from 'node:path';
const out = path.resolve('public/brain/models');
await fs.mkdir(out, { recursive: true });
async function request(url, json = true) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { const response = await fetch(url); if (!response.ok) throw new Error(`${response.status} ${url}`); return json ? await response.json() : await response.text(); }
    catch (error) { if (attempt === 2) throw error; await new Promise(resolve => setTimeout(resolve, 1000)); }
  }
}
const compounds = [
  ['glutamate', 33032, 'L-glutamic acid'], ['gaba', 119, 'GABA'], ['dopamine', 681, 'Dopamine'],
  ['serotonin', 5202, 'Serotonin'], ['acetylcholine', 187, 'Acetylcholine'], ['norepinephrine', 439260, 'Norepinephrine'],
  ['glycine', 750, 'Glycine'], ['histamine', 774, 'Histamine'],
];
const moleculeData = { version: 1, source: 'PubChem PUG REST', representation: 'Computed 3D conformers. Explicit hydrogens and record formal charges. Not experimental bound conformations; protonation state follows the PubChem record.', molecules: {} };
for (const [id, cid, name] of compounds) {
  try {
    const source = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/JSON?record_type=3d`;
    const record = (await request(source)).PC_Compounds[0], coordinates = record.coords.find(c => c.conformers?.[0]?.z);
    if (!coordinates) throw new Error('No 3D conformer');
    const conformer = coordinates.conformers[0], charge = new Map((record.atoms.charge || []).map(c => [c.aid, c.value]));
    const index = new Map(coordinates.aid.map((aid, i) => [aid, i]));
    const atoms = record.atoms.aid.map((aid, i) => ({ id: aid, element: record.atoms.element[i], charge: charge.get(aid) || 0, position: [conformer.x[index.get(aid)], conformer.y[index.get(aid)], conformer.z[index.get(aid)]] }));
    const bonds = record.bonds.aid1.map((aid, i) => [aid, record.bonds.aid2[i], record.bonds.order[i]]);
    moleculeData.molecules[id] = { cid, name, source, sourcePage: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`, atoms, bonds };
    console.log(`PubChem ${id}: ${atoms.length} atoms / ${bonds.length} bonds`);
  } catch (error) { console.error(`${id}: ${error.message}`); }
}
if (Object.keys(moleculeData.molecules).length !== compounds.length) throw new Error('Incomplete conformer download; existing combined asset preserved.');
await fs.writeFile(path.join(out, 'micro-molecules.json'), JSON.stringify(moleculeData));
const swcSource = 'https://api.brain-map.org/api/v2/well_known_file_download/500961530';
const swcText = await request(swcSource, false);
const swcPoints = swcText.split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#')).map(line => line.trim().split(/\s+/).map(Number));
if (swcPoints.length !== 1925 || swcPoints.some(p => p.length !== 7 || !p.every(Number.isFinite))) throw new Error('Unexpected morphology response');
await fs.writeFile(path.join(out, 'micro-neuron.json'), JSON.stringify({ version: 1, specimen: 485909730, name: 'Allen mouse visual-cortex Cux2 neuron', representation: 'Measured dendrite-only SWC reconstruction; teaching spines and axon are separate overlays.', source: swcSource, sourcePage: 'https://celltypes.brain-map.org/experiment/morphology/485909730', license: 'Allen Institute terms of use: noncommercial use with attribution', licenseUrl: 'https://alleninstitute.org/legal/terms-of-use', citation: 'Allen Cell Types Database (2015), Allen Institute for Brain Science. Mouse Cux2 specimen 485909730, reconstruction 500961528.', columns: ['id','type','x','y','z','radius','parent'], points: swcPoints }));
const proteins = [
  ['sodium', '6J8J', 'Human Nav1.7 with auxiliary subunits', /sodium channel/i],
  ['potassium', '2R9R', 'Rat Kv1.2/Kv2.1 paddle chimera with beta subunits', /potassium channel|voltage.gated.*channel|shaker|subunit beta/i],
  ['calcium', '7MIY', 'Human presynaptic N-type CaV2.2 complex', /calcium channel/i],
  ['ampa', '3KG2', 'Rat GluA2 AMPA receptor', /glutamate receptor/i],
  ['nmda', '4PE5', 'GluN1a/GluN2B NMDA receptor', /glutamate receptor/i],
];
for (const [id, pdb, title, include] of proteins) {
  try {
    const entry = await request(`https://data.rcsb.org/rest/v1/core/entry/${pdb}`);
    const entities = await Promise.all(entry.rcsb_entry_container_identifiers.polymer_entity_ids.map(e => request(`https://data.rcsb.org/rest/v1/core/polymer_entity/${pdb}/${e}`)));
    const names = new Map();
    for (const entity of entities) {
      const name = entity.rcsb_polymer_entity.pdbx_description;
      if (include.test(name)) for (const chain of entity.rcsb_polymer_entity_container_identifiers.auth_asym_ids) names.set(chain, name);
    }
    if (!names.size) throw new Error(`No receptor entities: ${entities.map(e => e.rcsb_polymer_entity.pdbx_description).join(';')}`);
    const source = `https://files.rcsb.org/download/${pdb}.pdb1`;
    const pdbText = await request(source, false);
    const chains = new Map(); let model = '1';
    for (const line of pdbText.split('\n')) {
      if (line.startsWith('MODEL')) model = line.slice(10).trim();
      if (!line.startsWith('ATOM  ') || line.slice(12, 16).trim() !== 'CA' || ![' ', 'A'].includes(line[16])) continue;
      const chain = line[21], key = `${chain}.${model}`;
      if (!names.has(chain)) continue;
      const residue = Number(line.slice(22, 26)), point = [30, 38, 46].map(i => Number(line.slice(i, i + 8)));
      if (!chains.has(key)) chains.set(key, { id: key, authChain: chain, name: names.get(chain), segments: [], residues: [], residueNames: [] });
      const item = chains.get(key), previous = item.residues.at(-1), lastPoint = item.segments.at(-1)?.at(-1);
      if (previous === residue) continue;
      if (!lastPoint || residue !== previous + 1 || Math.hypot(...point.map((n, i) => n - lastPoint[i])) > 5) item.segments.push([]);
      item.segments.at(-1).push(point.map(n => Math.round(n * 100) / 100)); item.residues.push(residue); item.residueNames.push(line.slice(17,20).trim());
    }
    const result = { version: 1, pdb, title, source, sourcePage: `https://www.rcsb.org/structure/${pdb}`, license: 'CC0 — wwPDB coordinates', representation: 'Experimental C-alpha backbone trace, biological assembly 1. Selected channel protein entities. Missing residues remain gaps. Coordinate axes are deposited axes, not assumed membrane orientation.', method: entry.exptl?.[0]?.method, resolution: entry.rcsb_entry_info?.resolution_combined?.[0], citation: entry.rcsb_primary_citation ? { title: entry.rcsb_primary_citation.title, doi: entry.rcsb_primary_citation.pdbx_database_id_PubMed ? `https://pubmed.ncbi.nlm.nih.gov/${entry.rcsb_primary_citation.pdbx_database_id_PubMed}/` : undefined, year: entry.rcsb_primary_citation.year } : undefined, chains: [...chains.values()] };
    if (!result.chains.length) throw new Error('No CA coordinates parsed');
    await fs.writeFile(path.join(out, `micro-${id}.json`), JSON.stringify(result));
    console.log(`${pdb} ${id}: ${result.chains.map(c => `${c.id}:${c.residues.length}`).join(' ')}`);
  } catch (error) { console.error(`${id}: ${error.message}`); process.exitCode = 1; }
}
