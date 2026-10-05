"""Derive rigid display rotations by matching deposited C-alpha atoms to OPM.

Acquisition only: requires NumPy; downloaded references stay outside public assets.
No protein coordinates, gaps or molecular conformation are changed.
"""
import argparse, hashlib, json, urllib.request
from pathlib import Path
import sys
parser=argparse.ArgumentParser()
parser.add_argument('--cache',type=Path,required=True)
parser.add_argument('--python-packages',type=Path)
args=parser.parse_args()
if args.python_packages: sys.path.insert(0,str(args.python_packages.resolve()))
import numpy as np
root=Path(__file__).resolve().parents[2]
args.cache.mkdir(parents=True,exist_ok=True)
entries={}
for name,pdb in [('micro-sodium','6J8J'),('micro-potassium','2R9R'),('micro-calcium','7MIY'),('micro-ampa','3KG2'),('micro-nmda','4PE5'),('gaba-a-6d6t','6D6T')]:
    source=f'https://opm-assets.storage.googleapis.com/pdb/{pdb.lower()}.pdb'
    file=args.cache/(pdb.lower()+'.pdb')
    if not file.exists():
        with urllib.request.urlopen(source,timeout=45) as response:file.write_bytes(response.read())
    text=file.read_text();atoms={}
    for line in text.splitlines():
        if line.startswith('ATOM  ') and line[12:16].strip()=='CA':
            atoms.setdefault((line[21],int(line[22:26])),[float(line[i:i+8]) for i in [30,38,46]])
    data=json.loads((root/'public/brain/models'/f'{name}.json').read_text());original=[];oriented=[]
    for chain in data['chains']:
        # One deposited assembly copy; the same rigid rotation then covers all copies.
        if '.' in chain['id'] and not chain['id'].endswith('.1'):continue
        for residue,point in zip(chain.get('residues',chain.get('residueNumbers')),sum(chain['segments'],[])):
            key=(chain['id'].split('.')[0],residue)
            if key in atoms:original.append(point);oriented.append(atoms[key])
    a=np.array(original);b=np.array(oriented);a-=a.mean(0);b-=b.mean(0)
    u,_,vt=np.linalg.svd(a.T@b);rotation=u@vt
    rmsd=float(np.sqrt(np.mean(np.sum((a@rotation-b)**2,axis=1))))
    assert len(a)>600 and rmsd<.02 and abs(np.linalg.det(rotation)-1)<1e-6,(pdb,rmsd)
    # OPM bilayer normal is Z; viewer vertical is Y. This is a proper rotation.
    viewer=rotation@np.array([[1,0,0],[0,0,-1],[0,1,0]])
    assert np.allclose(viewer.T@viewer,np.eye(3)) and np.linalg.det(viewer)>.99999
    entries[pdb]={'source':source,'sourcePage':'https://opm.phar.umich.edu/','sourceSha256':hashlib.sha256(file.read_bytes()).hexdigest(),
        'matchedAlphaCarbons':len(a),'rmsdAngstrom':round(rmsd,7),'rotation':viewer.T.round(12).reshape(-1).tolist(),
        'representation':'Rigid display orientation matched to OPM predicted membrane frame; no conformation change. OPM Z maps to viewer Y.'}
    print(pdb,len(a),'matched C-alpha atoms; RMSD',round(rmsd,6))
(root/'public/brain/models/protein-orientation.json').write_text(json.dumps({'version':1,'entries':entries},separators=(',',':')))
