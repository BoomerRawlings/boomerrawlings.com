"""Derive named human atlas regions; never fabricate unannotated nuclei/subfields.

python scripts/build-brain-regions.py --cache ../brain-assets/source
Requires numpy, nibabel, scipy, scikit-image, trimesh, pymeshlab.
Use --packages for an existing local dependency directory if needed.
"""
from pathlib import Path
import argparse, csv, hashlib, json, sys

parser = argparse.ArgumentParser()
parser.add_argument('--cache', type=Path, required=True)
parser.add_argument('--packages', type=Path)
args = parser.parse_args()
if args.packages: sys.path.insert(0, str(args.packages))
import nibabel as nib
import numpy as np
from scipy.ndimage import gaussian_filter
from skimage.measure import marching_cubes
import trimesh, pymeshlab

root = Path(__file__).resolve().parents[1]
out = root / 'public/brain/models/atlas-details.json'
atlas = json.loads((out.parent / 'atlas.json').read_text(encoding='utf8'))
volume_path = args.cache / 'annotation_full.nii.gz'
ontology_path = args.cache / 'voxel_count.csv'
rows = list(csv.DictReader(ontology_path.open(encoding='utf8')))
ontology = {int(row['id']): row for row in rows}
img = nib.load(volume_path)
assert nib.aff2axcodes(img.affine) == ('R','A','S')
data = np.asarray(img.dataobj, dtype=np.uint32)
center = np.array(atlas['metadata']['coordinates']['centerSourceRAS'])

# Each tuple explicitly names an annotated source label. There are deliberately
# no CA1/CA3/DG, TRN, spinal gray-horn or pituitary shapes: this atlas has none.
# Topic memberships describe regional anatomy, never an inferred synaptic edge.
groups = [
 ('hippocampus', [('hippocampal-head',12171),('hippocampal-body',12173),('hippocampal-tail',12174)]),
 ('amygdala', [('amygdala-central',10363),('amygdala-lateral',10367),('amygdala-basolateral',10368),('amygdala-basomedial',10369),('amygdala-medial',10376),('amygdala-cortical-anterior',10374),('amygdala-cortical-posterior',10375)]),
 ('thalamus', [('thalamus-anterior',10392),('thalamus-mediodorsal',10398),('thalamus-pulvinar',10409),('thalamus-va',10417),('thalamus-vl',10420),('thalamus-vpl',10424),('thalamus-vpm',10425),('thalamus-lgn',10430),('thalamus-mgn',10434),('thalamus-centromedian',10449)]),
 ('hypothalamus', [('hypothalamus-preoptic',10468),('hypothalamus-supraoptic-region',10473),('hypothalamus-tuberal',10483),('hypothalamus-mammillary',10495)]),
 ('brainstem', [('midbrain-tegmentum',12195),('red-nucleus',12247),('substantia-nigra',12251),('superior-colliculus',12292),('inferior-colliculus',12305),('cerebral-peduncle',12330),('pons-basilar',12405),('pons-tegmentum',12416),('medulla-pyramidal',12535),('medulla-tegmentum',12538),('inferior-olive',12600)]),
 ('cerebellum', [('cerebellar-vermis',10658),('cerebellar-paravermis',12384),('cerebellar-hemisphere',12390),('cerebellar-deep-nuclei',10660)]),
 ('cerebral-cortex', [('precentral-gyrus',12114),('postcentral-gyrus',12132),('superior-frontal-gyrus',12115),('supramarginal-gyrus',12135),('angular-gyrus',12136),('superior-temporal-gyrus',12140),('heschl-gyrus',12144),('cuneus',12150),('lingual-gyrus',12151),('parahippocampal-anterior',12163),('parahippocampal-posterior',12164)]),
 ('white-matter', [('anterior-commissure',10559),('mammillothalamic-tract',10586),('optic-tract',10589),('optic-radiation-volume',266441621)]),
]
extra_topics = {
 'thalamus-vpl':['dorsal-column'], 'thalamus-lgn':['optic-radiation'],
 'precentral-gyrus':['corticospinal'], 'postcentral-gyrus':['dorsal-column'],
 'medulla-pyramidal':['corticospinal'], 'cerebral-peduncle':['corticospinal'],
 'cuneus':['optic-radiation'], 'lingual-gyrus':['optic-radiation'],
 'optic-radiation-volume':['optic-radiation'],
}
meshes=[]
source_x = np.arange(data.shape[0]) * img.affine[0,0] + img.affine[0,3]
for topic, definitions in groups:
 for mid, label in definitions:
  row=ontology[label]
  assert row['annotated']=='True', f'{mid}: unannotated source label'
  mask=data==label
  for hemisphere in ['left','right']:
   part=mask.copy()
   part[source_x>=0 if hemisphere=='left' else source_x<0,:,:]=False
   points=np.argwhere(part)
   if not len(points): continue
   low=np.maximum(points.min(0)-2,0); high=np.minimum(points.max(0)+3,data.shape)
   crop=np.pad(part[tuple(slice(int(a),int(b)) for a,b in zip(low,high))].astype(np.float32),1)
   verts, faces, _, _=marching_cubes(gaussian_filter(crop,.55),.5,allow_degenerate=False)
   ras=nib.affines.apply_affine(img.affine,verts+low-1)-center
   mesh=trimesh.Trimesh(vertices=ras[:,[0,2,1]],faces=faces[:,::-1],process=True)
   parts=mesh.split(only_watertight=False)
   largest=max(p.area for p in parts)
   mesh=trimesh.util.concatenate([p for p in parts if p.area>=largest*.003])
   budget=1200 if topic in ['cerebral-cortex','cerebellum'] else 700
   if len(mesh.faces)>budget:
    ms=pymeshlab.MeshSet(); ms.add_mesh(pymeshlab.Mesh(vertex_matrix=np.asarray(mesh.vertices),face_matrix=np.asarray(mesh.faces,dtype=np.int32)))
    ms.meshing_decimation_quadric_edge_collapse(targetfacenum=budget,preservetopology=True,preservenormal=True,optimalplacement=False)
    reduced=ms.current_mesh(); mesh=trimesh.Trimesh(vertices=reduced.vertex_matrix(),faces=reduced.face_matrix(),process=False)
   mesh.fix_normals(multibody=True)
   assert mesh.is_watertight,mid
   positions=np.round(mesh.vertices,3)
   meshes.append(dict(id=mid+'-'+hemisphere,regionId=mid,name=row['name'][0].upper()+row['name'][1:]+' · '+hemisphere,kind='atlas-region',hemisphere=hemisphere,topicIds=[topic]+extra_topics.get(mid,[]),atlasStructureIds=[label],sourceLabelName=row['name'],sourceVoxelCount=len(points),positions=positions.reshape(-1).tolist(),indices=mesh.faces.astype(int).reshape(-1).tolist(),bounds=[positions.min(0).tolist(),positions.max(0).tolist()],centroid=(nib.affines.apply_affine(img.affine,points.mean(0))-center)[[0,2,1]].round(3).tolist(),quality={'watertight':True,'triangles':len(mesh.faces)}))
  print(mid,flush=True)
metadata={**atlas['metadata'],'name':'Allen 2020 named regional parcellations','derivation':'Individually annotated labels only, native 0.5 mm grid; split at anatomical RAS x=0; marching cubes after 0.55-voxel Gaussian smoothing. Disconnected components with surface area below 0.3% of the largest component are removed. Topology-preserving decimation retains original marching-cube vertices, targeting 1200 triangles for cerebral-cortex/cerebellum regions and 700 for other regions; topology preservation may retain more triangles. Coordinates rounded to 0.001 mm. Same world coordinates as atlas.json. No synthetic gross shapes, inferred subfields or graph-node substitutes.','limitations':'The source delineates gross reference regions on averaged MRI, not individual histology. Source supraoptic REGION is not the supraoptic nucleus. Hippocampal head/body/tail are longitudinal regions, not CA or dentate subfields. Cerebellar deep nuclei are a grouped label, not separately measured dentate/interposed/fastigial nuclei. Regional views omit unannotated or unsupplied regions; colors do not define cellular borders. Source tract volumes are parcellations, not reconstructed axons.','sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [volume_path,ontology_path]}}
# This asset contains source regional labels, not the base atlas exterior.
metadata.pop('cerebellarExterior', None)
out.write_text(json.dumps({'version':1,'metadata':metadata,'meshes':meshes},separators=(',',':'),ensure_ascii=False),encoding='utf8')
print(f'Wrote {len(meshes)} meshes, {out.stat().st_size:,} bytes',flush=True)
