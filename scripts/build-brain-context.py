"""Source-matched MRI reference planes for HCP1065 streamline recognition.

python scripts/build-brain-context.py --cache ../brain-assets/source
Requires numpy and nibabel; --packages accepts a local dependency directory.
The official 2009a asymmetric archive is downloaded only when absent.
No nonlinear registration, surface invention or streamline movement is applied.
"""
from pathlib import Path
import argparse, hashlib, json, sys, urllib.request, zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--cache', type=Path, required=True)
parser.add_argument('--packages', type=Path)
args = parser.parse_args()
if args.packages: sys.path.insert(0, str(args.packages))
import nibabel as nib
import numpy as np

root = Path(__file__).resolve().parents[1]
source = 'https://www.bic.mni.mcgill.ca/~vfonov/icbm/2009/mni_icbm152_nlin_asym_09a_nifti.zip'
archive = args.cache / source.rsplit('/', 1)[-1]
args.cache.mkdir(parents=True, exist_ok=True)
if not archive.exists(): urllib.request.urlretrieve(source, archive)
base = 'mni_icbm152_nlin_asym_09a/mni_icbm152_t1_tal_nlin_asym_09a'
with zipfile.ZipFile(archive) as z:
    for suffix in ['.nii', '_mask.nii']:
        path = args.cache / (base.rsplit('/', 1)[-1] + suffix)
        path.write_bytes(z.read(base + suffix))
    copyright = z.read('COPYING').decode('utf8').strip()
image_path = args.cache / 'mni_icbm152_t1_tal_nlin_asym_09a.nii'
mask_path = args.cache / 'mni_icbm152_t1_tal_nlin_asym_09a_mask.nii'
image, mask = nib.load(image_path), nib.load(mask_path)
assert nib.aff2axcodes(image.affine) == ('R', 'A', 'S')
assert np.allclose(image.affine, mask.affine)
data = np.asarray(image.dataobj)
brain = np.asarray(mask.dataobj) > 0
center = np.array([0, -16, 5.5])
planes = []
# Anatomical RAS levels, not display translations. Sampling every second native
# voxel gives 2 mm reference pixels; the original atlas geometry remains intact.
for name, fixed_axis, level in [('sagittal', 0, 0), ('coronal', 1, -16), ('axial', 2, 0)]:
    fixed_index = int(round((level - image.affine[fixed_axis, 3]) / image.affine[fixed_axis, fixed_axis]))
    axes = [i for i in range(3) if i != fixed_axis]
    sampled = [np.arange(0, data.shape[i], 2) for i in axes]
    positions, shades, valid = [], [], []
    # Row order remains explicit; positions derive from the source affine.
    for second in sampled[1]:
        for first in sampled[0]:
            voxel = np.zeros(3, dtype=int)
            voxel[fixed_axis] = fixed_index
            voxel[axes] = [first, second]
            ras = nib.affines.apply_affine(image.affine, voxel) - center
            positions.extend(np.round(ras[[0, 2, 1]], 3).tolist())
            valid.append(bool(brain[tuple(voxel)]))
            shades.append(int(np.clip(data[tuple(voxel)] / 100 * 255, 0, 255)))
    columns, rows = len(sampled[0]), len(sampled[1])
    indices = []
    for row in range(rows - 1):
        for col in range(columns - 1):
            a = row * columns + col; b = a + 1; c = a + columns; d = c + 1
            # Keep only fully brain-masked triangles: no scalp/skull pseudo-surface.
            for triangle in [(a, b, c), (b, d, c)]:
                if all(valid[i] for i in triangle): indices.extend(triangle)
    used = sorted(set(indices)); remap = {old: new for new, old in enumerate(used)}
    pts = np.asarray(positions).reshape(-1, 3)[used]
    planes.append(dict(id=name, sourceAxis='RAS'[fixed_axis], sourceLevelMm=level,
        sourceVoxelIndex=fixed_index, positions=pts.reshape(-1).tolist(),
        indices=[remap[i] for i in indices], intensities=[shades[i] for i in used],
        bounds=[pts.min(0).tolist(), pts.max(0).tolist()]))
metadata = dict(name='ICBM 2009a Nonlinear Asymmetric T1 reference planes',
    source=source, sourcePage='https://www.bic.mni.mcgill.ca/ServicesAtlases/ICBM152NLin2009',
    template='ICBM 2009a Nonlinear Asymmetric', copyright=copyright,
    citation='Fonov et al. (2009, 2011), ICBM152 nonlinear average templates. McConnell Brain Imaging Centre, McGill University.',
    sourceAffine=image.affine.tolist(), sourceShape=list(image.shape),
    coordinates=dict(units='mm', x='right', y='superior', z='anterior', centerSourceRAS=center.tolist()),
    samplingMm=2, intensityWindow=[0,100],
    derivation='Native source-affine T1 planes at RAS x=0, y=-16, z=0 mm; deterministic 2 mm sampling. Brain mask restricts displayed triangles; T1 0–100 intensities map linearly to 8-bit grayscale. No spatial warp or arbitrary relocation. Scene renderer uniformly scales source coordinates.',
    limitations='An averaged MRI template and reference section, not an individual subject, cortical surface, histology or a measured streamline boundary. HCP1065 streamlines share this named template space but remain population estimates.',
    sha256={p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in [archive,image_path,mask_path]})
out = root / 'public/brain/models/tracts/reference-mri.json'
out.write_text(json.dumps(dict(version=1,metadata=metadata,planes=planes),separators=(',',':')),encoding='utf8')
print(f'Wrote {out.name}: {len(planes)} source planes; {out.stat().st_size:,} bytes')
