# Brain model provenance and surface repair

## Measured anatomy

`public/brain/models/atlas.json`: 19 surfaces derived from **Allen Human Reference Atlas – 3D, 2020**, version1.0.0, RRID:SCR_017764. [Source and CC BY4.0 evidence](https://download.alleninstitute.org/informatics-archive/allen_human_reference_atlas_3d_2020/version_1/README.pdf). Credit ©2019 Allen Institute for Brain Science; Song-Lin Ding and colleagues (2020). Parcellations were drawn on the ICBM2009b nonlinear symmetric averaged MRI.

Two continuous cerebral exteriors use native0.5mm labels, including gray and white matter. Largest connected volume retained; enclosed cavities filled, exterior-connected sulci preserved. Light Gaussian/Taubin smoothing precedes topology-preserving decimation to30,000 triangles per hemisphere. Tiny sealed interpolation pockets excluded. This approximates the pial exterior; it is not an individual histological reconstruction. Lobe colors assign exterior triangles to nearest cortical atlas labels; boundaries approximate. Color patches never expose cortical-ribbon interior walls.

Internal atlas descendants: hippocampal formation, amygdala, thalamus, hypothalamus, basal ganglia, cerebellum, brainstem, callosum, fornix, peduncles, white-matter volumes and ventricles. Sampling1mm; fragments below0.5% of largest component area omitted. Caudal medulla truncated by source.

Cerebellar exterior is separately native0.5mm/30,000triangles. The Allen cerebellum ancestor is under the gray-matter branch, so its cortical-ribbon-only mask omitted white matter and exposed folded interior walls. Actual hindbrain-white-matter10668 voxels are assigned by nearest cerebellar versus brainstem gray anatomy, keeping the latter outside this envelope. Gray-plus-white union, enclosed-cavity filling and largest exterior component preserve gross cerebellar fissures. Vertex-constrained topology decimation avoids new polygon overshoot. Fine folia remain atlas/MRI approximations. Repair changes only cerebellum geometry; other final meshes remain identical.

Browser axes: millimetres, +Xright, +Ysuperior, +Zanterior. NIfTI RAS affine determines orientation; reflected permutation reverses winding, corrected before export. Shared `centerSourceRAS=[0,-16,5.5]` preserved across regeneration.

Schema: `meshes[{id,name,kind,hemisphere,positions:flatXYZ,indices:flatTriangles,bounds,atlasStructureIds,atlasLabelIds,quality}]`. Hemispheres also have `regions[{id,name,kind,atlasStructureIds}]` and `faceRegions[]`, one lobe index per triangle. Assembled hemisphere closed; color-patch perimeter intentionally open.

## Measured white-matter pathways

`public/brain/models/tracts/`: **25 named HCP1065 population-averaged bundles**, 8,900 sampled streamlines, 356,000 points, about6.71MB. [Dataset/license](https://brain.labsolver.org/hcp_trk_atlas.html); YehF.-C.(2022), *Nature Communications*13,4933, [doi:10.1038/s41467-022-32595-4](https://doi.org/10.1038/s41467-022-32595-4). Derived JSON remains **CC BY-SA4.0**; [HCP data-use terms](https://www.humanconnectome.org/study/hcp-young-adult/document/wu-minn-hcp-consortium-open-access-data-use-terms) and required acknowledgment retained in manifest/combined credits.

Callosum; bilateral corticospinal tract, medial lemniscus, optic radiation, arcuate, uncinate, inferior/superior longitudinal fasciculi, frontal–parietal/parahippocampal cingulum, fornix; middle/superior/inferior cerebellar peduncles. Actual source streamlines uniformly reservoir-sampled, each reduced to40 arc-length points. **No synthetic fibers.** Count is display budget, never axon count. Tractography estimates candidate pathways rather than directly imaging axons; establishes neither signaling direction nor connection certainty. Medial lemniscus covers only the brain portion of the dorsal-column pathway.

TRK voxel orderLPS. Nibabel `.streamlines` applies pending TrackVis voxel-corner-to-RAS affine; lazy raw-record iteration bypasses it. RAS+ centered/permuted to browser axes. Independent left/right median and MNI-bound checks guard this seam. HCP ICBM2009a nonlinear asymmetric and Allen ICBM2009b symmetric share MNI context; co-display is **not exact cross-template registration**.

Lazy manifest: `bundles[{id,name,category,hemisphere,topicIds,bounds,file,streamlineCount,pointCount,byteLength}]`. Bundle files: `positions:flatXYZ`, `offsets[]` in **point indices**, source hashes/derivation. One observed streamline spans consecutive offsets. Renderer batches one `LineSegments` per bundle; orientation tint follows redLR, greenAP, blueSI, blended with category color.

## Experimental receptor

`gaba-a-6d6t.json`: 1,638 measured Cα coordinates, **PDB6D6T** human GABA-A α1β2γ2 conformationB, cryo-EM3.86Å. A/Cβ2, B/Dα1, Eγ2. Antibodies, ligands, side chains/unresolved residues excluded; gaps separate. **CC0 1.0**. Zhuetal.(2018), *Nature*559,67–72, [doi:10.1038/s41586-018-0255-3](https://doi.org/10.1038/s41586-018-0255-3), [RCSB6D6T](https://www.rcsb.org/structure/6D6T).

## Diagnosis and regression

Original screenshot: cavities and broken folds. Ranked hypotheses/probes:

1. Ribbon masks expose inner walls when used as whole exterior. Continuous gray-plus-white envelope restores coherent folded exterior; browser review confirms.
2. Coarse/aggressive decimation corrupts folds. Native0.5mm raw and smoothed hemispheres closed; old fast simplifier creates69 nonmanifold edges (1mm creates92). Topology-preserving decimation yields zero boundary/nonmanifold edges at30,000 triangles/hemi.
3. Disconnected pockets add artifacts. Original hemisphere exports111/112 components; final one each,100% surface area.
4. Transparency alone creates cavities. Opaque repaired exterior and faint context separate this from geometry failure.

`diagnose-brain-surfaces.py --require-closed` is red on original, green on repaired exports. `verify-brain-models.mjs` independently checks edge incidence, labels, cortex detail/region indices, orientation,25bundle offsets/hashes/bounds/density, receptor gaps, combined anatomy/tract budget<15MB. Current anatomy/tract/receptor about9.06MB, lazy loaded.

Cerebellar regression additionally requires one closed exterior, source white matter, ≥28,000triangles and99th-percentile edge length<6mm. Original:6components,4,600triangles,12.7mm p99edge; repaired:1component,30,000triangles,4.89mm p99edge. After cerebellar repair, anatomy/tract/receptor totals about9.73MB.

## Additional references

- [BigBrain maps/surfaces](https://bigbrainproject.org/maps-and-models.html): histological folded cortex and multiscale surfaces. [Dataset CC BY-NC-SA4.0](https://forum.bigbrainproject.org/t/bigbrain-license/129); reference only, no files redistributed.
- [MNI ICBM152 nonlinear2009](https://www.bic.mni.mcgill.ca/ServicesAtlases/ICBM152NLin2009): source spaces/template variants.
- [DIPY bundle visualization](https://docs.dipy.org/stable/examples_built/visualization/viz_bundles.html): bundle displays, coordinate transforms, orientation colors. Reference only; custom browser implementation.
- [Brainlife tractography](https://brainlife.io/app/5e9db4c5f1745d5768f68d19), [QA](https://brainlife.io/app/5d60171f4cfacf00366c114a), [surface viewing](https://brainlife.io/docs/tutorial/introduction-to-brainlife/): anatomically constrained workflows and geometry QA. No user data used.

Close zoom substitutes **enlarged teaching schematics**: region-specific functional topology at level2, axon/myelin/node diagram at level3. Positions/scales illustrative; no microscopic continuity claimed. Measured HCP streamlines have no signaling animation. Node pulse is schematic propagation.

## Regeneration

Python dependencies: `numpy,nibabel,scipy,scikit-image,trimesh,pymeshlab`.

```sh
python scripts/build-brain-models.py --cache /temporary/atlas-cache --out public/brain/models
python scripts/build-brain-models.py --cache /temporary/atlas-cache --out public/brain/models --only cerebellum
python scripts/build-brain-tracts.py --cache /temporary/hcp-cache
python scripts/diagnose-brain-surfaces.py --require-closed
node scripts/verify-brain-models.mjs
```

Tract builder fetches selected ZIP members by HTTP ranges, checks archive CRC, records SHA-256. Temporary cache holds sources; site ships attributed compact derivatives. A `--only` probe produces a partial manifest; regenerate full manifest afterward.
