"""Build attributed browser geometry from Allen atlas labels and PDB coordinates.

Requires numpy, nibabel, scipy, scikit-image, trimesh, pymeshlab.
Usage: python build_models.py --cache ./source --out ../site/public/brain/models
Source files are cached locally; only derived JSON and provenance enter the site.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path
import shlex
import sys
import urllib.request

HERE = Path(__file__).resolve().parent
if (HERE / "python-packages").is_dir():
    sys.path.insert(0, str(HERE / "python-packages"))

import nibabel as nib
import numpy as np
from scipy.ndimage import gaussian_filter, binary_fill_holes, label as component_labels
from scipy.spatial import cKDTree
from skimage.measure import marching_cubes
import trimesh
import pymeshlab

ATLAS_BASE = "https://download.alleninstitute.org/informatics-archive/allen_human_reference_atlas_3d_2020/version_1/"
ATLAS_URL = ATLAS_BASE + "annotation_full.nii.gz"
ONTOLOGY_URL = ATLAS_BASE + "examples/voxel_count/voxel_count.csv"
PDB_URL = "https://files.rcsb.org/download/6D6T.cif"


def cached(path: Path, url: str) -> Path:
    if not path.exists():
        print("Download", path.name, flush=True)
        urllib.request.urlretrieve(url, path)
    return path


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")


def atlas(cache: Path, out: Path, only: set[str] | None = None) -> dict:
    source = cached(cache / "annotation_full.nii.gz", ATLAS_URL)
    ontology = cached(cache / "voxel_count.csv", ONTOLOGY_URL)
    with ontology.open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    img = nib.load(source)
    assert nib.aff2axcodes(img.affine) == ("R", "A", "S"), "Unexpected atlas orientation"
    data = np.asarray(img.dataobj, dtype=np.uint32)
    # Native 0.5 mm for continuous hemispheres; 1 mm for internal parcellations.
    sampled = data[::2, ::2, ::2]
    affine = img.affine.copy()
    affine[:3, :3] *= 2
    occupied = np.argwhere(sampled != 0)
    source_bounds = nib.affines.apply_affine(affine, np.array([occupied.min(0), occupied.max(0)]))
    center_ras = source_bounds.mean(axis=0)
    # Stable registration frame across releases and the separately built HCP tracts.
    previous = out / 'atlas.json'
    previous_payload = None
    if previous.exists():
        previous_payload = json.loads(previous.read_text(encoding='utf8'))
        center_ras = np.array(previous_payload['metadata']['coordinates']['centerSourceRAS'])
    assert not only or previous_payload, 'Partial rebuild requires an existing atlas'
    full_ids = set(int(v) for v in np.unique(sampled) if v)
    structures = {int(row["id"]): row for row in rows}

    def labels(parent_ids: list[int]) -> list[int]:
        selected = []
        for row in rows:
            path = {int(v) for v in row["structure_id_path"].split("/") if v}
            rid = int(row["id"])
            if rid in full_ids and any(pid in path for pid in parent_ids):
                selected.append(rid)
        return selected

    # id, display name, Allen ancestors, type, target triangles, split hemispheres.
    definitions = [
        ("hemisphere", "Continuous cerebral surface", [10156], "shell", 30000, True),
        ("hippocampus", "Hippocampal formation", [12170], "internal", 1600, False),
        ("amygdala", "Amygdaloid complex", [10361], "internal", 1100, False),
        ("thalamus", "Thalamus", [10390], "internal", 1600, False),
        ("hypothalamus", "Hypothalamus", [10467], "internal", 900, False),
        ("caudate", "Caudate nucleus", [10334], "internal", 1500, False),
        ("putamen", "Putamen", [10338], "internal", 1300, False),
        ("globus-pallidus", "Globus pallidus", [10342], "internal", 1000, False),
        ("cerebellum", "Cerebellum", [10656], "cerebellum", 30000, False),
        ("midbrain", "Midbrain", [10648], "brainstem", 1500, False),
        ("pons", "Pons", [10661], "brainstem", 1500, False),
        ("medulla", "Medulla oblongata", [10662], "brainstem", 1200, False),
        ("corpus-callosum", "Corpus callosum", [10561], "white-matter", 1800, False),
        ("fornix", "Fornix", [10576], "white-matter", 900, False),
        ("cerebellar-peduncles", "Cerebellar peduncles", [12354, 12741, 12768], "white-matter", 1400, False),
        ("white-matter", "Forebrain white matter", [10557], "white-matter", 2800, True),
        ("ventricles", "Ventricles", [10595, 10651, 10669], "ventricle", 1800, False),
    ]
    region_definitions = [
        ('frontal', 'Frontal lobe', 12113), ('parietal', 'Parietal lobe', 12131),
        ('temporal', 'Temporal lobe', 12139), ('occipital', 'Occipital lobe', 12148),
        ('insula', 'Insular lobe', 12176), ('limbic', 'Limbic lobe', 12155),
    ]
    cortical_map = np.full(sampled.shape, -1, dtype=np.int8)
    for i, (_, _, parent) in enumerate(region_definitions):
        cortical_map[np.isin(sampled, labels([parent]))] = i
    cortical_voxels = np.argwhere(cortical_map >= 0)
    cortical_points = nib.affines.apply_affine(affine, cortical_voxels) - center_ras
    cortical_tree = cKDTree(cortical_points[:, [0, 2, 1]])
    cortical_regions = cortical_map[tuple(cortical_voxels.T)]
    meshes = []
    for mid, name, parents, kind, budget, split in definitions:
        if only and mid not in only:
            continue
        selected = labels(parents)
        assert selected, f"No atlas labels for {mid}"
        native = kind in ('shell', 'cerebellum')
        volume = data if native else sampled
        surface_affine = img.affine if native else affine
        source_x = np.arange(volume.shape[0]) * surface_affine[0, 0] + surface_affine[0, 3]
        mask = np.isin(volume, selected)
        assigned_white_voxels = 0
        if kind == 'cerebellum':
            # Allen's cerebellum ancestor belongs to the gray-matter branch.
            # Hindbrain white matter is separately labeled 10668 and also spans
            # the brainstem. Assign actual white voxels by nearest gray anatomy,
            # avoiding an arbitrary bounding box or inclusion of pons/medulla.
            competitors = labels([10649, 10661, 10662])
            gray_voxels = np.argwhere(np.isin(sampled, selected + competitors))
            gray_tree = cKDTree(gray_voxels.astype(float) * 2)
            white_voxels = np.argwhere(data == 10668)
            _, nearest = gray_tree.query(white_voxels)
            nearest_labels = sampled[tuple(gray_voxels[nearest].T)]
            cerebellar_white = white_voxels[np.isin(nearest_labels, selected)]
            mask[tuple(cerebellar_white.T)] = True
            assigned_white_voxels = len(cerebellar_white)
            selected = selected + [10668]
            print('cerebellum white-matter voxels assigned', assigned_white_voxels, flush=True)
        for hemisphere in (["left", "right"] if split else ["bilateral"]):
            part = mask.copy()
            if hemisphere == "left":
                part[source_x >= 0, :, :] = False
            elif hemisphere == "right":
                part[source_x < 0, :, :] = False
            if native:
                # Remove disconnected label islands; close only enclosed ventricular
                # cavities. Sulci connected to the exterior remain open and folded.
                components, count = component_labels(part)
                sizes = np.bincount(components.ravel()); sizes[0] = 0
                part = binary_fill_holes(components == sizes.argmax())
            coords = np.argwhere(part)
            assert len(coords), f"Empty {mid} {hemisphere}"
            low = np.maximum(coords.min(0) - 2, 0)
            high = np.minimum(coords.max(0) + 3, np.array(part.shape))
            crop = part[tuple(slice(int(a), int(b)) for a, b in zip(low, high))]
            crop = np.pad(crop.astype(np.float32), 1)
            field = gaussian_filter(crop, sigma=0.8 if native else 0.65)
            verts, faces, _, _ = marching_cubes(field, level=0.5, allow_degenerate=False)
            # Recover source RAS millimetres; transform R,A,S -> right,superior,anterior.
            verts += low - 1
            ras = nib.affines.apply_affine(surface_affine, verts) - center_ras
            verts = ras[:, [0, 2, 1]]
            faces = faces[:, ::-1]  # axis permutation reflects coordinates.
            mesh = trimesh.Trimesh(vertices=verts, faces=faces, process=True)
            # Marching-cube surfaces have voxel stair steps. Taubin smoothing avoids shrinkage.
            trimesh.smoothing.filter_taubin(mesh, lamb=0.5, nu=0.53, iterations=2)
            components = mesh.split(only_watertight=False)
            if native:
                # Gaussian interpolation can create tiny sealed pockets even after
                # binary cavity filling. Ship the continuous exterior alone.
                mesh = max(components, key=lambda component: component.area)
            else:
                maximum = max(component.area for component in components)
                mesh = trimesh.util.concatenate([component for component in components if component.area >= maximum * .005])
            if len(mesh.faces) > budget:
                decimator = pymeshlab.MeshSet()
                decimator.add_mesh(pymeshlab.Mesh(vertex_matrix=np.asarray(mesh.vertices), face_matrix=np.asarray(mesh.faces, dtype=np.int32)))
                decimator.meshing_decimation_quadric_edge_collapse(targetfacenum=budget, preservetopology=True, preservenormal=True, optimalplacement=kind != 'cerebellum')
                reduced = decimator.current_mesh()
                mesh = trimesh.Trimesh(vertices=reduced.vertex_matrix(), faces=reduced.face_matrix(), process=False)
            # Ensure every closed surface is outward-facing after conversion and decimation.
            mesh.fix_normals(multibody=True)
            positions = np.round(mesh.vertices, 2)
            indices = mesh.faces.astype(np.int32)
            assert np.isfinite(positions).all()
            assert indices.min() >= 0 and indices.max() < len(positions)
            mesh_id = mid + ("-" + hemisphere if split else "")
            payload = {
                "id": mesh_id, "name": name + (" · " + hemisphere if split else ""),
                "kind": kind, "hemisphere": hemisphere,
                "atlasStructureIds": parents + ([10668] if kind == 'cerebellum' else []), "atlasLabelIds": selected,
                "positions": positions.reshape(-1).tolist(), "indices": indices.reshape(-1).tolist(),
                "bounds": [positions.min(0).tolist(), positions.max(0).tolist()],
                "sourceLabelNames": [structures[p]["name"] for p in parents + ([10668] if kind == 'cerebellum' else [])],
            }
            edge_count = np.bincount(mesh.edges_unique_inverse)
            payload['quality'] = {'watertight': bool(mesh.is_watertight), 'boundaryEdges': int((edge_count == 1).sum()), 'nonmanifoldEdges': int((edge_count > 2).sum()), 'triangles': len(mesh.faces)}
            if kind == 'shell':
                assert mesh.is_watertight, f'{hemisphere}: decimation damaged continuous surface'
                centroids = mesh.triangles_center
                _, nearest = cortical_tree.query(centroids)
                payload['faceRegions'] = cortical_regions[nearest].astype(int).tolist()
                payload['regions'] = [{'id': rid + '-' + hemisphere, 'name': label_name + ' · ' + hemisphere, 'kind': 'cortex', 'atlasStructureIds': [parent]} for rid, label_name, parent in region_definitions]
            if kind == 'cerebellum':
                assert mesh.is_watertight, 'Cerebellar exterior damaged'
                payload['derivation'] = 'Native 0.5 mm cerebellar gray labels plus actual hindbrain white-matter voxels assigned to nearest cerebellar rather than brainstem gray anatomy; enclosed cavities filled, only continuous exterior retained; topology-preserving decimation uses original vertex positions.'
                payload['assignedWhiteMatterSourceVoxels'] = assigned_white_voxels
            meshes.append(payload)
            print(mesh_id, len(positions), "vertices", len(indices), "triangles", flush=True)
    metadata = {
        "name": "Allen Human Reference Atlas – 3D, 2020", "version": "1.0.0",
        "source": ATLAS_BASE, "volumeUrl": ATLAS_URL, "ontologyUrl": ONTOLOGY_URL,
        "license": "CC BY 4.0", "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
        "licenseEvidence": ATLAS_BASE + "README.pdf",
        "credit": "© 2019 Allen Institute for Brain Science. Ding, S.-L. et al. (2020), RRID:SCR_017764.",
        "citation": "Song-Lin Ding, Joshua J. Royall, Susan M. Sunkin, Benjamin A.C. Facer, Phil Lesnar, Amy Bernard, Lydia Ng, Ed S. Lein (2020). Allen Human Reference Atlas – 3D, 2020, version 1.0.0.",
        "coordinates": {"units": "mm", "x": "right", "y": "superior", "z": "anterior", "centerSourceRAS": center_ras.tolist(), "sourceAffine": img.affine.tolist(), "sourceAxisCodes": list(nib.aff2axcodes(img.affine))},
        "derivation": "Continuous hemispheres from native 0.5 mm forebrain labels including white matter; largest component; enclosed cavities filled; exterior-connected sulci preserved. Internal parcellations sampled at 1 mm. Light Gaussian/Taubin smoothing; topology-preserving quadric decimation. Lobe colors assign each exterior triangle to its nearest cortical atlas label; no cortical-ribbon interior walls are rendered.",
        "limitations": "Reference parcellations on an averaged MNI MRI, not individual cortical reconstruction. The continuous cerebral envelope approximates the pial exterior; nearest-label lobe colors are approximate boundaries. Enclosed ventricular cavities removed only from that envelope; ventricles have a separate mesh. Fine nuclear boundaries simplified; caudal medulla truncated by source. White-matter meshes are labeled volumes, not diffusion streamlines. Separate HCP tract assets have their own source and registration caveat.",
        "sha256": {"annotation_full.nii.gz": sha(source), "voxel_count.csv": sha(ontology)},
        "sourceShape": list(img.shape), "sourceSpacingMm": list(map(float, img.header.get_zooms()[:3])),
        "totalSourceLabeledVoxels": int(np.count_nonzero(data)),
    }
    metadata['cerebellarExterior'] = 'Native 0.5 mm gray-plus-white envelope. Allen hindbrain white-matter10668 is partitioned by nearest cerebellar versus brainstem gray anatomy. Fine folia are reference-label approximations, not an individual histological surface.'
    if only:
        replacements = {item['id']: item for item in meshes}
        meshes = [replacements.get(item['id'], item) for item in previous_payload['meshes']]
        previous_payload['metadata']['cerebellarExterior'] = metadata['cerebellarExterior']
        metadata = previous_payload['metadata']
    payload = {"version": 1, "metadata": metadata, "meshes": meshes}
    write_json(out / "atlas.json", payload)
    return metadata


def receptor(cache: Path, out: Path) -> dict:
    source = cached(cache / "6D6T.cif", PDB_URL)
    lines = source.read_text(encoding="utf-8").splitlines()
    fields = []
    atoms = []
    reading = False
    for line in lines:
        if line.startswith("_atom_site."):
            fields.append(line.split()[0].split(".", 1)[1])
            reading = True
            continue
        if reading and (line.startswith("ATOM ") or line.startswith("HETATM ")):
            values = shlex.split(line)
            assert len(values) == len(fields), "Unexpected atom-site row format"
            atoms.append(dict(zip(fields, values)))
        elif reading and line.strip() == "#" and atoms:
            break
    chain_names = {"A": "β2 subunit", "B": "α1 subunit", "C": "β2 subunit", "D": "α1 subunit", "E": "γ2 subunit"}
    chains = []
    all_points = []
    for cid, name in chain_names.items():
        selected = [a for a in atoms if a["group_PDB"] == "ATOM" and a["label_asym_id"] == cid and a["label_atom_id"] == "CA" and a["label_alt_id"] in (".", "A") and a["pdbx_PDB_model_num"] == "1"]
        assert selected, f"Missing receptor chain {cid}"
        points = [[round(float(a["Cartn_" + d]), 3) for d in "xyz"] for a in selected]
        seq = [int(a["label_seq_id"]) for a in selected]
        segments = []
        segment = []
        for i, p in enumerate(points):
            if segment and (seq[i] != seq[i - 1] + 1 or np.linalg.norm(np.array(p) - points[i - 1]) > 5.0):
                segments.append(segment)
                segment = []
            segment.append(p)
        if segment:
            segments.append(segment)
        chains.append({"id": cid, "name": name, "points": points, "segments": segments, "residueNumbers": [int(a["auth_seq_id"]) for a in selected], "residueNames": [a["label_comp_id"] for a in selected], "atom": "Cα", "organism": "Homo sapiens", "authChainId": selected[0]["auth_asym_id"]})
        all_points.extend(points)
    bounds = np.array(all_points)
    metadata = {
        "name": "GABA-A receptor α1β2γ2 · conformation B", "pdbId": "6D6T",
        "source": "https://www.rcsb.org/structure/6D6T", "coordinatesUrl": PDB_URL,
        "license": "CC0 1.0", "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "licenseEvidence": "https://www.rcsb.org/pages/policies",
        "citation": "Zhu S., Noviello C.M., Teng J., Walsh R.M., Kim J.J., Hibbs R.E. (2018). Structure of a human synaptic GABAA receptor. Nature 559, 67–72. https://doi.org/10.1038/s41586-018-0255-3",
        "method": "Cryo-electron microscopy", "resolutionAngstrom": 3.86,
        "units": "ångström", "coordinates": "Original deposited Cartesian coordinates; viewer may uniformly center and rotate.",
        "representation": "Alpha-carbon trace of receptor chains A–E; separate segments at residue gaps. Antibody chains, ligands, side chains and unresolved residues omitted.",
        "limitations": "Static experimentally determined conformation; not a gating animation, atomic surface, or complete chemical model. Membrane placement is illustrative unless separately sourced.",
        "sha256": sha(source), "bounds": [bounds.min(0).tolist(), bounds.max(0).tolist()],
        "alphaCarbonCount": len(all_points),
    }
    write_json(out / "gaba-a-6d6t.json", {"version": 1, "metadata": metadata, "chains": chains})
    print("receptor", len(all_points), "alpha carbons", flush=True)
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", type=Path, default=HERE / "source")
    parser.add_argument("--out", type=Path, default=HERE / "models")
    parser.add_argument('--only', help='Comma-separated atlas mesh families; preserve all other exported geometry')
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    args.out.mkdir(parents=True, exist_ok=True)
    atlas_metadata = atlas(args.cache, args.out, set(args.only.split(',')) if args.only else None)
    receptor_metadata = json.loads((args.out / 'gaba-a-6d6t.json').read_text(encoding='utf8'))['metadata'] if args.only else receptor(args.cache, args.out)
    models = [atlas_metadata, receptor_metadata]
    tract_manifest = args.out / 'tracts' / 'manifest.json'
    if tract_manifest.exists():
        models.append(json.loads(tract_manifest.read_text(encoding='utf8'))['metadata'])
    if (args.out / 'micro-credits.json').exists():
        models.append({'name': 'Cellular and molecular measured models', 'source': '/brain/models/micro-credits.json', 'representation': 'See linked per-asset provenance, licensing and schematic limitations.'})
    write_json(args.out / "credits.json", {"version": 1, "models": models})
    print("Output bytes", {p.name: p.stat().st_size for p in args.out.glob("*.json")}, flush=True)


if __name__ == "__main__":
    main()
