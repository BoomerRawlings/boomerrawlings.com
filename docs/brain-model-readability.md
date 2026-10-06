# Axon recognition and distance rendering

## Evidence inspected

- [Arancibia-Cárcamo et al., eLife 2017, Figure 1](https://doi.org/10.7554/eLife.23329): actual confocal node/paranode images and measured node-length variation. Supports short exposed nodes between flanking paranodes; does not support a universal fixed gap or conduction speed.
- [NCMIR / NIH node electron micrograph](https://nigms.nih.gov/image-gallery/3740): actual cross-section inspected; concentric membrane organization and continuous axoplasm. Primary microscopy by Tom Deerinck. Reference images remain outside the repository.
- [Allen Cell Types morphology documentation](https://brain-map.org/support/documentation/cell-types-database-api): reconstructed centerlines, diameter measures, species and incomplete morphology must remain distinct from illustrative additions. Existing measured dendrite asset and all atlas/tract coordinates unchanged.

## Implemented

- Camera fit projects transformed bounds per object, avoiding empty corners introduced by one global box. Existing padding, separation, focus, aspect-ratio and zoom continuity remain.
- Neuron, dendrite and tract axon schematics use a shallow oblique default so their long axes remain visible.
- Neuron internodes follow the curved axon, taper toward short exposed nodes and scale sheath thickness with local axon radius. Initial segment follows the same centerline instead of a detached cone.
- Myelin defaults to complete compact sheaths. Explicit **Whole fiber / Cutaway** choices preserve one continuous axon, shared nodes and glial processes. Internal lamellae are additive close detail; opaque outer surfaces remain at every zoom.
- Myelin and tract axon nodes are shorter than the adjacent internodes. Axons are continuous through each gap. Relative sizes, layer count, spacing and timing remain schematic, not species-specific measurements.
- Spike-timing traces and peak marks are selectable directly or through Structures. Selection seeks the existing clock to the named causal/reversed-order example, preserves play state and supplies qualitative axis interpretation. Both traces remain framed together; selection preserves the mint/blue identity colors.

## Verification

Geometry assertions cover closed whole sheaths, tapered ends, positive short gaps, continuous core, radial channels, curved neuron spans and two selectable timing examples. Renderer checks cover actual clock seeking/clamping, tighter distant-axon fit, default profile views, 270 adjacent zoom boundaries and 282 separated/nested fits. Strict model TypeScript passes. Parent coordinates final browser captures after the shared layout changes.

Visual targets: neuron overview/focus; myelin whole/cutaway at overview and close; measured dendrites; tract Axon & myelin; spike-timing selection. Earlier myelin screenshot exposed aliasing from all nine nested rims; whole-sheath default and additive internal wraps address that specific defect.

First production-preview audit: whole-fiber overview/far, cutaway overview, dendrites, tractography and tract axon passed. Corrective findings: detailed nodal proteins appeared too early; now add at mechanism level. Axon initial segment now meets the rendered basal soma surface. Selecting a timing curve now frames the pair instead of clipping the other spike. Regression assertions cover soma contact and both-trace framing across narrow/wide viewports. Corrective recaptures coordinated by parent.
