"""Build textbook depictions from PubChem SDF; explicit acquisition, never a site-build dependency.

Requires RDKit. Existing eight 3D conformers are not changed. Met-enkephalin gets
one reproducible computed conformer from its stereochemically defined graph.
"""
import argparse, hashlib, json, sys, time, urllib.request
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--python-packages', type=Path)
args = parser.parse_args()
if args.python_packages:
    sys.path.insert(0, str(args.python_packages.resolve()))
from rdkit import Chem, rdBase
from rdkit.Chem import AllChem, rdDepictor, rdMolDescriptors
from rdkit.Chem.Draw import rdMolDraw2D

root = Path(__file__).resolve().parents[2]
out = root / 'public/brain/reference/molecules'
out.mkdir(parents=True, exist_ok=True)
original = json.loads((root / 'public/brain/models/micro-molecules.json').read_text())['molecules']
compounds = [(name, data['cid'], data['name']) for name, data in original.items()]
compounds.append(('neuropeptides', 443363, 'Met-enkephalin'))
manifest = {'version': 1, 'generator': 'RDKit ' + rdBase.rdkitVersion, 'molecules': {}}
for topic, cid, name in compounds:
    source = f'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/SDF?record_type=2d'
    if topic == 'neuropeptides':
        source = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/Met-enkephalin/SDF'
    sdf_path = out / f'{topic}.sdf'
    if not sdf_path.exists():
        with urllib.request.urlopen(source, timeout=45) as response:
            sdf_path.write_bytes(response.read())
        time.sleep(.3)
    sdf = sdf_path.read_text()
    mol = Chem.MolFromMolBlock(sdf.split('$$$$')[0], removeHs=True)
    assert mol is not None, f'{topic}: invalid source graph'
    Chem.AssignStereochemistry(mol, cleanIt=True, force=True)
    # Recompute only planar layout. Atom graph, charges and stereochemistry remain unchanged.
    rdDepictor.Compute2DCoords(mol, canonOrient=True)
    width, height = (900, 380) if topic == 'neuropeptides' else (640, 300)
    drawer = rdMolDraw2D.MolDraw2DSVG(width, height)
    options = drawer.drawOptions()
    options.padding = .16
    options.bondLineWidth = 2.5
    options.minFontSize = 18
    options.maxFontSize = 32
    options.addStereoAnnotation = True
    options.setBackgroundColour((.97, .98, .965))
    options.updateAtomPalette({6:(.16,.19,.2),7:(.08,.23,.8),8:(.78,.08,.08),16:(.65,.43,.02)})
    rdMolDraw2D.PrepareAndDrawMolecule(drawer, mol)
    drawer.FinishDrawing()
    (out / f'{topic}.svg').write_text(drawer.GetDrawingText(), encoding='utf-8')
    entry = {'cid':cid,'name':name,'image':f'/brain/reference/molecules/{topic}.svg',
             'formula':rdMolDescriptors.CalcMolFormula(mol),'smiles':Chem.MolToSmiles(mol),
             'source':source,'sourcePage':f'https://pubchem.ncbi.nlm.nih.gov/compound/{cid}',
             'sourceSha256':hashlib.sha256(sdf_path.read_bytes()).hexdigest(),
             'formalCharge':Chem.GetFormalCharge(mol),'heavyAtoms':mol.GetNumHeavyAtoms(),
             'stereocenters':Chem.FindMolChiralCenters(mol, includeUnassigned=True),
             'representation':'Skeletal formula from the PubChem reference compound; charge/protonation is the source record, not a physiological-pH prediction.'}
    manifest['molecules'][topic] = entry
    if topic == 'neuropeptides':
        conformer = Chem.AddHs(mol)
        params = AllChem.ETKDGv3(); params.randomSeed = 443363
        assert AllChem.EmbedMolecule(conformer, params) == 0, 'Peptide embedding failed'
        optimization = AllChem.MMFFOptimizeMolecule(conformer, maxIters=1200)
        coords = conformer.GetConformer()
        record = {'cid':cid,'name':'Met-enkephalin · Tyr–Gly–Gly–Phe–Met',
                  'source':source,'sourcePage':entry['sourcePage'],
                  'representation':'One RDKit ETKDGv3/MMFF computed conformer, seed443363. Not a measured peptide fold or receptor-bound conformation.',
                  'optimizationStatus':optimization,'smiles':entry['smiles'],
                  'atoms':[{'id':a.GetIdx()+1,'element':a.GetAtomicNum(),'charge':a.GetFormalCharge(),
                            'position':[round(v,5) for v in coords.GetAtomPosition(a.GetIdx())]} for a in conformer.GetAtoms()],
                  'bonds':[]}
        Chem.Kekulize(conformer, clearAromaticFlags=True)
        record['bonds']=[[b.GetBeginAtomIdx()+1,b.GetEndAtomIdx()+1,int(b.GetBondTypeAsDouble())] for b in conformer.GetBonds()]
        (root / 'public/brain/models/micro-peptide.json').write_text(json.dumps(record,separators=(',',':')),encoding='utf-8')
    print(topic, entry['formula'], entry['stereocenters'])
(out / 'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
(root / 'public/brain/chemistry.js').write_text('export const chemistry = '+json.dumps(manifest['molecules'],ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
