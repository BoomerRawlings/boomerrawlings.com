# Brain model provenance

`public/brain/models/atlas.json` contains 31 simplified surfaces from the **Allen Human Reference Atlas – 3D, 2020**, version 1.0.0, RRID:SCR_017764. Source: [Allen Institute download](https://download.alleninstitute.org/informatics-archive/allen_human_reference_atlas_3d_2020/version_1/). The source README explicitly licenses the parcellations CC BY 4.0. Credit: © 2019 Allen Institute for Brain Science; Song-Lin Ding and colleagues (2020).

Surfaces include six bilateral cortical lobes, hemispheric shells, hippocampus, amygdala, thalamus, hypothalamus, basal ganglia, cerebellum, brainstem, corpus callosum, fornix, cerebellar peduncles, forebrain white matter, and ventricles. Parent labels collect their actual annotated descendants. White matter represents atlas volumes, not measured diffusion streamlines.

The 0.5 mm NIfTI RAS affine determines anatomical orientation. Browser coordinates use millimetres, +X right, +Y superior, +Z anterior; all meshes share one atlas center. The axis permutation reverses winding, corrected before exporting outward normals. Meshes use 1 mm surface sampling, Gaussian/Taubin smoothing, and quadric decimation. They are simplified reference regions on an averaged MRI. The source truncates the caudal medulla.

`gaba-a-6d6t.json` contains 1,638 measured alpha-carbon coordinates from **PDB 6D6T**, human GABA-A α1β2γ2 receptor, conformation B; cryo-EM resolution 3.86 Å. Chains A/C are β2, B/D α1, E γ2. Antibody chains, ligands, side chains and unresolved residues are excluded. Discontinuous traces stay separate. Data license: CC0 1.0. Cite Zhu et al. (2018), *Nature* 559, 67–72, [doi:10.1038/s41586-018-0255-3](https://doi.org/10.1038/s41586-018-0255-3), and [RCSB 6D6T](https://www.rcsb.org/structure/6D6T).

Both payloads and `credits.json` include source URLs, licenses, source hashes, limitations and coordinate details. Total: about 3.25 MB, fetched only when 3D starts.

Regenerate with Python packages `numpy`, `nibabel`, `scipy`, `scikit-image`, `trimesh`, `fast-simplification`:

```sh
python scripts/build-brain-models.py --cache /temporary/atlas-cache --out public/brain/models
node scripts/verify-brain-models.mjs
```

Source downloads remain in the temporary cache. The site ships derived JSON only.
