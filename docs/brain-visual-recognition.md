# Visual recognition references

2026-10-05. `public/brain/recognition.js` supplies50 topic entries, each with a conventional reference view, three specific visual landmarks and direct source URLs. Optional caveats identify material limits. No curriculum, flashcard, app or model code changed in this content task.

## Intended use

Course context: primarily Cognitive Neuroscience, also Cognitive Neuropsychology. Prioritize standard atlas views, named landmarks and relationships between regions. Protein structure is supporting detail, with family and subunit labels retained.

The supplied Ward fourth-edition PDF and Reisberg eighth-edition EPUB were subsequently inspected. See [the textbook reference map](brain-textbook-reference-map.md) for verified figures, source discrepancies and the 22 topic-specific reading lists now included in the recognition dataset.

These landmarks teach what to identify in a conventional course reference. They do not assert that every fine landmark is resolved in the current3D model. Display the view name alongside the cues; a coronal-section landmark should not be presented as visible on an opaque exterior. Keep source links accessible and distinguish the current representation from a suggested reference view.

- Gross anatomy: orientation and neighboring structures identify a region more reliably than an isolated colored shape. Use lateral/midsagittal/coronal/axial labels consistently.
- Tracts: teach named origins, courses and destinations. Population streamlines do not reveal individual axons or biological direction; composite trajectories must not imply continuous axons through relays.
- Cells/circuits: distinguish cell morphology from molecular identity and an anatomical location from a circuit diagram. Laminar position, contact targets and signed connections carry meaning; arbitrary colors do not.
- Chemistry:2D skeletal formulas reveal carbon chains, heteroatoms, bond orders, functional groups and charge.3D rotation complements that depiction. Carbon/hydrogen omission follows a stated convention; protonation and stereochemistry must be retained. Color is an optional key, never the sole identifier.
- Protein families: recognizable domain arrangements and membrane topology complement experimental ribbons/traces. Nav/Cav and related glutamate receptors share broad architectures; a unique unlabeled silhouette is not a valid identification claim. Subunit/protein labels and construct identity remain necessary.
- Plasticity: aligned traces, labeled axes or before/after images identify change. A single spine, network or protein silhouette cannot establish LTP, LTD, timing-dependent plasticity or a particular memory.

## Source basis

The module reuses authoritative references already attached to the curriculum and the previous anatomical audit. Fresh reference checks for this task included [lateral cerebral anatomy](https://www.ncbi.nlm.nih.gov/books/NBK10811/), [internal cerebral anatomy](https://www.ncbi.nlm.nih.gov/books/NBK10889/), [internal-capsule sections](https://nba.uth.tmc.edu/neuroanatomy/L10/Lab10p01_index.html), [brainstem surfaces](https://nba.uth.tmc.edu/neuroanatomy/L10/Lab10p29_index.html), [cerebellar circuitry](https://nba.uth.tmc.edu/neuroscience/s3/chapter05.html), and [hypothalamic section landmarks](https://www.ncbi.nlm.nih.gov/books/NBK279126/).

Molecular graph references are the named PubChem records, including [dopamine](https://pubchem.ncbi.nlm.nih.gov/compound/681) and [Met-enkephalin](https://pubchem.ncbi.nlm.nih.gov/compound/443363). The latter record explicitly lacks an automatically generated3D conformer; its sequence/connectivity must not be promoted as an experimentally measured fold. Protein references are the six bundled structures’ RCSB entries, including the [3KG2 AMPA tetramer](https://www.rcsb.org/structure/3KG2). Every dataset entry carries its own relevant URLs.

## Validation and limits

- Imported the module and compared its keys against the actual50 curriculum IDs: exact coverage, no extra or missing topics.
- Checked three nonempty landmarks per entry, concise titles/views/caveats and nonempty HTTPS source lists.
- Reviewed chemistry cues against the named atom graphs and kept near-physiological charge drawings distinct from neutral parent records.
- No claim of expert certification, unique protein silhouettes or full histological fidelity. No new pixel audit is implied by this content-only change.

## Published-image comparison

Independently inspected pixels from18 published reference images: nine PubChem structural formulas, six RCSB assembly cartoons and three UTHealth atlas figures. Also rasterized and inspected all nine generated SVG formulas. Source downloads and local comparison images are in the external QA directory `qa/recognition-references`; these reference images are research evidence, not newly published site assets. This comparison does not certify the final browser layout or every atom of a protein model.

### Chemical depictions

Each PubChem image is available at `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/<CID>/PNG?image_size=large`. The exact inspected records and visible checks:

| Compound | CID / source | Identifying visual features checked |
| --- | --- | --- |
| Dopamine | [681](https://pubchem.ncbi.nlm.nih.gov/compound/681) | Catechol ring: adjacent hydroxyls; two-carbon amine side chain. |
| Serotonin | [5202](https://pubchem.ncbi.nlm.nih.gov/compound/5202) | Fused indole rings with ring N–H; hydroxyl and ethylamine substituents. |
| Acetylcholine | [187](https://pubchem.ncbi.nlm.nih.gov/compound/187) | Explicit positively charged quaternary nitrogen, three methyl groups and an ester. |
| L-glutamic acid | [33032](https://pubchem.ncbi.nlm.nih.gov/compound/33032) | Two carboxylic acids, alpha amino group and defined stereochemistry. The source depicts the neutral parent. |
| GABA | [119](https://pubchem.ncbi.nlm.nih.gov/compound/119) | Four-carbon acid chain with a terminal amino group; no ring. |
| Norepinephrine | [439260](https://pubchem.ncbi.nlm.nih.gov/compound/439260) | Catechol plus side-chain hydroxyl and defined stereochemistry. |
| Glycine | [750](https://pubchem.ncbi.nlm.nih.gov/compound/750) | Amino group and carboxyl separated by one methylene; no stereocenter. |
| Histamine | [774](https://pubchem.ncbi.nlm.nih.gov/compound/774) | Five-membered imidazole with two ring nitrogens plus ethylamine. |
| Met-enkephalin | [443363](https://pubchem.ncbi.nlm.nih.gov/compound/443363) | Five-residue peptide, four peptide bonds, two aromatic side chains and methionine sulfur. |

Observed conventions: thin dark skeletal bonds, omitted carbon labels and carbon-bound hydrogens, explicit heteroatom letters, multiple bonds, charge and stereobonds. The generated SVGs preserve these distinguishing features, including acetylcholine N⁺, norepinephrine R and glutamic-acid S. Different rotations and valid wedge/dash choices are not structural discrepancies. Peptide labels need an enlargement option at phone width. Neutral source records must not be described as a prediction of physiological protonation.

### Protein cartoons

Inspected exact image URLs follow `https://cdn.rcsb.org/images/structures/<lowercase-ID>_assembly-1.jpeg`.

| Entry | Source / image | Display lesson from inspected pixels |
| --- | --- | --- |
| Nav1.7 | [6J8J](https://www.rcsb.org/structure/6J8J) / [image](https://cdn.rcsb.org/images/structures/6j8j_assembly-1.jpeg) | Dense helical core and separate auxiliary folds; a single anonymous ring loses this distinction. |
| Kv chimera | [2R9R](https://www.rcsb.org/structure/2R9R) / [image](https://cdn.rcsb.org/images/structures/2r9r_assembly-1.jpeg) | Four colored pore chains above distinct cytoplasmic/auxiliary structure. Preserve chain identities. |
| CaV2.2 | [7MIY](https://www.rcsb.org/structure/7MIY) / [image](https://cdn.rcsb.org/images/structures/7miy_assembly-1.jpeg) | Large asymmetric auxiliary domains extend beyond the membrane-channel core. |
| AMPA | [3KG2](https://www.rcsb.org/structure/3KG2) / [image](https://cdn.rcsb.org/images/structures/3kg2_assembly-1.jpeg) | Extracellular domain tiers and membrane helices are visually distinct; the extracellular assembly is not a uniform fourfold cylinder. |
| NMDA | [4PE5](https://www.rcsb.org/structure/4PE5) / [image](https://cdn.rcsb.org/images/structures/4pe5_assembly-1.jpeg) | Broad extracellular domain assembly above membrane helices; subtype identification still needs GluN1/GluN2 labels. |
| GABA-A | [6D6T](https://www.rcsb.org/structure/6D6T) / [image](https://cdn.rcsb.org/images/structures/6d6t_assembly-1.jpeg) | Beta-rich extracellular domains contrast with membrane helices. The official assembly image also contains Fab fragments, unlike the receptor-only local asset. |

The six images use ribbons for helices, broad arrows for beta strands, thin connecting coils and chain colors. These conventions justify the deposited-secondary-structure cartoons and a separate atom-color key for small molecules. Chain colors are not element colors. Missing/unresolved residues must stay gaps; added glycan/ligand graphics in the reference are not evidence that the Cα-only asset includes them.

Orientation warning from actual images: the6D6T thumbnail has membrane helices above its extracellular beta domains, whereas3KG2 and4PE5 have extracellular domains above membrane helices. An arbitrary display/deposition axis is not a biological membrane normal. Use explicit per-entry domain labels or a validated membrane-orientation source; do not label a universal screen-up direction extracellular. The RCSB6D6T entry links its [OPM membrane-orientation record](https://opm.phar.umich.edu/proteins?search=6d6t).

### Updated site pixel comparison

After the renderer changes, inspected all 15 topic models in `qa/visual-recognition/molecular/proteins-sheet.jpg` and `molecules-sheet.jpg`, with full-page close checks of GABA-A, AMPA, acetylcholine and Met-enkephalin. The experimental structures now use per-entry rigid OPM orientation; `protein-orientation.json` records source URLs, matched Cα counts and alignment residuals. GABA-A displays its beta-rich extracellular region above the membrane helices. AMPA/NMDA retain extracellular domain tiers; the Kv cytoplasmic assembly and Nav/Cav auxiliary asymmetry remain distinct. This visual comparison found no clipping or misleading-geometry blocker in those 15 captures.

All nine molecular views retain their expected ring/chain/functional-group patterns. The acetylcholine N⁺ label is visible. The peptide shows aromatic side chains and sulfur, and the page clearly identifies the displayed structure as one computed conformer. Its inline structural formula is small, but opens at larger size. These are inspected screenshot findings, not atom-level certification or a new audit of all 50 scenes.

### Atlas views for the stated course

Inspected the embedded source JPEG pixels in UTHealth Neuroscience Online [Figure1.9A, lateral](https://nba.uth.tmc.edu/neuroscience/m/s2/images/html5/1-9A.html), [Figure1.9B, medial](https://nba.uth.tmc.edu/neuroscience/m/s2/images/html5/1-9B.html), and [Figure1.17, sections](https://nba.uth.tmc.edu/neuroscience/m/s2/images/html5/1-17.html); context: [Overview of the Nervous System](https://nba.uth.tmc.edu/neuroscience/m/s2/chapter01.html).

Practical transfer: provide a stable lateral view for central sulcus/precentral/postcentral and lateral-sulcus/temporal relationships; a medial view for callosum, cingulate, thalamus and ventricular relationships; and named sections for deep nuclei and internal capsule. These are stronger course-recognition aids than isolated colored nuclei. Figure labels illustrate spatial layout; they do not justify treating a broad cognitive function as confined to one colored region. The50-topic cue dataset already prioritizes these view-dependent relationships and states when a landmark needs a section.


## Release verification

Custom scene geometry, reference cues and diagram assets remain separate from the supplied textbook files. The course mapping is in `docs/brain-textbook-reference-map.md`; 32 verified textbook references appear in 22 topic panels.

- All 50 default model views inspected, with corrected recaptures; four deep-anatomy focus views and three microscopic close-ups inspected.
- Nine representative production-build phone models inspected at390px. Molecular formula/conformer card switching, answer hiding, vertical reveal, next/undo and return-to-lesson checked. Protein cards also checked at320px; no horizontal overflow or browser errors.
- `npm test` passes: 50 scenes,7,012 animation/detail frames,291 adjacent zoom boundaries; source/coordinate, morphology, learning-system and publication checks.
- Strict TypeScript passes. Independent offline RDKit verification confirms all nine molecular graphs, charge, formula and coordinate-derived stereochemistry against PubChem SDF records.
- OPM rigid alignment matches600–3,116 deposited Cα coordinates per structure with RMSD below0.006Å. Rotation determinants are+1; no reflection, deformation or invented membrane motion. Secondary structure uses deposited HELIX/SHEET ranges; unresolved segments remain gaps.
- Evidence lives outside the repository in `qa/visual-recognition`. The production build was used for final phone checks after the concurrent build invalidated the running development server's module cache.

These views support recognition of the existing curriculum. They do not claim complete coverage of either textbook, unique molecular silhouettes, physiological protonation for neutral PubChem records, or experimentally measured cellular animations.
