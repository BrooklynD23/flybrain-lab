# RESEARCH-03 — Licences and citations

Checked 2026-10-14. The app is a **non-commercial demo**. The in-app attribution panel lists every row of table 1 that the build actually uses.

## 1. Data and code we use

| Source | Licence | Obligation for us | Required citation | Link |
|---|---|---|---|---|
| FlyWire data (meshes, annotations, Codex) | CC BY-NC 4.0 | Attribution; no commercial use; mesh re-hosting rule UNVERIFIED → [HUMAN-04](HUMAN-04-flywire-licence-email.md) | Dorkenwald et al. (2024) Neuronal wiring diagram of an adult brain. *Nature*. doi:10.1038/s41586-024-07558-y; Schlegel et al. (2024) Whole-brain annotation and multi-connectome cell typing of *Drosophila*. *Nature* (doi UNVERIFIED) | https://flywire.ai/tos , https://flywire.ai/guidelines |
| FlyWire connectivity release (Zenodo 10676866, v783) | CC BY 4.0 (record page) | Attribution; cite DOI. Used for neuropil counts and the point-cloud fallback | Cite Dorkenwald et al. 2024 and the Zenodo record | https://zenodo.org/records/10676866 |
| flywire_annotations TSV | Not stated on README (UNVERIFIED) | Treat as CC BY-NC 4.0 with FlyWire data; confirm in HUMAN-04 | Schlegel et al. 2024 | https://github.com/flyconnectome/flywire_annotations |
| Shiu et al. brain model code | MIT | Keep copyright notice if redistributed (we fetch, not vendor) | Shiu et al. (2024) A *Drosophila* computational brain model reveals sensorimotor processing. *Nature*. https://www.nature.com/articles/s41586-024-07763-9 ; preprint doi:10.1101/2023.05.02.539144 | https://github.com/philshiu/Drosophila_brain_model |
| Shiu raw outputs (not used) | see record | — | doi:10.17617/3.CZODIW | https://doi.org/10.17617/3.CZODIW |
| flybody model, meshes, datasets | Apache-2.0 | Include licence + NOTICE text in attribution; state changes (decimated meshes, re-exported glTF) | Vaxenburg et al. (2025) Whole-body physics simulation of fruit fly locomotion. *Nature* 643. doi:10.1038/s41586-025-09029-4 | https://github.com/TuragaLab/flybody |
| MuJoCo | Apache-2.0 | Attribution in panel | Todorov, Erez, Tassa (2012) MuJoCo: A physics engine for model-based control. IROS. doi:10.1109/IROS.2012.6386109 | https://github.com/google-deepmind/mujoco |
| Brian2 (Shiu step only; not distributed) | CeCILL-2.1 (GPL-compatible) | None for outputs; cite | Stimberg, Brette, Goodman (2019) Brian 2, an intuitive and efficient neural simulator. *eLife* 8:e47314. doi:10.7554/eLife.47314 | https://github.com/brian-team/brian2 |
| three.js, React, r3f, drei, zod, Vite | MIT | Licences in bundle comments (Vite keeps them) | — | https://threejs.org |

## 2. Considered, not used

| Source | Licence | Note | Required citation if ever used | Link |
|---|---|---|---|---|
| FlyGym / NeuroMechFly v2 | Apache-2.0 | Not used in MVP | Wang-Chen et al. (2024) NeuroMechFly v2. *Nature Methods* (doi UNVERIFIED) | https://github.com/NeLy-EPFL/flygym |
| flyvis | MIT | Not used | Lappalainen et al. (2024) *Nature*. doi:10.1038/s41586-024-07939-3 | https://github.com/TuragaLab/flyvis |
| MANC | CC BY 4.0 | Stretch only | MANC eLife papers 97769 / 97766 / 96084 | https://www.janelia.org/project-team/flyem/manc-connectome |
| Eon Systems fly-brain | GPL-2.0-or-later | **Do not vendor or copy code** (copyleft would bind our repo) | Cite repo + Shiu et al. | https://github.com/eonsystemspbc/fly-brain |
| JRC2018 brain templates (VFB) | CC BY-NC-SA 4.0 | Avoid: share-alike would bind our assets | Bogovic et al. 2020 (UNVERIFIED) | https://www.virtualflybrain.org/term/jrc2018unisex-vfb_00101567 |
| BANC | UNVERIFIED | Not used | bioRxiv doi:10.1101/2025.07.31.667571 | https://codex.flywire.ai/?dataset=banc |

## 3. Behavior-stimulus references (shown in narration and manifest)

| Behavior | Reference | Status |
|---|---|---|
| Feeding | Shiu et al. 2024 (sugar GRNs → MN9) | Verified in repo `example.ipynb` |
| Grooming | Shiu et al. 2024 (antennal grooming via JO neurons) | Exact neuron set UNVERIFIED |
| Walking | Bidaye et al. 2020, P9 descending neurons, *Neuron* | Assumption; citation details UNVERIFIED |
| Escape | von Reyn et al. 2014 (giant fiber), Ache et al. 2019 (LPLC2) | Assumption; citation details UNVERIFIED |

## 4. Licence conflict resolved

Earlier notes (E3) called FlyWire data CC BY 4.0. Both are true for different parts: the Zenodo connectivity record is CC BY 4.0, while FlyWire's terms put the broader dataset (meshes, annotations) under CC BY-NC 4.0. Because we show meshes and annotations, the whole app is treated as **CC BY-NC: non-commercial only**.

## 5. Attribution panel text (minimum)

"Non-commercial demo. Brain data: FlyWire (Dorkenwald et al. 2024; Schlegel et al. 2024), CC BY-NC 4.0. Brain activity: simulated with the Shiu et al. 2024 model (MIT), assumed neurotransmitter signs; walking and escape stimuli are our assumptions. Fly body: flybody (Vaxenburg et al. 2025, Apache-2.0), meshes simplified; grooming and feeding motions are keyframed. Physics: MuJoCo (Apache-2.0)."
