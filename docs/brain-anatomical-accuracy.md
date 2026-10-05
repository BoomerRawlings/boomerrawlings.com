# Brain visual accuracy: topic coverage and acceptance criteria

Reviewed 2026-10-05. Scope: all 50 curriculum topics, replacement of the previous eight flashcard SVG families, local model provenance, and authoritative anatomy/structure references. This source and implementation audit includes the bounded card pixel review recorded below. It is **not** a certification of every rendered pixel or biological measurement.

## Baseline findings

The previous `card-visuals.ts` selected geometry by eight broad families, not by topic. Its descriptions identified the geometry as symbolic, but several topic/figure pairings still teach the wrong structure:

| Priority | Existing pairing | Required correction |
| --- | --- | --- |
| Highest | `electrical-synapses` shows vesicles releasing into a cleft | Two membranes joined by paired connexons; no chemical release sequence. |
| Highest | `astrocytes` and `microglia` show a neuron with a myelinated axon | Different glial morphologies, processes and relationships; no neuronal axon assigned to either cell. |
| Highest | Nine transmitter/peptide topics share one invented six-node ligand shape | Actual molecular connectivity for the eight named small molecules; an explicitly identified peptide example. |
| High | Named basal-ganglia, hippocampal and cerebellar circuits share one E/I graph | Topic-specific cell populations, connections, direction and synaptic signs. |
| High | Six channels share one two-sided pore | Preserve channel-specific subunit architecture; separate experimental structure from an explanatory gating diagram. |
| High | All brain regions share one freehand brain outline | Show the actual named region, with appropriate exposed/interior context and anatomical orientation. |
| High | All tract topics share arbitrary curves with traveling markers | Use the correct named bundle or an explicitly separated pathway diagram. Tractography does not measure signaling direction. |
| High | All plasticity topics show one growing spine | Differentiate local LTP/LTD, timing rules, global scaling, structural change and systems consolidation. |

“Schematic” permits simplified layout or scale; it does not permit the wrong cell type, connectivity, atom graph or receptor stoichiometry. “Parallel fibers” is also a specific cerebellar term: avoid using it as a generic label for every white-matter bundle.

## Available evidence and its limits

- **Atlas:** `public/brain/models/atlas.json` derives from the [Allen Human Reference Atlas 2020][allen], a parcellation on the ICBM2009b symmetric average. Local exterior meshes are smoothed/decimated envelopes; lobe colors use nearest-label assignment. They support regional relationships, not individual sulci, fine cortical laminae or histological nuclear borders. Preserve the supplied right/superior/anterior coordinate convention. Atlas license: CC BY 4.0.
- **Tracts:** the [HCP1065 atlas][hcp] supplies named population streamlines. Local data have deterministic sampling and point reduction. These are inferred trajectories, not counted axons or measured firing directions. Its ICBM2009a asymmetric template differs from the Allen template; shared MNI coordinates do not establish exact registration. Derived assets retain CC BY-SA 4.0 and the HCP acknowledgment.
- **Neuron:** `micro-neuron.json` preserves a [mouse visual-cortex Cux2 reconstruction][swc]. The local asset is dendrite-only. Preserve parent-child connectivity; never relabel it a measured human neuron, Purkinje cell, astrocyte or axon. Added spines/axon shapes are separate schematics. Its Allen usage terms differ from the atlas license.
- **Small molecules:** `micro-molecules.json` contains eight [PubChem][pubchem] computed conformers, with atom IDs, elements, bond orders and formal charges. Preserve the graph and stereochemistry under rigid rotation/uniform scale. These are not bound conformations or automatically physiological protonation states. The local glutamate record is **L-glutamic acid**; the acetylcholine record carries +1. A generic binding pocket cannot establish a real ligand–receptor pose.
- **Proteins:** six existing files contain experimentally derived Cα traces. They preserve selected receptor chains and residue gaps, not every atom, ligand or density feature. Preserve biological assembly, subunit identity and missing segments; do not stretch a trace to simulate gating or infer a membrane plane from deposited axes. A Cα trace cannot locate side-chain contacts by itself. Entry-specific species, construct and bound state remain part of the label.
- **Original diagrams:** valid for synaptic processes, glial relationships, circuit signs and plasticity mechanisms. Their evidence is the named biological relationship, not invented 3D coordinates. Label layout and motion as illustrative, keep actual connection topology correct, and do not assign unsupported dimensions or rates.

## Fifty-topic replacement manifest

Each row names what must be shown and the most consequential constraint. “Atlas” and “tract” refer to existing local assets above. “Diagram” means an original, source-grounded teaching representation, not a measured reconstruction. The full lesson reference lists in `curriculum.js` remain the content provenance; links below identify visual constraints and coordinate records.

| # | Topic ID | Appropriate representation | Accuracy requirement / reference |
| --- | --- | --- | --- |
| 01 | `brain-overview` | Atlas cerebrum, cerebellum and brainstem, with orientation triad | Preserve proportions and connections; do not add arbitrary regional activity paths. [Atlas][allen]. |
| 02 | `cerebral-cortex` | Atlas hemispheres and correctly colored outer lobes; separate laminar inset if needed | Insula is deep in the lateral fissure, not exposed on an opaque lateral exterior. Laminae belong to a diagram, not this gross mesh. [Internal anatomy][cortex]. |
| 03 | `thalamus` | Paired atlas thalamic volumes in an exposed diencephalic view | Keep the third-ventricle relationship; do not invent LGN/MGN subdivisions from an undivided coarse mesh. [Thalamic anatomy][thalamus]. |
| 04 | `hypothalamus` | Atlas hypothalamic region plus a separate pituitary-route diagram | Posterior pituitary axons and anterior pituitary portal-blood routes must differ. Fine nuclei require another source, not arbitrary dots on the volume. [Hypothalamus][hypothalamus]. |
| 05 | `hippocampus` | Atlas bilateral hippocampal formation, optional separately labeled fornix | Maintain medial-temporal location and curvature; gross mesh does not resolve DG/CA fields. [Hippocampus][hippocampus]. |
| 06 | `amygdala` | Bilateral atlas amygdala with hippocampal context | Show its anterior medial-temporal relationship; a single mesh cannot claim resolved basolateral/central nuclei. [Amygdala][amygdala]. |
| 07 | `cerebellum` | Atlas cerebellar envelope with brainstem/peduncle context | Preserve hemispheres and vermis; source-derived folia remain approximate. Do not show cerebral gyri as cerebellar folia. [Cerebellar anatomy][cerebellum]. |
| 08 | `brainstem` | Atlas midbrain, pons and medulla | Preserve rostrocaudal order; identify source truncation rather than inventing a full spinal cord. [Organization][organization]. |
| 09 | `white-matter` | Distinct association, commissural and projection bundle examples | Legend names bundle classes; no invented common travel direction, streamline-to-axon conversion or white-matter “neurons.” [HCP][hcp], [tractography validation][tract-limits]. |
| 10 | `corpus-callosum` | Callosal streamlines or atlas callosal volume | Commissural crossing connects hemispheres; genu/body/splenium mapping must follow anatomy. Both endpoints do not imply one-way flow. [HCP][hcp], [internal anatomy][cortex]. |
| 11 | `corticospinal` | Named corticospinal streamlines; separate complete crossing diagram | A schematic may show cortex→internal capsule→brainstem→caudal-medullary crossing→spinal targets. Do not claim the brain-only tract data contain its full spinal termination. [Corticospinal anatomy][cst]. |
| 12 | `dorsal-column` | Separate primary-afferent/medullary-relay diagram, with measured medial-lemniscus inset | Primary afferent ascends ipsilaterally; second-order fiber crosses in medulla. Existing medial-lemniscus data are not a complete dorsal column. [Somatosensory pathway][dcml]. |
| 13 | `optic-radiation` | Named bilateral LGN-to-occipital streamlines; distinct visual-field inset | Optic radiation does not cross at the chiasm; retinal axons do. Meyer’s loop carries inferior-retinal/superior-field information. [Visual pathway][vision]. |
| 14 | `association-fibers` | Separately colored arcuate, uncinate, cingulum, ILF or SLF examples | Preserve within-hemisphere routes and bundle names; do not combine all into one generic arc or infer exclusive cognitive function. [HCP][hcp]. |
| 15 | `cortical-circuit` | Pyramidal neuron and inhibitory interneuron diagram | Excitatory arrowheads and inhibitory terminals distinguish feedforward/feedback/disinhibition; feedback returns to the recruiting population. [Cortical synapses][synapses]. |
| 16 | `basal-ganglia` | Named cortex/striatum/GPe/STN/GPi–SNr/thalamus graph | Striatal and pallidal/SNr outputs inhibit; STN excites; direct and indirect routes differ. Avoid mapping every node to one generic neuron silhouette. [Circuit anatomy][basal]. |
| 17 | `hippocampal-circuit` | DG granule cells, CA3/CA1 pyramidal populations and entorhinal input | Mossy fibers are DG→CA3; Schaffer collaterals CA3→CA1; include CA3 recurrence only with correct endpoints. [Hippocampal routes][hippocampus]. |
| 18 | `cerebellar-circuit` | Purkinje planar arbor, granule/parallel fibers, climbing input, deep nucleus | Mossy input reaches granule cells; climbing input from inferior olive contacts Purkinje dendrites; Purkinje output inhibits. [Cerebellar circuit][cerebellum]. |
| 19 | `neuron` | Measured mouse dendritic reconstruction, or a clearly separate complete neuron diagram | Do not fabricate a measured axon from dendritic branches. Soma, dendrite, AIS and axon have different identities. [SWC specification][swc]. |
| 20 | `dendrites` | Measured dendritic arbor with a separate spine head/neck/shaft inset | Added spines are illustrative. Every neck joins a shaft; spine heads are not axon terminals. [SWC][swc], [single-spine experiment][spine]. |
| 21 | `myelin` | Axon with concentric internodal wraps, nodes and oligodendrocyte relationships | CNS oligodendrocyte can serve several internodes; one myelinating Schwann cell serves one PNS internode. No ions leaping between nodes. [Glia][glia]. |
| 22 | `astrocytes` | Ramified astrocyte processes, perisynaptic contact and vascular endfoot diagram | No axon/myelin. Endothelium supplies the barrier seal; do not equate a few GFAP-like branches with the whole astrocyte. [Morphology study][astro], [human/rodent comparison][astro-human]. |
| 23 | `microglia` | Ramified microglial soma and fine surveying processes | No myelinated axon. Process motion is not evidence of neuronal spikes or indiscriminate synapse deletion. [In-vivo surveillance][microglia]. |
| 24 | `resting-potential` | Membrane with compartment labels, gradients, K conductance and Na/K pump | Ion channels and ATPase are distinct; pump ratio 3 Na out:2 K in. Current arrows require an indicated driving-force condition. [Membrane physiology][resting]. |
| 25 | `synaptic-release` | Presynaptic bouton, active-zone Ca channel, vesicles, cleft and postsynaptic membrane | Ca entry precedes fusion; transmitter leaves vesicles into extracellular cleft; vesicle does not cross into the postsynaptic cell. [Release mechanism][release]. |
| 26 | `synaptic-integration` | One connected dendrite/soma/AIS with spatially distinct inputs | Synapses terminate on the receiving membrane; depict summed voltage/conductance, not particles crossing from one independent neuron drawing into another. [Synaptic physiology][synapses]. |
| 27 | `electrical-synapses` | Two docked hexameric connexons across adjacent membranes | Twelve connexin subunits form the full channel in the homomeric Cx36 example. No release vesicles. Direct current direction may depend on coupling/voltage. [Human Cx36 structure][cx36]. |
| 28 | `transmitter-clearance` | Cleft with EAAT uptake and a separately identified AChE/choline example | Uptake transporter, receptor, enzyme and endocytosis are different structures/processes. Never hydrolyze glutamate with AChE. [ACh cycle][ach], [glutamate system][glutamate]. |
| 29 | `short-term-plasticity` | Repeated presynaptic stimuli, residual Ca and available vesicle pool | Change release probability/pool availability, not automatic new spine growth; facilitation/depression can coexist. [Short-term plasticity][short-term]. |
| 30 | `glutamate` | PubChem L-glutamic-acid conformer with complete atom/bond graph | CID33032; retain L stereochemistry, two carboxyl groups and amino group. Explicitly identify the neutral parent record rather than labeling it a physiological glutamate anion. [CID33032][chem-glu]. |
| 31 | `gaba` | PubChem GABA conformer | CID119; four-carbon amino-acid chain, no invented aromatic ring. Record protonation is not a synaptic pH claim. [CID119][chem-gaba]. |
| 32 | `dopamine` | PubChem dopamine conformer | CID681; catechol ring plus ethylamine, two phenolic oxygen atoms. It is not serotonin’s fused indole. [CID681][chem-da]. |
| 33 | `serotonin` | PubChem serotonin conformer | CID5202; fused indole ring, hydroxyl group and ethylamine; preserve both nitrogen atoms. [CID5202][chem-5ht]. |
| 34 | `acetylcholine` | PubChem acetylcholine cation | CID187; retain ester and quaternary ammonium; show formal +1, no aromatic ring. [CID187][chem-ach]. |
| 35 | `norepinephrine` | PubChem norepinephrine conformer | CID439260; catechol plus side-chain hydroxyl and amine. Preserve deposited stereochemistry; do not reuse dopamine coordinates without the extra oxygen. [CID439260][chem-ne]. |
| 36 | `glycine` | PubChem glycine conformer | CID750; two carbons, amino and carboxyl groups, no chiral center. Molecular identity does not imply one receptor type. [CID750][chem-gly]. |
| 37 | `histamine` | PubChem histamine conformer | CID774; imidazole ring and ethylamine, three nitrogens. Do not reuse a catechol or serotonin scaffold. [CID774][chem-his]. |
| 38 | `neuropeptides` | Named Met-enkephalin Tyr–Gly–Gly–Phe–Met connectivity example or dense-core biosynthesis diagram | Peptide backbone links residues through peptide bonds. An extended custom shape is not an experimental fold; do not imply every peptide shares it. [Peptide synthesis][peptides]. |
| 39 | `sodium-channel` | Existing6J8J Cα trace; separate four-domain Nav topology diagram | One α chain has four homologous6-segment domains; distinguish β auxiliaries. Entry is human Nav1.7 toxin-bound/mutated, not a measured opening animation. [6J8J][nav]. |
| 40 | `potassium-channel` | Existing2R9R Cα trace; separate Kv tetramer/filter diagram | Four pore-forming subunits, not four repeats of one Nav-like chain. Identify rat Kv1.2/Kv2.1 chimera and β subunits; it does not represent all K-channel families. [2R9R][kv]. |
| 41 | `calcium-channel` | Existing7MIY CaV2.2 trace plus local Ca coupling diagram | One α1 pore-forming protein with four repeats plus auxiliaries. Distinguish entry from ziconotide-bound companion structure; paper title alone does not identify the ligand state. [7MIY][cav]. |
| 42 | `ampa` | Existing3KG2 GluA2 tetramer; separate ligand-binding/gating diagram | Four subunits; extracellular domains connect to pore. Entry is rat antagonist-bound receptor, not physiological open AMPA. Three membrane helices plus reentrant M2 per subunit. [3KG2][ampa]. |
| 43 | `nmda` | Existing4PE5 GluN1a/GluN2B heterotetramer | Two GluN1 and two GluN2B; separate coagonist/glutamate sites. Rat engineered construct; Mg block is not a Nav-style voltage sensor. [4PE5][nmda]. |
| 44 | `gabaa` | Existing6D6T receptor-only chains or accurate2α:2β:1γ diagram | Five receptor subunits; exclude Fab chains from receptor count. β–α GABA sites differ from α–γ allosteric site. Cys-loop β-rich extracellular domains, four TM segments/subunit. [6D6T][gabaa]. |
| 45 | `ltp` | CA3–CA1-specific spine/synapse mechanism diagram | Separate NMDA-Ca signal, CaMKII and AMPA expression; greater response is not necessarily spine birth. Do not deform experimental protein coordinates. [Molecular plasticity][plasticity]. |
| 46 | `ltd` | Reduced postsynaptic AMPA contribution in a named hippocampal example | Receptor removal is not mandatory destruction of the spine. Different cerebellar/presynaptic mechanisms need separate labeled examples. [LTD][ltd]. |
| 47 | `spike-timing` | Paired pre/post spike traces plus identified synapse | A timing plot is a measured-variable diagram, not gross anatomy. Label Δt convention and preparation; avoid a universal timing-window claim. [Bi–Poo experiment][stdp]. |
| 48 | `homeostatic-plasticity` | Several input synapses on one neuron, with proportional gain comparison | Show multiple input weights and preserve relative differences in the scaling example; one enlarged spine is insufficient. [Scaling experiment][scaling]. |
| 49 | `structural-plasticity` | Connected dendritic shaft/spines with actin/receptor remodeling | Morphology change and electrical strength are different measurements; enlarged spine does not disclose a specific memory. [Single-spine experiment][spine]. |
| 50 | `memory-consolidation` | Named hippocampal–cortical network plus separate cellular inset | Systems and synaptic consolidation occur at different scales. Nodes/arrows are a conceptual network, not a measured tract or a memory physically traveling into cortex. [Memory mechanisms][memory]. |

## Acceptance checks for each node/view

1. **Identity:** named structure, compartment, hemisphere, cell type, molecule or subunit is actually present. A generic fallback must not silently replace a missing topic asset.
2. **Shape and topology:** anatomical meshes preserve supplied relative coordinates; neuronal parent links stay connected; circuit arrows reach the intended population; spine necks join shafts; connexons join two membranes; membrane channels cross the membrane rather than float beside it.
3. **Chemical graph:** every displayed atom belongs to the intended record; elements, formal charge, bond order and stereochemistry remain correct. Any omitted hydrogens are disclosed. Decorative nodes are never labeled atoms.
4. **Protein assembly:** count receptor chains separately from antibodies/auxiliaries; preserve gaps and species/construct identity. A backbone trace is not a solvent surface, a closed pore is not demonstrated ion flow, and one frozen conformation is not a gating trajectory.
5. **Scale and orientation:** left/right/anterior/posterior and intracellular/extracellular labels agree with the view. Uniform fitting is allowed; anisotropic stretching is not. Mixed-scale insets use separate boundaries/labels; no physically impossible continuous zoom between datasets.
6. **Motion:** every animated path has an identified biological role. Signal propagation is not bulk ion travel along an axon; computed molecular rotation is only a viewing aid; tractographic lines do not imply direction. A replayed plasticity demonstration does not claim spontaneous reversal.
7. **Evidence visible to learner:** include source/model ID, species or population when material, and whether coordinates are atlas-derived, experimentally determined, computed or schematic. These labels supplement correct geometry; they do not excuse incorrect geometry.
8. **Actual-pixel review:** inspect all 50 topics at the card sizes used on desktop and phone, including front/reveal states and any animated endpoint. Check clipping, invisible target, overlaps, projection confusion, charge/atom legibility, and labels that point to hidden structures. Code/schema tests alone cannot establish visual accuracy.

## Verification status and handoff

- Baseline topic/visual mappings inspected in source for all 50 topics. Existing curriculum/card explanations reviewed previously; no lesson changes made in this task.
- Coordinate provenance checked against local credits and fresh Allen, HCP, AllenSDK, PubChem and all six RCSB entry pages. Primary cell/plasticity studies provide constraints for original diagrams.
- Some NCBI pages returned a browser challenge; primary abstracts/search-index content and already stored lesson references supplied context. No claim of independently re-reading every full paper.
- Implementation now reuses topic-specific 3D scenes in Practice: named atlas regions/tractography, distinct cells and circuits, eight PubChem conformers, an identified peptide connectivity model and six experimental protein assemblies. Macro regional views use 108 source-derived hemisphere meshes; dorsal-column defaults to explicitly limited relay anatomy. Original diagrams retain visible source/representation limits.
- Actual pixels inspected for all 50 desktop models and all 50 final phone answer-card models; all 18 desktop macro/circuit originals and three corrective phone originals additionally inspected at full size. Final phone captures show no blank/clipped model or overlapping card controls. Labels start off, correcting label obstruction of tracts and protein traces. Detailed evidence is in the external QA folder, `qa/anatomical-accuracy/card-audit.md`; capture inventory records correct topic identities and no horizontal overflow.
- Cerebellar principal parallel-fiber continuity and homeostatic shaft–soma attachment pass corrected phone pixel inspection. `node scripts/test-brain-micro-accuracy.mjs` passes for 36 scenes, including these connections and two sixfold CaMKII rings. Focused CaMKII pixels also confirm the two-ring arrangement. All 14 regional views pass inspection after removing a transparent white-matter artifact and enabling cerebellar hemisphere labels. The source mesh generation was independently checked for IDs, coordinates and sampled voxel centroids; metadata records smoothing, component pruning, decimation and rounding.
- Label controls, source-disclosure keyboard activation, front-side answer hiding, one reusable card canvas, undo, reload/resume and lesson-return pass actual browser checks. A 320-pixel layout also fits.
- Embedded Kir, Nav/Cav, AMPA/NMDA, connexin and EAAT models use their own membrane architecture, including appropriate reentrant loops. Checks cover radial nodal channels, opposed connexon polarity, membrane openings, peripheral transporter paths and receptor orientation in endosomal membranes. See primary [EAAT1 structure](https://pmc.ncbi.nlm.nih.gov/articles/PMC5410168/) and [Cx36 structure](https://pmc.ncbi.nlm.nih.gov/articles/PMC10008584/), with other primary references in the focused regression script.
- Final channel pixels inspected at20%,50% and80% animation positions for all six gating models. Nine affected phone models were recaptured after embedded-protein repairs. Lipid heads remain round, pore lumens stay clear, and principal channel geometry remains visible at overview. Focused CaMKII, electrical-junction and four endosomal-trafficking endpoint captures also pass separate close-up checks.
- Final full test suite passes:108 regional surfaces,36 microscopic accuracy scenes,50 scene builds/6,244 animation-detail frames,255 adjacent-zoom boundaries and15 selected-structure framing cases. These protect explicit constraints; they do not certify every biological feature.
- This 50-topic card review covers the captured settled answer views, not every card front, animation endpoint or camera orientation. Atlas envelopes remain coarse, tractography remains estimated, experimental structures remain fixed conformations, and original teaching geometry remains schematic.

[allen]: https://download.alleninstitute.org/informatics-archive/allen_human_reference_atlas_3d_2020/version_1/README.pdf
[hcp]: https://brain.labsolver.org/hcp_trk_atlas.html
[tract-limits]: https://www.nature.com/articles/s41467-017-01285-x
[swc]: https://alleninstitute.github.io/AllenSDK/cell_types.html
[pubchem]: https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest
[organization]: https://www.ncbi.nlm.nih.gov/books/NBK10915/
[cortex]: https://www.ncbi.nlm.nih.gov/books/NBK10889/
[thalamus]: https://nba.uth.tmc.edu/neuroanatomy/L5/Lab05p12_index.html
[hypothalamus]: https://nba.uth.tmc.edu/neuroscience/s4/chapter01.html
[hippocampus]: https://nba.uth.tmc.edu/neuroscience/s4/chapter05.html
[amygdala]: https://nba.uth.tmc.edu/neuroscience/s4/chapter06.html
[cerebellum]: https://nba.uth.tmc.edu/neuroanatomy/l5/Lab05p21_index.html
[cst]: https://www.ncbi.nlm.nih.gov/books/NBK535423/
[dcml]: https://nba.uth.tmc.edu/neuroscience/m/s2/chapter05.html
[vision]: https://www.ncbi.nlm.nih.gov/books/NBK10909/
[basal]: https://www.ncbi.nlm.nih.gov/books/NBK10847/
[synapses]: https://nba.uth.tmc.edu/neuroscience/s1/chapter06.html
[spine]: https://pubmed.ncbi.nlm.nih.gov/15190253/
[glia]: https://www.ncbi.nlm.nih.gov/books/NBK10869/
[astro]: https://pubmed.ncbi.nlm.nih.gov/11756501/
[astro-human]: https://pubmed.ncbi.nlm.nih.gov/19279265/
[microglia]: https://pubmed.ncbi.nlm.nih.gov/15831717/
[resting]: https://nba.uth.tmc.edu/neuroscience/s1/chapter01.html
[release]: https://nba.uth.tmc.edu/neuroscience/s1/chapter05.html
[cx36]: https://pmc.ncbi.nlm.nih.gov/articles/PMC10008584/
[ach]: https://www.ncbi.nlm.nih.gov/books/NBK11143/
[glutamate]: https://www.ncbi.nlm.nih.gov/books/NBK62187/
[short-term]: https://pubmed.ncbi.nlm.nih.gov/11826273/
[chem-glu]: https://pubchem.ncbi.nlm.nih.gov/compound/33032
[chem-gaba]: https://pubchem.ncbi.nlm.nih.gov/compound/119
[chem-da]: https://pubchem.ncbi.nlm.nih.gov/compound/681
[chem-5ht]: https://pubchem.ncbi.nlm.nih.gov/compound/5202
[chem-ach]: https://pubchem.ncbi.nlm.nih.gov/compound/187
[chem-ne]: https://pubchem.ncbi.nlm.nih.gov/compound/439260
[chem-gly]: https://pubchem.ncbi.nlm.nih.gov/compound/750
[chem-his]: https://pubchem.ncbi.nlm.nih.gov/compound/774
[peptides]: https://www.ncbi.nlm.nih.gov/books/NBK28247/
[nav]: https://www.rcsb.org/structure/6J8J
[kv]: https://www.rcsb.org/structure/2R9R
[cav]: https://www.rcsb.org/structure/7MIY
[ampa]: https://www.rcsb.org/structure/3KG2
[nmda]: https://www.rcsb.org/structure/4PE5
[gabaa]: https://www.rcsb.org/structure/6D6T
[plasticity]: https://www.ncbi.nlm.nih.gov/books/NBK3913/
[ltd]: https://www.ncbi.nlm.nih.gov/books/NBK10899/
[stdp]: https://pubmed.ncbi.nlm.nih.gov/9852584/
[scaling]: https://pubmed.ncbi.nlm.nih.gov/9495341/
[memory]: https://www.ncbi.nlm.nih.gov/books/NBK217810/
