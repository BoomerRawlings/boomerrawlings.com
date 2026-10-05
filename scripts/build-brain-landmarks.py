"""Derive four annotated CSF landmarks from the original Allen reference volume.

python scripts/build-brain-landmarks.py --cache ../brain-assets/source
Requires numpy, nibabel, scipy, scikit-image, trimesh and pymeshlab.
"""
from pathlib import Path
import argparse, csv, hashlib, json, sys
parser=argparse.ArgumentParser()
parser.add_argument('--cache',type=Path,required=True)
parser.add_argument('--packages',type=Path)
args=parser.parse_args()
if args.packages: sys.path.insert(0,str(args.packages))
import numpy as np
import nibabel as nib
from scipy.ndimage import gaussian_filter
from skimage.measure import marching_cubes
import trimesh,pymeshlab
root=Path(__file__).resolve().parents[1]
volume=args.cache/'annotation_full.nii.gz'; ontology=args.cache/'voxel_count.csv'
img=nib.load(volume); assert nib.aff2axcodes(img.affine)==('R','A','S')
data=np.asarray(img.dataobj,dtype=np.uint32)
rows={int(row['id']):row for row in csv.DictReader(ontology.open(encoding='utf8'))}
atlas=json.loads((root/'public/brain/models/atlas.json').read_text(encoding='utf8'))
center=np.array(atlas['metadata']['coordinates']['centerSourceRAS'])
meshes=[]
for id,label,topics in [
 ('third-ventricle',10602,['thalamus','hypothalamus','dorsal-column']),
 ('inferior-ventricular-horn',10600,['hippocampus','amygdala']),
 ('cerebral-aqueduct',12369,['brainstem']),
 ('fourth-ventricle',12805,['brainstem','cerebellum']),
]:
 row=rows[label]; assert row['annotated']=='True'
 mask=data==label; voxels=np.argwhere(mask)
 low=np.maximum(voxels.min(0)-2,0); high=np.minimum(voxels.max(0)+3,data.shape)
 crop=np.pad(mask[tuple(slice(int(a),int(b)) for a,b in zip(low,high))].astype(np.float32),1)
 vertices,faces,_,_=marching_cubes(gaussian_filter(crop,.45),.5,allow_degenerate=False)
 ras=nib.affines.apply_affine(img.affine,vertices+low-1)-center
 mesh=trimesh.Trimesh(vertices=ras[:,[0,2,1]],faces=faces[:,::-1],process=True)
 if len(mesh.faces)>1000:
  ms=pymeshlab.MeshSet();ms.add_mesh(pymeshlab.Mesh(vertex_matrix=np.asarray(mesh.vertices),face_matrix=np.asarray(mesh.faces,dtype=np.int32)))
  ms.meshing_decimation_quadric_edge_collapse(targetfacenum=1000,preservetopology=True,preservenormal=True,optimalplacement=False)
  m=ms.current_mesh();mesh=trimesh.Trimesh(vertices=m.vertex_matrix(),faces=m.face_matrix(),process=False)
 mesh.fix_normals(multibody=True);assert mesh.is_watertight
 p=np.round(mesh.vertices,3)
 meshes.append(dict(id=id,name=row['name'][0].upper()+row['name'][1:],kind='csf-space',hemisphere='midline' if id!='inferior-ventricular-horn' else 'bilateral',topicIds=topics,atlasStructureIds=[label],sourceLabelName=row['name'],sourceVoxelCount=len(voxels),positions=p.reshape(-1).tolist(),indices=mesh.faces.astype(int).reshape(-1).tolist(),bounds=[p.min(0).tolist(),p.max(0).tolist()],quality=dict(watertight=True,triangles=len(mesh.faces))))
metadata={**atlas['metadata'],'name':'Allen 2020 ventricular recognition landmarks','derivation':'Individually annotated native 0.5 mm CSF labels; 0.45-voxel Gaussian smoothing, marching cubes, topology-preserving decimation targeting 1000 triangles while retaining original vertices, source-coordinate permutation and 0.001 mm rounding. No region translations, mirroring or invented labels.','limitations':'Surfaces bound atlas-labeled cerebrospinal-fluid spaces, not solid neural tissue. Narrow structures are smoothed source approximations. Optic chiasm and unannotated landmarks are not fabricated.'}
metadata.pop('cerebellarExterior',None)
metadata['sha256']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [volume,ontology]}
out=root/'public/brain/models/atlas-landmarks.json';out.write_text(json.dumps(dict(version=1,metadata=metadata,meshes=meshes),separators=(',',':')),encoding='utf8')
print(f'{len(meshes)} native-coordinate ventricular landmarks; {out.stat().st_size:,} bytes')
