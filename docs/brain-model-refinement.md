# Brain model refinement

Research and structural verification: 2026-10-05. This document distinguishes references, implemented representations, and inspection evidence. A reference animation is inspiration, not permission to copy its artwork or movie.

## Verification status

- **Structural pass:** all 50 curriculum topics built using the production Three.js scene builders. The test exercised 3,964 animation/detail/separation states, four levels of detail, and 35 local assets. Positions, geometry attributes, indices, transforms, instance matrices, materials, scene visibility, semantic destinations, and microscopic narrative timing passed.
- **Variant evidence:** geometry and semantic fingerprints differ for every topic within its scale: brain 8, tracts 6, circuits 4, cells 6, synapses 5, molecules 9, channels 6, plasticity 6. Fingerprints are reported, not frozen snapshots; distinct hashes alone do not establish scientific or visual quality.
- **Baseline visual evidence:** four correctly identified earlier views were inspected: cerebral cortex, hypothalamus, amygdala, brainstem. The earlier cortex showed severe facets, spikes and gaps resembling tears; deep structures were difficult to read inside the translucent shell. Later batch captures lagged topic selection and were rejected. There is no valid claim that all 50 baseline views were visually audited.
- **Visual pass: all 50 topics inspected in overview and close detail (100 settled screenshots), with affected views recaptured after fixes.** Resolved findings include cerebral/cerebellar exterior continuity, deep-region isolation, optic-radiation framing, electrical-synapse scale/camera/occlusion, three receptor-detail centers, and structural-plasticity focus. Additional thalamic, hypothalamic and hippocampal mechanism captures pass after inset scaling and removal of occluding context. The macro and micro audits report no remaining blocking rendering/framing defect in these captured states. Browser interaction/mobile checks are separate evidence; this does not certify every possible camera orientation.

Run `node scripts/test-brain-scenes.mjs` for structural checks. It bundles the actual builders into ignored `.astro/brain-scene-check.mjs`, substitutes local files for network fetches, disposes each scene, and writes `.astro/brain-scene-report.json`. The package test chain also runs the separate model-data, micro-asset and study-content validators. This is a pure Three.js test, without browser automation.

## References and design decisions by scale

### Brain anatomy

The [Allen Human Reference Atlas 3D 2020](https://download.alleninstitute.org/informatics-archive/allen_human_reference_atlas_3d_2020/version_1/) supplies the human labeled volume under CC BY 4.0. [BigBrain](https://bigbrainproject.org/about.html) and its [surface/section tools](https://bigbrainproject.org/tools-and-services.html) offer an independent high-resolution histological reference for folds, sections, and progression toward cellular scales. BigBrain assets were reference material; individual download terms need review before reuse.

The implemented Allen-derived hemispheres use a continuous cerebral envelope instead of displaying cortical-ribbon interior walls. The cerebellar envelope similarly includes gray and white matter, avoiding exposed ribbon walls; its source parcellation does not resolve detailed folia. Source-relative coordinates, left/right identity, subcortical structures and approximate lobe assignments remain explicit. These envelopes approximate external anatomy; they are not subject-specific cortical reconstructions. Exterior → selected deep region → circuit inset → axon inset provides scale progression. Close-up insets are enlarged teaching schematics, not structures resolved by the atlas. Visual acceptance requires smooth fold continuity without spike-like faces, coincident transparent surfaces, or accidental holes.

### White matter

The [HCP1065 population tractography atlas](https://brain.labsolver.org/hcp_trk_atlas.html) supplies the implemented named bundles, with CC BY-SA 4.0 and HCP acknowledgment/data-use terms recorded in the manifest. [FSL XTRACT](https://fsl.fmrib.ox.ac.uk/fsl/docs/diffusion/xtract.html) and the [FSL/JHU atlas documentation](https://fsl.fmrib.ox.ac.uk/fsl/docs/other/datasets.html) supply independent guidance on bundle definitions and the distinction between labeled tissue and probabilistic pathways. FSL data were not copied.

The local derivative contains 25 bundles and 8,900 sampled streamlines. Route-specific views retain fanning, bilateral organization and characteristic curves. These are diffusion-derived candidate pathways, not directly observed axons, axon counts, or measurements of signaling direction. Allen anatomy and HCP tractography use different MNI templates; their co-display is contextual, not exact registration.

Crossing mechanisms need separate educational context: corticospinal decussation is in the caudal medulla; dorsal-column afferents ascend ipsilaterally before the gracile/cuneate relay and internal arcuate crossing; optic radiation runs from the ipsilateral LGN, with chiasmal crossing upstream. The medial-lemniscus data do not reconstruct a complete spinal dorsal column. Static tractography has no fabricated biological timeline; an enlarged axon inset can illustrate saltatory conduction.

### Circuits

[MICrONS EM reconstruction documentation](https://tutorial.microns-explorer.org/em_01_background.html) and its [mesh/skeleton access guide](https://tutorial.microns-explorer.org/faq.html) inform dense arbors and cell-specific contacts. These are mouse visual-cortex data, not a human whole-brain circuit map. [UTHealth hippocampal anatomy](https://nba.uth.tmc.edu/neuroscience/s4/chapter05.html) and [cerebellar circuitry](https://nba.uth.tmc.edu/neuroscience/s3/chapter05.html) support the named pathways and differing cell forms.

The four original circuit scenes have different topology: cortical laminae and inhibition; striatum/GPe/STN/GPi-SNr pathways; dentate/CA3/CA1 routes with CA3 recurrence; and granule/parallel/climbing/Purkinje organization. Excitatory, inhibitory and modulatory relationships need distinguishable encodings. Animated particles illustrate event order rather than recorded activity, and generic neuron shapes remain teaching abstractions.

### Cells and membrane signals

The [Allen Cell Types API](https://brain-map.org/support/documentation/cell-types-database-api) and [morphology documentation](https://brain-map.org/support/documentation/documentation-cell-types-database) support faithful SWC parentage, radii, and specimen provenance. [NeuroMorpho](https://neuromorpho.org/neuroMorpho/) and its [viewer guide](https://www.neuromorpho.org/main_help.jsp) provide independent reference forms across cell types and species; archive-specific rights must be checked before copying a reconstruction.

The implemented measured arbor is [Allen mouse visual-cortex Cux2 specimen 485909730](https://celltypes.brain-map.org/experiment/morphology/485909730), not a human neuron. Its local metadata records the Allen noncommercial attribution terms. The source reconstruction contains dendrites; added spines and axonal features are separately described teaching overlays.

Cell scenes distinguish branched neuronal arbors, dendritic contacts, myelin lamellae/nodes, astrocytic endfeet/uptake, and ramified microglial surveillance. The resting-potential scene shows a bilayer, unequal ion pools, selective permeability and a 3Na/2K pumping cycle. Particle counts are illustrative; resting voltage is not created solely by a directly animated pump or a universal fixed concentration ratio.

### Synapses

[HHMI's Molecular Mechanism of Synaptic Function](https://www.biointeractive.org/classroom-resources/molecular-mechanism-synaptic-function) informs temporal staging and spatial relationships. [RCSB 5CCG](https://www.rcsb.org/structure/5CCG), the rat synaptotagmin–SNARE experimental complex, provides an independent molecular reference. RCSB coordinates have [CC0 usage terms](https://www.rcsb.org/pages/usage-policy); the HHMI movie has its own copying terms and was not embedded or reproduced.

Original scenes distinguish docking/fusion/release, spatial and temporal integration, paired connexons, transporter versus enzymatic clearance, and facilitation versus vesicle depletion. Calcium entry precedes the illustrated chemical-release event. Electrical synapses use a pore between paired membranes rather than vesicles. Clearance must not treat acetylcholinesterase hydrolysis as a glutamate transporter. Postsynaptic ion movement and a local potential change are not automatically a new action potential.

### Neurotransmitters and chemical structure

[PubChem dopamine CID 681](https://pubchem.ncbi.nlm.nih.gov/compound/Dopamine) illustrates the identity/connectivity/conformer records used for the eight small molecules. [ChEBI downloads](https://www.ebi.ac.uk/chebi/downloads) and [curation tools](https://www.ebi.ac.uk/chebi/tools) provide an independent reference for names, classes and charges. The dopamine-bound [human D1 receptor complex, EMDB 31404](https://www.ebi.ac.uk/emdb/EMD-31404), with [PDB 7F0T](https://www.rcsb.org/structure/7F0T), shows the transmitter-to-receptor scale relationship; it was a design reference rather than a shipped binding model.

Implemented ball-and-stick models retain explicit hydrogens, bond orders and record formal charges. They are calculated PubChem conformers, not experimental bound structures or a molecule's permanent shape. Charge/protonation follows the supplied record and is not asserted to represent every physiological microenvironment. Distinct catechol, indole, imidazole, amino-acid and quaternary-ammonium features should be recognizable. The neuropeptide scene uses a Met-enkephalin sequence/backbone abstraction and must not claim an experimentally measured peptide conformation.

### Channels and receptors

Six distinct experimental entries support six channel views: [Nav1.7 6J8J](https://www.rcsb.org/structure/6J8J), [Kv1.2/Kv2.1 chimera 2R9R](https://www.rcsb.org/structure/2R9R), [CaV2.2 7MIY](https://www.rcsb.org/structure/7MIY), [GluA2 AMPA 3KG2](https://www.rcsb.org/structure/3KG2), [GluN1a/GluN2B NMDA 4PE5](https://www.rcsb.org/structure/4PE5), and [GABA-A α1β2γ2 6D6T](https://www.rcsb.org/structure/6D6T). [PDB-101's sodium-channel explanation](https://pdb101.rcsb.org/motm/243) is an independent mechanism/architecture reference.

Close detail displays Cα traces from selected experimental chains/biological assemblies. Missing residues remain gaps; omitted side chains, lipids, ligands and unresolved parts are not invented. Species, engineered constructs and auxiliary subunits matter: the Kv entry is a rat chimera; AMPA and NMDA entries are rat constructs; the GABA-A source includes antibody fragments excluded from the receptor display. Deposited axes do not automatically establish membrane orientation.

Overview gating is explicitly schematic. A static experimental trace is not a molecular-dynamics trajectory. Sodium activation and inactivation are separate states; NMDA magnesium block differs from Nav voltage sensing; AMPA/NMDA tetramers differ from GABA-A pentamers. Ion direction depends on gradients and voltage; the illustrated sodium/calcium inward and potassium outward currents are chosen conditions, not universal channel properties.

### Plasticity and memory

[HHMI's archived early-LTP animation](https://www.biointeractive.org/classroom-resources/molecular-basis-early-ltp-shortterm-memory) informs event staging, without adopting a simple equivalence between early LTP and short-term memory. [RCSB 3SOA](https://www.rcsb.org/structure/3SOA) and its [primary CaMKII study](https://pmc.ncbi.nlm.nih.gov/articles/PMC3184253/) inform holoenzyme organization. The crystallographic inhibited construct and its biological assembly must not be presented as a universal active conformation. A [primary spine-plasticity study](https://pmc.ncbi.nlm.nih.gov/articles/PMC2561912/) supports relating induced potentiation to structural change in its experimental context.

Original scenes distinguish LTP receptor delivery/kinase signaling, LTD receptor removal/phosphatase signaling, signed spike timing, synaptic scaling across multiple contacts, spine growth/stabilization/retraction, and hippocampal–cortical consolidation. They are pedagogical mechanisms rather than predictions of exact duration, effect size or memory location. The plasticity CaMKII hub is an authored schematic; the 3SOA reference was not imported as an experimental asset.

## Final visual acceptance checklist

For every topic: verify selected ID after model readiness; inspect default framing, one rotation, a detail transition and an animated state where available. Then inspect representative narrow-screen layouts and pointer/keyboard selection.

1. Topic identity is visible through actual structure, not just a changed caption.
2. Important geometry fits; labels stay readable without covering pores, pathways or controls.
3. No spikes, gaps that mimic tears, z-fighting, stretched bonds, stale geometry, or abrupt clipping.
4. Zoom/detail changes expose relevant evidence; schematic insets state their scale/provenance.
5. Hover/pick destinations match visible structures; hidden structures cannot retain misleading selection.
6. Pause, seek, replay and stage transitions make events inspectable without implying measured timing.
7. Measured atlas, tractography, reconstructed morphology, experimental protein, calculated conformer and teaching schematic remain distinguishable.

The 100-view inventory covers all 50 topics. Macro close-detail captures show the explicitly enlarged axon inset; three additional mechanism captures verify the previously clipped LOD2 circuits. The structural report contains the complete topic list. All reported visual blockers were fixed and the affected captures reinspected. Preserve the distinction between these observed states and untested camera/device combinations when reporting future changes.

## Browser interaction verification

Desktop checks passed for pointer tract selection and dimming, click navigation through corpus callosum→node of Ranvier→sodium channel, all four zoom-dependent target lists, sustained wheel entry, and individual experimental residue readout (LEU297, chain A, 6D6T). Paused stage selection, timeline seeking, selection clearing, and expanded-view keyboard trapping/Escape passed. Logo rotation was verified across separate rendered states. At390px and320px, model framing, expanded controls, topic selection and macro-to-micro detail preservation passed without horizontal overflow. Final browser console had no errors or warnings. Full npm test and strict Brain TypeScript passed; final residue picking refinement was additionally checked in the browser.
