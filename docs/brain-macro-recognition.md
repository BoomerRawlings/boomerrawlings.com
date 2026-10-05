# Macro anatomy recognition

Class context: cognitive neuroscience / cognitive neuropsychology. Reference appearances and spatial relationships take priority over abstract node diagrams.

## Actual visual references inspected

- [Allen Human Reference Atlas 2020 README, page 1](https://download.alleninstitute.org/informatics-archive/allen_human_reference_atlas_3d_2020/version_1/README.pdf): sagittal MRI/parcellation overlay, lateral cerebral lobes, medial hemisphere. Compared cortical silhouette and gyri, deep structures beneath the hemisphere, and posterior/inferior cerebellum. This motivated the measured contralateral-hemisphere cutaway, rather than isolated bilateral shapes.
- [HCP1065 tract atlas illustrated examples](https://user-images.githubusercontent.com/275569/149355373-399832bb-7a83-486d-ba89-71910a0af9df.png), linked from the [author's atlas page](https://brain.labsolver.org/hcp_trk_atlas.html): inspected the anterior corticospinal fans, superior optic-radiation view, lateral association bundles and medial cingulum/fornix arcs. These informed consistent section/view choices, without changing streamline coordinates or inventing connections.
- [MNI 2009a asymmetric example sections](https://www.bic.mni.mcgill.ca/uploads/ServicesAtlases/mni_icbm152_asym_09a_small.jpg), linked from the [official template page](https://www.bic.mni.mcgill.ca/ServicesAtlases/ICBM152NLin2009): inspected T1 sagittal/coronal/axial sections, bright white matter, darker cortical rim and dark ventricular spaces. New reference planes are derived from that exact template archive, not copied from the illustration.

Local audit evidence: external `qa/recognition/reference/` contains the three reference images/PDF and rendered Allen page. Existing published screenshots showed accurate but context-free thalamic, hypothalamic, hippocampal and amygdalar silhouettes. New screenshot review is tracked separately by the release audit.

## Implemented presentation

- Overview/cortex: continuous measured hemisphere surfaces, near-lateral default direction, all visible major-lobe labels eligible immediately; anatomical direction labels.
- Thalamus, hypothalamus, hippocampus, amygdala, cerebellum, brainstem: default `context` view removes the right cerebral exterior, retains the measured left hemisphere, and adds selected measured neighbors. Targets retain their original size, shape and location. The separate `measured` view remains available as **Isolated anatomy**.
- Neighbor sets are explicit: thalamus → hypothalamus/fornix/brainstem; hypothalamus → thalamus/fornix/midbrain; hippocampus → amygdala/fornix/thalamus; amygdala → hippocampus/fornix; cerebellum → brainstem; brainstem → cerebellum/thalamus. Proximity is not drawn as a synaptic connection.
- Small native-coordinate CSF landmarks add the third ventricle beside thalamus/hypothalamus, inferior ventricular horn near hippocampus/amygdala, and fourth ventricle/aqueduct beside the brainstem. They are identified as spaces, not solid neural tissue. The source does not annotate optic chiasm, so none is invented.
- Tract overview, callosum and association fibers: native midsagittal T1 reference. Corticospinal: coronal section. Optic radiation: axial section. A separate pure-tractography view remains available.
- Dorsal-column topic: the default cutaway contains measured VPL/postcentral relay regions. The source ML reconstruction's cortical continuation remains an explicitly separate composite estimate; no continuous relay-crossing axon is invented.
- Regional anatomy and microscopic axon alternatives remain explicit representations. Zoom only adds detail; it does not replace the representation.

## Source and reproducibility

Allen geometry is unchanged. It uses ICBM2009b **symmetric** coordinates; no Allen structure is overlaid on HCP streamlines.

`public/brain/models/atlas-landmarks.json` adds four separate source masks: third ventricle10602, inferior horn10600, aqueduct12369, fourth ventricle12805. `scripts/build-brain-landmarks.py` uses native0.5mm labels,0.45-voxel smoothing, marching cubes and topology-preserving decimation; exact source hashes and coordinates match the existing atlas. This does not regenerate or alter existing anatomical surfaces.

New `public/brain/models/tracts/reference-mri.json` uses official ICBM2009a **asymmetric** T1 and its brain mask, matching the named HCP1065 template. `scripts/build-brain-context.py` extracts the official NIfTI archive; source affine, shape, copyright, file SHA-256 and derivation are embedded. Planes are fixed at native RAS x=0, y=-16 and z=0 mm; deterministic 2 mm sampling; brain-mask-restricted triangles; source intensity 0–100 mapped to 8-bit grayscale. The renderer uses vertex colors, no image textures. Every position uses the same documented RAS-to-scene coordinate permutation and uniform scale as the tract files.

Run `python scripts/build-brain-context.py --cache <source-cache>` with NumPy/nibabel (`--packages` supported). Run `node scripts/verify-brain-regions.mjs` to check source-derived meshes, representations, MRI coordinate levels and template separation. An independent comparison reconstructing NIfTI voxel coordinates verified every exported MRI vertex intensity against the source volume.

## Limits

The cutaway is a reference atlas, not an individual specimen. Surfaces remain smoothed and simplified; neighbors are selectively shown. MRI reference planes are sampled at 2 mm and do not add nuclear/histological boundaries. HCP streamlines are population estimates. This change adds recognizable context, standard orientation and measured landmarks; it does not claim all microscopic anatomy or every course-specific convention is represented.

## Final visual check

All14 default macro views and four selected-structure close views were inspected from browser captures. Seven corrected defaults were rechecked: local CSF spaces no longer mask hippocampus, MRI grayscale conversion retains recognizable tissue/ventricular contrast, and named association families have stable distinct colors. Focused thalamus, hypothalamus, hippocampal formation and amygdaloid complex remain framed and unobscured. External evidence: `qa/visual-recognition/macro/audit.md` and stage/focus captures. GPU disposal/source-coordinate review found no remaining defect; MRI uses ordinary vertex-colored geometry without textures.
