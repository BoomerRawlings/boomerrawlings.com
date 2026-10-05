"""Deterministic asset seam for broken exported closed anatomical surfaces.

Requires numpy and trimesh. Reports boundary/nonmanifold edges and components.
The --require-closed check is red on the original cortex meshes.
"""
import argparse
import json
from pathlib import Path
import numpy as np
import trimesh

parser = argparse.ArgumentParser()
parser.add_argument('--atlas', type=Path, default=Path('public/brain/models/atlas.json'))
parser.add_argument('--require-closed', action='store_true')
args = parser.parse_args()
atlas = json.loads(args.atlas.read_text(encoding='utf8'))
failed = []
for item in atlas['meshes']:
    if item['kind'] not in ('cortex', 'shell', 'cerebellum'):
        continue
    mesh = trimesh.Trimesh(vertices=np.array(item['positions']).reshape(-1, 3), faces=np.array(item['indices']).reshape(-1, 3), process=False)
    edge_count = np.bincount(mesh.edges_unique_inverse)
    boundary = int((edge_count == 1).sum())
    nonmanifold = int((edge_count > 2).sum())
    components = mesh.split(only_watertight=False)
    largest_fraction = max((c.area for c in components), default=0) / mesh.area
    print(f"{item['id']}: boundary_edges={boundary} nonmanifold_edges={nonmanifold} components={len(components)} largest_area_fraction={largest_fraction:.5f} closed={mesh.is_watertight}")
    if boundary or nonmanifold or (item['kind'] in ('shell', 'cerebellum') and len(components) != 1):
        failed.append(item['id'])
if args.require_closed and failed:
    raise SystemExit('FAIL: exported anatomical exteriors have broken edges or disconnected surface pockets: ' + ', '.join(failed))
