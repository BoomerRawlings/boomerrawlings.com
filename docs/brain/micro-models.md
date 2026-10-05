# Microscopic models: evidence, coordinates and implementation

The six microscopic scene families have 36 individually implemented curriculum variants. `src/scripts/brain/scenes-micro.ts` exports `MICRO_VARIANTS`, the auditable inventory. Scene geometry uses original implementations; no reference animation, illustration, video frame or model mesh was copied.

## Coordinate provenance

| Asset | Source | Representation and limits |
| --- | --- | --- |
| `micro-molecules.json` | [PubChem PUG REST](https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest) | Eight computed conformers, including explicit H atoms, bond orders and record formal charges. A computed conformer is not an experimental ligand-bound structure or a physiological protonation assignment. |
| `micro-neuron.json` | [Allen specimen 485909730](https://celltypes.brain-map.org/experiment/morphology/485909730), [AllenSDK morphology documentation](https://alleninstitute.github.io/AllenSDK/cell_types.html) | 1,925 measured SWC nodes from a mouse visual-cortex Cux2 cell; dendrite-only reconstruction. Node parents and centerlines retained. Rendered radii enlarged; added spines/signals are explicitly schematic. |
| `micro-sodium.json` | [PDB 6J8J](https://www.rcsb.org/structure/6J8J) | Human Naᵥ1.7 complex; alpha and two auxiliary subunits, 1,433 modeled Cα positions. Deposited toxin-bound structure, not a sequence of open/closed states. |
| `micro-potassium.json` | [PDB 2R9R](https://www.rcsb.org/structure/2R9R) | Rat Kv1.2/Kv2.1 paddle chimera plus beta subunits; biological assembly 1, eight chains and 2,848 modeled Cα positions. A chimera, not a generic human potassium channel. |
| `micro-calcium.json` | [PDB 7MIY](https://www.rcsb.org/structure/7MIY) | Human N-type Caᵥ2.2 complex; three selected protein chains and 2,598 Cα positions. |
| `micro-ampa.json` | [PDB 3KG2](https://www.rcsb.org/structure/3KG2) | Rat GluA2 AMPA receptor; four chains, 3,116 Cα positions. One experimental conformation. |
| `micro-nmda.json` | [PDB 4PE5](https://www.rcsb.org/structure/4PE5) | GluN1a/GluN2B NMDA receptor; four selected receptor chains, 2,944 Cα positions. Antibody fragments excluded. |
| `gaba-a-6d6t.json` | [PDB 6D6T](https://www.rcsb.org/structure/6D6T) | Existing α1β2γ2 receptor conformation B asset; five receptor chains and 1,638 Cα positions. |

The PDB traces preserve missing-residue gaps. Experimental groups appear at close inspection and remain undeformed. The mechanistic membrane, gate, ion particles and ligand motion are separate schematic objects hidden at that level; no membrane orientation or gating transition is inferred from unaligned PDB axes.

Finest protein inspection identifies each modeled Cα by deposited residue name, residue number and chain. The five new assets were cross-checked against their exact source PDB coordinates with `scripts/brain/add-protein-residues.mjs`; the existing 6D6T record retains the equivalent residue metadata. Uniform display scaling and a +0.6 display-unit vertical translation for AMPA/NMDA/GABA-A align those proteins with their ligand-scene camera focus; Na/K/Ca display centers remain at zero. Neither changes coordinates relative to one another or geometry during gating. These are presentation transforms, not membrane alignment.

PubChem CIDs: L-glutamic acid 33032; GABA 119; dopamine 681; serotonin 5202; acetylcholine 187; norepinephrine 439260; glycine 750; histamine 774. Acetylcholine carries the record's permanent +1 quaternary-ammonium charge. Other records here are neutral parent structures. The molecular reader explicitly distinguishes this from physiological ionization. Met-enkephalin has an original, extended heavy-atom connectivity model for Tyr–Gly–Gly–Phe–Met; its 3D placement is schematic and hydrogens are omitted.

## Reference-led visual decisions

| Reference | Applied design decision |
| --- | --- |
| [HHMI BioInteractive: Molecular Mechanism of Synaptic Function](https://www.biointeractive.org/classroom-resources/molecular-mechanism-synaptic-function) | Stage the sequence from voltage change to Ca²⁺ entry, vesicle fusion, transmitter diffusion and postsynaptic conductance. Avoid simultaneous decoration with no causal sequence. |
| [PDB-101 / Goodsell: Excitatory and Inhibitory Synapses](https://pdb101.rcsb.org/sci-art/goodsell-gallery/excitatory-and-inhibitory-synapses) | Include vesicle proteins, SNARE bundles, active-zone channels, postsynaptic scaffolds and actin, with fine structures revealed by zoom. |
| [PDB-101: Neurotransmitter Transporters](https://pdb101.rcsb.org/motm/171) | Separate uptake proteins from postsynaptic receptors; illustrate movement out of the cleft toward cellular uptake routes. |
| [PDB-101: Acetylcholinesterase](https://pdb101.rcsb.org/motm/54) | Use an explicitly separate AChE inset in clearance; glutamate uptake is not presented as enzymatic acetylcholine hydrolysis. |
| [PDB-101: Voltage-gated Sodium Channels](https://pdb101.rcsb.org/motm/243) | Build four six-helix repeat domains with charged sensor motifs and a distinct inactivation stage. One α chain is distinguished from four independent subunits. |
| [PDB-101: AMPA Receptor](https://pdb101.rcsb.org/motm/235) | Distinguish extracellular ligand-binding machinery from the transmembrane pore, and show a separate experimental tetramer at close zoom. |
| [Zhu et al. 2018: Structure of a human synaptic GABA-A receptor](https://pmc.ncbi.nlm.nih.gov/articles/PMC6220708/) | GABA-A has five β-rich extracellular domains and four transmembrane helices per subunit. The α1β2γ2 schematic uses two GABA-binding β/α interfaces, without a glutamate-receptor clamshell. |
| [NMDA receptor activation mechanisms](https://www.ncbi.nlm.nih.gov/books/NBK5274/) | The GluN1/GluN2 example carries two glutamate and two co-agonist sites; AMPA/NMDA subunits include three transmembrane helices plus the re-entrant M2 pore loop. |
| [Allen Cell Types and SWC documentation](https://alleninstitute.github.io/AllenSDK/cell_types.html) | Retain measured topology for dendrites; avoid claiming one generic tree represents all neurons. Soma/axon/spine teaching views use separate explicit provenance. |
| [Nimmerjahn et al. 2005, original in-vivo microglial study](https://pubmed.ncbi.nlm.nih.gov/15831717/) | Microglial processes visibly survey tissue; ramification is not treated as a static star or a disease diagnosis. |
| [Purves et al.: Basal Ganglia Circuits](https://www.ncbi.nlm.nih.gov/books/NBK10847/) | D1 and D2 populations, GPi/SNr, GPe, STN and dopaminergic input receive distinct paths and staged explanations. Signs of connections remain visible. |
| [Purves et al.: Molecular Mechanisms Underlying LTP](https://www.ncbi.nlm.nih.gov/books/NBK11101/), [NMDA receptor activation mechanisms](https://www.ncbi.nlm.nih.gov/books/NBK5274/) | NMDA-dependent calcium, downstream signaling and AMPA recruitment are separate stages. The implementation identifies this as one plasticity example. |
| [Lisman et al.: CaMKII action in LTP](https://pmc.ncbi.nlm.nih.gov/articles/PMC4050655/) | Show a kinase hub and receptor trafficking without asserting that one molecule alone stores a memory. |
| [Bi and Poo timing experiments, contextualized in timing-rule history](https://pmc.ncbi.nlm.nih.gov/articles/PMC3187646/) | Contrast pre-before-post and reverse order; qualify the displayed rule as canonical, not universal. |

## Detail and animation contract

- All 36 variants register semantic structures, child-topic connections, detail-level geometry, a finite animation duration and at least three explanation stages.
- Circuits use original neuronal populations and shaped pathways. Positions and pulse timing are schematic; no exact human connectivity or conduction speed is claimed.
- Neuron, glia and myelin geometry includes thin processes, organelles, lamellae or appropriate fine structures. Electrical signal markers are distinguished from axonal transport cargo.
- Electrical synapses use paired hexameric connexons; vesicles and transmitter-cleft release are absent.
- LTP, LTD, timing plasticity, homeostatic scaling, structural remodeling and systems consolidation have separate geometries and causal sequences. Systems consolidation is explicitly modeled at a different scale.
- Molecular coordinates stay fixed apart from rigid display rotation. Approximate translucent atomic envelopes are visual aids, not electron-density maps.
- Animation loops restart demonstrations. A looping reset is not a claim that a lasting biological change automatically reverses.

## Reuse and reproduction

- wwPDB coordinates: [CC0 policies](https://www.rcsb.org/pages/policies); PDB IDs and entry pages retained in every asset.
- Allen cell morphology: [Allen noncommercial terms and attribution](https://alleninstitute.org/legal/terms-of-use), appropriate to this free educational guide. This API morphology is **not** relabeled CC BY; the atlas asset has its own separate license record.
- PubChem coordinate records: source/CID retained; third-party prose or imagery was not imported.
- Run `node scripts/brain/acquire-micro-models.mjs` to explicitly reacquire microscopic coordinate assets. It is not part of the website build and adds no runtime external requests.
- Run `node scripts/verify-brain-micro.mjs` for atom-count/valence/charge/connectivity, PDB chain/continuity, SWC topology and headless Three.js scene/animation checks.
