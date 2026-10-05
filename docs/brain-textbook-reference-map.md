# Course textbook reference map

2026-10-05. User-supplied course references, inspected for visual recognition and scope. Downloaded originals and rendered figures remain in the external QA folder `qa/textbook-references`, outside the repository. No textbook figure, page, or long passage is embedded in the website.

## Primary course reference

Jamie Ward, *The Student's Guide to Cognitive Neuroscience*, fourth edition, Routledge, 2020. Verified against the supplied PDF's title/copyright pages and internal metadata. Print ISBNs 978-1-138-49052-9 and 978-1-138-49054-3; ebook ISBN 978-1-351-03518-7. The PDF contains 539 pages; printed page 20 is PDF page 33.

Public publisher reference: [Routledge's verified fourth-edition companion site](https://routledgetextbooks.com/textbooks/9781138490543/). Its edition label matches the supplied PDF.

The table of contents and preface establish a cognitive-neuroscience focus: a compact anatomical introduction, methods chapters, then vision, hearing, attention, action, memory, language, reading, number processing, executive functions, and social/emotional cognition. The existing 50 topics provide foundational neuroanatomy and cellular mechanisms; they should not be represented as complete coverage of this course text.

### Figures actually inspected

Fourteen full PDF pages rendered and visually inspected. Page numbers below are printed page numbers; the private audit filenames use PDF page numbers.

| Printed page; chapter/figure | Visible convention | Site topic mapping / practical consequence |
| --- | --- | --- |
| 20; Chapter 2, Figure 2.1 | Branching dendrites and soma distinguishable from the long myelinated axon, nodal gaps and terminal arbor. | `neuron`, `dendrites`, `myelin`: preserve whole-cell relationships before molecular detail. |
| 25; Figures 2.4–2.5 | Association, commissural and projection fiber classes; ventricular cavities in front/side views. | `white-matter`, `corpus-callosum`, `association-fibers`, `thalamus`, `hypothalamus`: keep anatomical context and classify cavities as CSF space. |
| 27; Figures 2.6–2.7 | Anatomical hierarchy and labeled superior/inferior/anterior/posterior axes. | `brain-overview`, `brainstem`: orient the displayed structure explicitly; screen position alone is insufficient. |
| 28; Figure 2.8 | Sagittal, coronal and horizontal/axial section planes. | Deep anatomy: name the section/view and distinguish a section from an exterior or a removed hemisphere. |
| 28–29; cortical maps next to Figures 2.9–2.10 captions | Lateral and medial cortical views; named gyri and a separate numbered Brodmann map. | `cerebral-cortex`: gyri/sulci, cytoarchitectonic areas, functions and connectivity are distinct classification systems. Do not imply a numbered area can be identified from color alone. See source discrepancy below. |
| 30; Figure 2.11 | Caudate curvature, putamen lateral to pallidum, deep location within a hemisphere. | `basal-ganglia`: contrast anatomical layout with the signed circuit representation. |
| 31; Figures 2.12–2.13 | Medial limbic relationships and a ventral brain view containing chiasm, hypothalamic region and brainstem. | `hippocampus`, `amygdala`, `hypothalamus`, `brainstem`: use neighboring structures and a stated view. A functional grouping is not a discrete physical lobe boundary. |
| 32; Figure 2.14 | Coronal relationships of ventricles, deep nuclei and white matter. | `thalamus`, `hypothalamus`, `amygdala`, `basal-ganglia`: retain whole-section context; isolated outlines are weak recognition cues. |
| 33; Figure 2.15 | Dorsal brainstem, colliculi, peduncles and partly exposed cerebellum. | `brainstem`, `cerebellum`: ventral pons and dorsal colliculi require different views. |
| 146; Chapter 7, Figure 7.4 | Retina → chiasm/tract → LGN → optic radiation → visual cortex, with hemispheric/visual-field relationships. | `optic-radiation`: identify it as the post-LGN segment; it does not cross at the optic chiasm. |
| 236; Chapter 10, Figure 10.2 | Lateral/medial motor and prefrontal territories; M1/BA4, premotor/BA6 and medial SMA. | `corticospinal`, `cerebral-cortex`: course recognition needs named cortical landmarks, not only lobe colors. |
| 259; Chapter 10, Figure 10.23 | Basal-ganglia and cerebellar loops through thalamus, distinguished from the descending motor output. | `basal-ganglia`, `cerebellar-circuit`: do not draw a continuous descending axon through a relay diagram. |
| 282; Chapter 11, Figure 11.15 | Coronal medial temporal anatomy with hippocampus, rhinal sulcus and surrounding entorhinal/perirhinal/parahippocampal territories. | `hippocampus`, `hippocampal-circuit`, `memory-consolidation`: distinguish gross medial-temporal location from microscopic CA/DG circuitry. |
| 388; Chapter 15, Figure 15.2 | Lateral, medial and orbital prefrontal views; anterior cingulate and pre-SMA context. | A future cognitive-network expansion should preserve these anatomical distinctions and avoid assigning one cognitive function to one isolated colored patch. |

### Source discrepancies checked rather than copied

- On printed pages 28–29, the visible figures and the Figure 2.9/2.10 captions appear transposed: page 28 contains a numbered Brodmann map; page 29 contains named gyri. References above specify both page and visible content.
- Printed page 30 assigns the primary motor cortex to BA6; Figure 10.2 on page 236 identifies it as BA4. Retain BA4 for primary motor cortex, with premotor/SMA in BA6; do not propagate the earlier inconsistency.
- The named-gyri map uses “medial temporal gyrus” where the lateral temporal series ordinarily uses *middle temporal gyrus*. Use the standard middle temporal gyrus label, supported by the independent anatomical references in `brain-visual-recognition.md`.

### Highest course-alignment gaps

These are scope findings, not unimplemented promises in the present visual update:

1. Methods and inference: EEG/ERP/MEG, structural versus functional imaging, lesion dissociations and stimulation (Chapters 3–5).
2. Cortical recognition: lateral/medial/inferior views; precentral/postcentral, superior/middle/inferior temporal, angular/supramarginal, cingulate and prefrontal subdivisions.
3. Cognitive systems: dorsal/ventral visual pathways; attention, auditory/language and executive networks; behavioral measures paired with neural evidence.
4. Memory systems: hippocampal versus surrounding medial-temporal anatomy and different memory tasks, kept separate from synaptic plasticity mechanisms.

The current recognition dataset already uses standard planes, neighboring structures and representation caveats. Molecular/protein detail remains supplementary to the stated Cognitive Neuroscience course.

## Companion cognition reference

Daniel Reisberg, *Cognition: Exploring the Science of the Mind*, eighth edition, W. W. Norton. Edition verified in the supplied EPUB's preface; copyright page says 2022. The package metadata says 2021 and has a November 2021 modification date; that packaging date is not used to override the copyright page. EPUB ISBN 9780393877403; source ISBN 9780393877236.

Actual Chapter 2 image pixels inspected independently by two agents:

| Figure / internal image ID | Visible convention | Site mapping |
| --- | --- | --- |
| Figure 2.2A, `Ch02fig02a.jpg` | Head profile fixes anterior/posterior; lobes, central fissure, lateral fissure and cerebellum labeled. | `brain-overview`, `cerebral-cortex`, `cerebellum`: standard lateral view and fissure/sulcus synonyms. |
| Figure 2.5, `Ch02fig05.jpg` | Medial context shows cingulate cortex, fornix, thalamus, hypothalamus, hippocampus, amygdala and mammillary body. | Deep-region topics: preserve relative positions and surrounding hemisphere; a cingulate highlight is a useful course-recognition priority if a verified source boundary is available. |
| Figure 2.12, `Ch02fig12.jpg` | Whole neuron with soma, nucleus, branching dendrites, separate myelinated axon, nodes and terminals. | `neuron`, `dendrites`, `myelin`: maintain recognizable compartments. |
| Figure 2.13A–D, `Ch02fig13ad.jpg` | Nested whole-neuron → bouton → cleft/vesicle → postsynaptic-channel views. | `synaptic-release`: retain where the close-up belongs. Its generic transmitter/receptor symbols illustrate a mechanism; they are not chemical structures. |
| Unnumbered MRI images, `Ch02Unfig03a.jpg`–`03c.jpg` | Axial, coronal and sagittal sections; visible skull/cortex/ventricle context. | Explain the image plane and anatomical direction. The example's false colors are display choices, not tissue identity or measured functional activation. |

These examples support the same recognition priorities as Ward: spatial context and standard views first, microscopic mechanisms second. No distinctive molecular identity can be inferred from the generic synapse symbols.

## Dataset integration

- Added optional `reading: string[]` to 22 directly relevant `recognition.js` entries. Citations specify the verified edition and page or figure; context-only figures are identified as such.
- Kept all 50 topic IDs and 150 visual cues. One terminology adjustment adds “central fissure” as a synonym for central sulcus, matching Reisberg's displayed label.
- No private Drive URLs, downloaded books, extracted figures or long text passages in public assets.
- The remaining 28 entries have no invented textbook citation. Their existing authoritative references remain available.
