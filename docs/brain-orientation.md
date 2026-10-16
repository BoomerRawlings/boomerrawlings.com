# Brain orientation correction

## Coordinate contract

The Allen and HCP JSON assets store X=anatomical right, Y=superior,
Z=anterior. Reordering RAS to R,S,A swaps two axes and reverses handedness.
Using these coordinates directly in Three.js made an anterior view place the
specimen's right hemisphere on screen-right.

`buildMacroScene` now reflects its disposable scene group's X axis **after**
constructing source-space bounds, labels and separation offsets. The display
world is X=left, Y=superior, Z=anterior. Camera directions and the compass use
the same conversion. MRI planes and tracts move together. Source vertices,
hemisphere IDs, source-coordinate metadata and registrations are unchanged.

The axon teaching representation cancels this transform. Cellular, circuit
and molecular scenes retain model axes. New scene groups prevent a transform
from carrying into a later topic.

## Terminology

- Anatomical left/right belongs to the specimen, regardless of viewing angle.
- Medial means toward the midline; lateral means away from it. A lateral camera
  can reveal the opposite hemisphere's medial surface in the cutaway.
- Cerebrum: dorsal=superior, ventral=inferior; anterior/posterior point toward
  the face/back. Brainstem: dorsal=posterior, ventral=anterior;
  rostral/caudal point toward the brain/spinal cord.
- The camera menu adapts for the brainstem. The compass retains fixed S/I/A/P
  labels so mixed whole-brain views do not apply one dorsal axis everywhere.

References: [Michigan State University, Anatomical Terminology](https://openbooks.lib.msu.edu/neuroscience/chapter/anatomical-terminology/)
and [UTHealth McGovern, Organization of the Nervous System](https://nba.uth.tmc.edu/neuroscience/s2/chapter01.html).

## Verification

The scene regression suite checks labeled hemispheres projected through an
anterior camera, all macro camera directions and the unreflected axon/micro
representations. Continuity tests cover compass projection, all six view presets,
model axes and superior/inferior orientation with anterior toward the top.
The regional separation test compares directions in display coordinates.

Focused Microsoft Edge checks cover the anterior hemisphere label, six presets,
medial cutaway, brainstem menu, tract/MRI context, axon and neuron model axes,
and 390/320px layouts with the explanation open. Screenshots and browser reports
are retained in the task's external `qa` folder, outside the public website.
