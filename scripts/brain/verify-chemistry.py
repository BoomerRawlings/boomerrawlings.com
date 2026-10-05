"""Offline independent graph/stereochemistry check of browser molecules vs cached PubChem SDF.

Requires RDKit; optional --python-packages points to a registry-installed package directory.
Does not fetch, regenerate, or alter assets. 3D handedness is inferred from actual coordinates.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--python-packages', type=Path)
args = parser.parse_args()
if args.python_packages:
    sys.path.insert(0, str(args.python_packages.resolve()))
from rdkit import Chem
from rdkit.Chem import rdMolDescriptors
from rdkit.Geometry import Point3D

root = Path(__file__).resolve().parents[2]
reference_dir = root / 'public/brain/reference/molecules'
manifest = json.loads((reference_dir / 'manifest.json').read_text())['molecules']
records = json.loads((root / 'public/brain/models/micro-molecules.json').read_text())['molecules']
records['neuropeptides'] = json.loads((root / 'public/brain/models/micro-peptide.json').read_text())
expected = {'glutamate': ('C5H9NO4', 0, ['S']), 'gaba': ('C4H9NO2', 0, []),
            'dopamine': ('C8H11NO2', 0, []), 'serotonin': ('C10H12N2O', 0, []),
            'acetylcholine': ('C7H16NO2+', 1, []), 'norepinephrine': ('C8H11NO3', 0, ['R']),
            'glycine': ('C2H5NO2', 0, []), 'histamine': ('C5H9N3', 0, []),
            'neuropeptides': ('C27H35N5O7S', 0, ['S', 'S', 'S'])}
assert set(records) == set(expected) == set(manifest), 'Exactly nine browser/reference molecular graphs required'

for name, record in records.items():
    entry = manifest[name]
    assert record['cid'] == entry['cid'], f'{name}: source compound ID mismatch'
    sdf_bytes = (reference_dir / f'{name}.sdf').read_bytes()
    assert hashlib.sha256(sdf_bytes).hexdigest() == entry['sourceSha256'], f'{name}: cached source hash mismatch'
    reference = Chem.MolFromMolBlock(sdf_bytes.decode().split('$$$$')[0], removeHs=True)
    assert reference is not None, f'{name}: invalid reference SDF'
    Chem.AssignStereochemistry(reference, cleanIt=True, force=True)

    builder = Chem.RWMol()
    index = {}
    for atom in record['atoms']:
        assert atom['id'] not in index, f'{name}: duplicate atom ID'
        assert isinstance(atom['charge'], int), f'{name}: nonintegral formal charge'
        assert len(atom['position']) == 3 and all(math.isfinite(v) for v in atom['position']), f'{name}: invalid 3D coordinate'
        a = Chem.Atom(atom['element'])
        a.SetFormalCharge(atom['charge'])
        a.SetNoImplicit(True)
        index[atom['id']] = builder.AddAtom(a)
    seen = set()
    for a, b, order in record['bonds']:
        assert a in index and b in index and a != b and order in (1, 2, 3), f'{name}: invalid bond'
        key = tuple(sorted((a, b)))
        assert key not in seen, f'{name}: duplicate bond'
        seen.add(key)
        builder.AddBond(index[a], index[b], {1: Chem.BondType.SINGLE, 2: Chem.BondType.DOUBLE, 3: Chem.BondType.TRIPLE}[order])
        positions = {a['id']: a['position'] for a in record['atoms']}
        distance = math.dist(positions[a], positions[b])
        assert .65 < distance < 2.15, f'{name}: bonded atoms separated by {distance:.4f} Å'
    molecule = builder.GetMol()
    Chem.SanitizeMol(molecule)
    assert len(Chem.GetMolFrags(molecule)) == 1, f'{name}: disconnected graph'
    conformer = Chem.Conformer(molecule.GetNumAtoms())
    conformer.Set3D(True)
    for atom in record['atoms']:
        conformer.SetAtomPosition(index[atom['id']], Point3D(*atom['position']))
    molecule.AddConformer(conformer)
    Chem.AssignAtomChiralTagsFromStructure(molecule, confId=0, replaceExistingTags=True)
    Chem.AssignStereochemistry(molecule, cleanIt=True, force=True)
    heavy = Chem.RemoveHs(molecule)
    Chem.AssignStereochemistry(heavy, cleanIt=True, force=True)

    formula, charge, cip = expected[name]
    assert rdMolDescriptors.CalcMolFormula(molecule) == rdMolDescriptors.CalcMolFormula(reference) == entry['formula'] == formula, f'{name}: formula mismatch'
    assert Chem.GetFormalCharge(molecule) == Chem.GetFormalCharge(reference) == entry['formalCharge'] == charge, f'{name}: charge mismatch'
    assert heavy.GetNumAtoms() == reference.GetNumAtoms() == entry['heavyAtoms'], f'{name}: heavy atom count mismatch'
    assert Chem.MolToSmiles(heavy, isomericSmiles=False) == Chem.MolToSmiles(reference, isomericSmiles=False), f'{name}: connectivity/bond-order mismatch'
    assert Chem.MolToSmiles(heavy, isomericSmiles=True) == Chem.MolToSmiles(reference, isomericSmiles=True) == entry['smiles'], f'{name}: 3D handedness differs from source stereochemical graph'
    chiral = Chem.FindMolChiralCenters(heavy, includeUnassigned=True)
    assert sorted(tag for _, tag in chiral) == sorted(cip), f'{name}: wrong or undefined CIP stereocenter'
    assert heavy.HasSubstructMatch(reference, useChirality=True) and reference.HasSubstructMatch(heavy, useChirality=True), f'{name}: bidirectional stereochemical graph mapping failed'
    print(f'{name}: {formula}; charge {charge:+d}; {len(record["atoms"])} explicit atoms; CIP {",".join(cip) or "none"}; graph + 3D handedness match PubChem SDF')

print('Chemistry verification passed: all nine graphs, formulas, formal charges, source hashes, bonded distances, and coordinate-derived stereochemistry.')
