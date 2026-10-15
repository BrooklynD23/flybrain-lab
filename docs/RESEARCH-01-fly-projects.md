# RESEARCH-01 — Fly brain and body projects

Checked 2026-10-14 (web fetch, PyPI, DeepWiki). UNVERIFIED = not confirmed from a primary source; code treats these as parameters.

## 1. Sources we use

| Project | Version | Licence | What we take | Links |
|---|---|---|---|---|
| FlyWire FAFB connectome | public release v783 | CC BY 4.0 (Zenodo connectivity) / CC BY-NC 4.0 (FlyWire data overall) — see [RESEARCH-03](RESEARCH-03-licences-citations.md) | Neuropil ids, per-neuron neuropil counts, neuropil meshes, neuron skeletons | https://flywire.ai , https://zenodo.org/records/10676866 , https://codex.flywire.ai/api/download |
| Zenodo 10676866 "FlyWire Whole-brain Connectome Connectivity Data" | 783.0 (2024-06-02) | CC BY 4.0 (record page) | `per_neuron_neuropil_count_post_783.feather` (233.8 MB), `proofread_root_ids_783.npy` (1.1 MB); optional `flywire_synapses_783.feather` (9.5 GB) for point clouds | https://zenodo.org/records/10676866 |
| flyconnectome/flywire_annotations | for v783 | not stated on README (UNVERIFIED; check LICENSE) | `supplemental_files/Supplemental_file1_neuron_annotations.tsv` (cell_type, super_class, side ...) | https://github.com/flyconnectome/flywire_annotations |
| fafbseg-py | 3.2.2 | see repo | Token setup; `get_mesh_neuron`; `get_neuropil_volumes` and `get_skeletons` appear in API docs (auth needs for v783 UNVERIFIED) | https://fafbseg-py.readthedocs.io/en/latest/source/tutorials/flywire_setup.html , https://fafbseg-py.readthedocs.io/en/latest/source/generated/fafbseg.flywire.get_mesh_neuron.html |
| Shiu et al. LIF brain model | GitHub `philshiu/Drosophila_brain_model` (pin commit SHA in WAVE-06) | MIT | `run_exp(exp_name, neu_exc, neu_slnc, ...)`; `Completeness_783.csv`, `Connectivity_783.parquet` in repo; output parquet columns `t` (ms), `trial`, `flywire_id`, `exp_name`; defaults `r_poi` 150 Hz, `t_run` 1000 ms, `n_run` 30; `neu_sugar` list and MN9 = `720575940660219265` in `example.ipynb` | https://github.com/philshiu/Drosophila_brain_model , [DeepWiki answer](https://app.devin.ai/search/api_40167714-77ed-49a3-83ce-874ca43f88a7) |
| flybody (TuragaLab) | GitHub; install docs use Python 3.10 | Apache-2.0 | `flybody/fruitfly/assets/fruitfly.xml` + 85 `.obj` meshes; joints incl. `rostrum`, `haustellum`, `labrum_left/right`, `antenna_*`, `coxa/femur/tibia/tarsus*_T{1,2,3}_{left,right}`; figshare `walking-imitation-dataset`, `flight-imitation-dataset`, `trained-policies` | https://github.com/TuragaLab/flybody , [DeepWiki answer](https://app.devin.ai/search/api_fab55cdb-e5f3-4fb7-9ec0-06387bfb7fe3) |
| MuJoCo (Python) | 3.16.0 (2026-10-14), py ≥ 3.10 | Apache-2.0 | `MjModel.from_xml_path`, `mj_kinematics`, `data.xpos`/`xquat` (quat order w,x,y,z) | https://pypi.org/project/mujoco/ , https://mujoco.readthedocs.io/en/stable/python.html |

## 2. Considered, not used in MVP

| Project | Version | Licence | Why not | Link |
|---|---|---|---|---|
| FlyGym / NeuroMechFly v2 | 2.1.0 (2026-06-24), py ≥ 3.12 | Apache-2.0 | Walking documented; grooming not documented in 2.x; no flight; mesh export UNVERIFIED | https://pypi.org/project/flygym/ , https://github.com/NeLy-EPFL/flygym |
| flyvis | 1.2.0 | MIT | Visual system only; not needed for 4 behaviors | https://github.com/TuragaLab/flyvis |
| MANC (VNC) | v1.2.1 | CC BY 4.0 | VNC, not brain; possible stretch for motor activity | https://www.janelia.org/project-team/flyem/manc-connectome |
| BANC | v888 (May 2026) | UNVERIFIED | Licence unknown | https://codex.flywire.ai/?dataset=banc |
| Eon Systems fly-brain | repo | GPL-2.0-or-later | Copyleft; embodied demo code not public; reference only, do not vendor | https://github.com/eonsystemspbc/fly-brain |
| VFB JRC2018 templates | current | CC BY-NC-SA 4.0 | Share-alike; FlyWire neuropils cover our need | https://www.virtualflybrain.org/term/jrc2018unisex-vfb_00101567 |
| MuJoCo WASM `@mujoco/mujoco` | README marks WIP | Apache-2.0 | Second physics runtime in the browser; we only replay poses | https://github.com/google-deepmind/mujoco/tree/main/wasm |

## 3. Body simulator decision: flybody

| Criterion | flybody | FlyGym 2.1 |
|---|---|---|
| Walking | Walking-imitation dataset + RL task | Documented |
| Flight (escape) | Flight-imitation dataset + RL task | Not available |
| Grooming / feeding joints | Antenna, foreleg and proboscis joints in MJCF | Grooming not documented in 2.x |
| What we need from it | Only MJCF + meshes + HDF5 datasets, loaded with plain `mujoco` in our py3.12 env | Whole package |
| Python | Package docs use 3.10, but we never import the package | ≥ 3.12 |

Choice: flybody assets, no flybody package, no TensorFlow, no RL rollouts. Clip sources: walking and escape = **reference replay** of recorded kinematics (imitation datasets) through `mj_kinematics`; grooming and feeding = **keyframed** joint angles. Physics-policy rollouts are a stretch. This removes the Python 3.10 conflict for the body; only the Shiu step keeps its own 3.10 env.

## 4. Stimulus sets (brain activity per behavior)

| Behavior | Activated neurons | Status | Source |
|---|---|---|---|
| Feeding | `neu_sugar` sugar GRNs (list in `example.ipynb`), readout MN9 | From the paper's own example | https://github.com/philshiu/Drosophila_brain_model |
| Grooming | Johnston's organ JO-C/JO-E mechanosensory neurons | Paper topic (antennal grooming), exact set UNVERIFIED | Shiu et al. 2024, https://www.nature.com/articles/s41586-024-07763-9 |
| Walking | P9 descending neurons | **Assumption** (not a Shiu experiment) | Bidaye et al. 2020 (UNVERIFIED citation details) |
| Escape | LC4 + LPLC2 looming detectors (upstream of giant fiber) | **Assumption** | von Reyn et al. 2014; Ache et al. 2019 (UNVERIFIED citation details) |

Runtime: ≈ 58–65 s wall per simulated second on 2 CPUs ([shaduf](https://shaduf.ai/p/digital-fly-catalog/projects/shiu-drosophila-brain-model/)). Our setting `t_run` 4000 ms × `n_run` 5 ≈ 20 sim-seconds per behavior.

## Unverified

| # | Item | Checked in |
|---|---|---|
| 1 | flybody imitation HDF5 dataset keys, fps, qpos layout | HUMAN-05 step 3 |
| 2 | `fruitfly.xml` compiles on mujoco 3.16.0 (else pin flybody's version) | WAVE-07 / HUMAN-05 |
| 3 | `fafbseg.flywire.get_neuropil_volumes` / `get_skeletons` names and whether v783 needs a token | HUMAN-05 step 5 |
| 4 | Annotation TSV and neuropil-count column names | HUMAN-05 step 3 |
| 5 | Exact JO-C/JO-E set used by Shiu et al. for grooming | HUMAN-05, `figures.ipynb` |
| 6 | Shiu code runs with its pinned Brian2 on Python 3.10 via uv (repo uses conda) | WAVE-06 T06.3 |
| 7 | flywire_annotations licence | HUMAN-04 |
