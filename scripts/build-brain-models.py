"""Build attributed browser geometry from Allen atlas labels and PDB coordinates.

Requires numpy, nibabel, scipy, scikit-image, trimesh, fast-simplification.
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
from scipy.ndimage import gaussian_filter
from skimage.measure import marching_cubes
import trimesh

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


def atlas(cache: Path, out: Path) -> dict:
    source = cached(cache / "annotation_full.nii.gz", ATLAS_URL)
    ontology = cached(cache / "voxel_count.csv", ONTOLOGY_URL)
    with ontology.open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    img = nib.load(source)
    assert nib.aff2axcodes(img.affine) == ("R", "A", "S"), "Unexpected atlas orientation"
    data = np.asarray(img.dataobj, dtype=np.uint32)
    # 1 mm sampling, from the source's 0.5 mm grid. No warping or left/right flip.
    sampled = data[::2, ::2, ::2]
    affine = img.affine.copy()
    affine[:3, :3] *= 2
    occupied = np.argwhere(sampled != 0)
    source_bounds = nib.affines.apply_affine(affine, np.array([occupied.min(0), occupied.max(0)]))
    center_ras = source_bounds.mean(axis=0)
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
        ("hemisphere", "Cerebral hemisphere", [10156], "shell", 6000, True),
        ("frontal", "Frontal lobe", [12113], "cortex", 4800, True),
        ("parietal", "Parietal lobe", [12131], "cortex", 3600, True),
        ("temporal", "Temporal lobe", [12139], "cortex", 3600, True),
        ("occipital", "Occipital lobe", [12148], "cortex", 3000, True),
        ("insula", "Insular lobe", [12176], "cortex", 1300, True),
        ("limbic", "Limbic lobe", [12155], "cortex", 2200, True),
        ("hippocampus", "Hippocampal formation", [12170], "internal", 1600, False),
        ("amygdala", "Amygdaloid complex", [10361], "internal", 1100, False),
        ("thalamus", "Thalamus", [10390], "internal", 1600, False),
        ("hypothalamus", "Hypothalamus", [10467], "internal", 900, False),
        ("caudate", "Caudate nucleus", [10334], "internal", 1500, False),
        ("putamen", "Putamen", [10338], "internal", 1300, False),
        ("globus-pallidus", "Globus pallidus", [10342], "internal", 1000, False),
        ("cerebellum", "Cerebellum", [10656], "cerebellum", 4600, False),
        ("midbrain", "Midbrain", [10648], "brainstem", 1500, False),
        ("pons", "Pons", [10661], "brainstem", 1500, False),
        ("medulla", "Medulla oblongata", [10662], "brainstem", 1200, False),
        ("corpus-callosum", "Corpus callosum", [10561], "white-matter", 1800, False),
        ("fornix", "Fornix", [10576], "white-matter", 900, False),
        ("cerebellar-peduncles", "Cerebellar peduncles", [12354, 12741, 12768], "white-matter", 1400, False),
        ("white-matter", "Forebrain white matter", [10557], "white-matter", 2800, True),
        ("ventricles", "Ventricles", [10595, 10651, 10669], "ventricle", 1800, False),
    ]
    meshes = []
    source_x = np.arange(sampled.shape[0]) * affine[0, 0] + affine[0, 3]
    for mid, name, parents, kind, budget, split in definitions:
        selected = labels(parents)
        assert selected, f"No atlas labels for {mid}"
        mask = np.isin(sampled, selected)
        for hemisphere in (["left", "right"] if split else ["bilateral"]):
            part = mask.copy()
            if hemisphere == "left":
                part[source_x >= 0, :, :] = False
            elif hemisphere == "right":
                part[source_x < 0, :, :] = False
            coords = np.argwhere(part)
            assert len(coords), f"Empty {mid} {hemisphere}"
            low = np.maximum(coords.min(0) - 2, 0)
            high = np.minimum(coords.max(0) + 3, np.array(part.shape))
            crop = part[tuple(slice(int(a), int(b)) for a, b in zip(low, high))]
            crop = np.pad(crop.astype(np.float32), 1)
            field = gaussian_filter(crop, sigma=0.65)
            verts, faces, _, _ = marching_cubes(field, level=0.5, allow_degenerate=False)
            # Recover source RAS millimetres; transform R,A,S -> right,superior,anterior.
            verts += low - 1
            ras = nib.affines.apply_affine(affine, verts) - center_ras
            verts = ras[:, [0, 2, 1]]
            faces = faces[:, ::-1]  # axis permutation reflects coordinates.
            mesh = trimesh.Trimesh(vertices=verts, faces=faces, process=True)
            # Marching-cube surfaces have voxel stair steps. Taubin smoothing avoids shrinkage.
            trimesh.smoothing.filter_taubin(mesh, lamb=0.5, nu=0.53, iterations=4)
            if len(mesh.faces) > budget:
                mesh = mesh.simplify_quadric_decimation(face_count=budget, aggression=5)
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
                "atlasStructureIds": parents, "atlasLabelIds": selected,
                "positions": positions.reshape(-1).tolist(), "indices": indices.reshape(-1).tolist(),
                "bounds": [positions.min(0).tolist(), positions.max(0).tolist()],
                "sourceLabelNames": [structures[p]["name"] for p in parents],
            }
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
        "derivation": "Atlas label descendants; bilateral source volume; 1 mm surface sampling; Gaussian and Taubin surface smoothing; quadric mesh decimation. Atlas labels are retained, not redrawn.",
        "limitations": "Simplified reference parcellations on an averaged MNI MRI, not an individual scan. Outer hemisphere shells include forebrain labels; fine nuclear boundaries are simplified. White-matter meshes are atlas volumes, not diffusion streamlines. Caudal medulla is truncated by the source volume.",
        "sha256": {"annotation_full.nii.gz": sha(source), "voxel_count.csv": sha(ontology)},
        "sourceShape": list(img.shape), "sourceSpacingMm": list(map(float, img.header.get_zooms()[:3])),
        "totalSourceLabeledVoxels": int(np.count_nonzero(data)),
    }
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
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    args.out.mkdir(parents=True, exist_ok=True)
    atlas_metadata = atlas(args.cache, args.out)
    receptor_metadata = receptor(args.cache, args.out)
    write_json(args.out / "credits.json", {"version": 1, "models": [atlas_metadata, receptor_metadata]})
    print("Output bytes", {p.name: p.stat().st_size for p in args.out.glob("*.json")}, flush=True)


if __name__ == "__main__":
    main()
