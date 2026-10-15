# WAVE-06 — Pipeline source adapters (body, brain sim, brain geometry, downloads)
Depends on: WAVE-02
Human prerequisites: none

Every task here is tested with tiny synthetic inputs and mocked network calls. The real downloads and the real brain simulation run later, by a person, in [HUMAN-05](HUMAN-05-real-data-pipeline-run.md). Facts marked UNVERIFIED in [RESEARCH-01](RESEARCH-01-fly-projects.md) must be checked against the real files during HUMAN-05; code takes them as parameters, not hard-coded guesses.

## Tasks
### T06.1 — Body geometry from MJCF
- Files: `pipeline/src/flybrain_pipeline/body_mesh.py`, `pipeline/tests/test_body_mesh.py`
- Do:
  1. `body_meshes(model: mujoco.MjModel, visual_groups: set[int] | None = None) -> dict[str, (verts, faces)]` — for each body, merge its mesh geoms (`geom_type == mjGEOM_MESH`, filtered by `geom_group` when given) using `mesh_vert`/`mesh_face` slices and the geom's local `geom_pos`/`geom_quat`; skip bodies with no visual mesh.
  2. `decimate_to_budget(meshes, max_tris=95_000) -> dict` — allocate triangles per body proportional to current count (min 50), reduce with `fast_simplification.simplify`; return new arrays.
  3. `to_nodes(meshes) -> list[glb.Node]` — one node per body, named by body name, mesh in body-local frame.
- Tests: `pipeline/tests/test_body_mesh.py` — inline MJCF with two bodies and inline `<mesh vertex=... face=...>` assets; geom offset applied; group filter; decimation hits budget and never returns 0 faces for a body; inputs not mutated.
- Acceptance: `uv run --directory pipeline pytest tests/test_body_mesh.py --no-cov`
### T06.2 — Behavior clips: reference replay + keyframes
- Files: `pipeline/src/flybrain_pipeline/body_clips.py`, `pipeline/tests/test_body_clips.py`, `pipeline/config/keyframes.toml`
- Do:
  1. `load_reference_qpos(h5_path, dataset_key, start, n_frames, src_fps, fps=30) -> qpos[T,nq]` — read with `h5py`; resample by linear interpolation (root quaternion slerp); dataset key and fps are parameters (layout UNVERIFIED).
  2. `loop_or_clamp(qpos, n_frames, cyclic: bool)` for clips shorter than the 4000 ms timeline.
  3. `keyframed_qpos(model, keyframes_toml_section)` → `kinematics.interpolate_keyframes`.
  4. `make_clip(model, behavior, qpos, fps, scale) -> glb.Animation` via `kinematics.poses_from_qpos` + `to_gltf_frame`; one track per body node.
  5. `pipeline/config/keyframes.toml` (read with stdlib `tomllib`): `grooming` = front legs (`*_T1_left/right` joints) sweeping over the antennae, head tilt, 4000 ms; `feeding` = proboscis extension via `rostrum`, `haustellum`, `labrum_left/right` joints, two extend/retract cycles. Joint names from flybody `fruitfly.xml` ([RESEARCH-01](RESEARCH-01-fly-projects.md)). Also a `walking_fallback` tripod-gait keyframe set for when the walking dataset cannot be used.
- Tests: `pipeline/tests/test_body_clips.py` — synthetic HDF5 written with `h5py` in tmp; resampling 50 → 30 fps; loop vs clamp; clip has one track per body and 120 frames for 4000 ms; `keyframes.toml` parses, times ascend, each section ≤ 4000 ms.
- Acceptance: `uv run --directory pipeline pytest tests/test_body_clips.py --no-cov`
### T06.3 — Shiu brain-model runner (separate py3.10 env)
- Files: `pipeline/sims/shiu/pyproject.toml`, `pipeline/sims/shiu/uv.lock`, `pipeline/sims/shiu/.python-version`, `pipeline/sims/shiu/run_behaviors.py`, `pipeline/sims/shiu/stimuli.json`, `pipeline/sims/shiu/tests/test_run_behaviors.py`, `pipeline/sims/shiu/tests/data/**`
- Do:
  1. `.python-version` = `3.10`. `pyproject.toml`: deps copied from the Shiu repo `environment.yml` at the pinned commit (Brian2, pandas, pyarrow, joblib versions as pinned there); dev `pytest`, `pytest-cov` (`--cov-fail-under=80`), `ruff`. Record the pinned Shiu commit SHA in `pyproject.toml` `[tool.flybrain] shiu_sha`.
  2. `stimuli.json` (stdlib `json`, no TOML on 3.10): per behavior `{cell_types | root_ids, r_poi_hz: 150, t_run_ms: 4000, n_run: 5, assumption: bool, source: url}`. `feeding` = the `neu_sugar` root ids from Shiu `example.ipynb` (assumption false). `grooming` = Johnston's organ JO-C/JO-E cell types (assumption false, source Shiu et al. 2024; exact set UNVERIFIED). `walking` = `P9` (assumption true, Bidaye et al. 2020). `escape` = `LC4` + `LPLC2` looming detectors upstream of the giant fiber (assumption true).
  3. `run_behaviors.py`: `resolve_ids(spec, annotations_tsv, id_col, type_col) -> list[int]` (unknown cell type → error listing it); `run(behavior, ids, vendor_dir, out_dir, run_exp=None)` imports `model.run_exp` from `vendor/` (cloned by `fetch`), passes the repo's `Completeness_783.csv` and `Connectivity_783.parquet`, writes `<out>/<behavior>.parquet`; `main(argv)` with `--behaviors`, `--n-proc` (default 4). Default paths are hard-coded module constants relative to the script (no TOML reader on 3.10): `VENDOR_DIR = vendor/`, `ANNOTATIONS = ../../data/raw/brain/annotations.tsv`, `OUT_DIR = ../../data/raw/spikes/`, matching the raw layout in [PLAN-01 §2b](PLAN-01-architecture.md#2b-raw-data-layout---raw-default-pipelinedataraw-gitignored); `--out`, `--annotations`, `--vendor` override them.
  4. Tests inject a fake `run_exp`; no Brian2 run in tests.
- Tests: `pipeline/sims/shiu/tests/test_run_behaviors.py` — id resolution from a 6-row fixture TSV; unknown type error; `run` passes ids, `t_run`, `n_run`, `r_poi` and output path to the fake; `stimuli.json` has all 4 behaviors and `assumption` true for walking/escape; the three path constants equal the PLAN-01 §2b strings.
- Acceptance: `uv sync --directory pipeline/sims/shiu && uv run --directory pipeline/sims/shiu pytest && uv run --directory pipeline/sims/shiu ruff check .`
### T06.4 — Brain neuropils (mesh mode + point-cloud fallback)
- Files: `pipeline/src/flybrain_pipeline/brain_neuropils.py`, `pipeline/tests/test_brain_neuropils.py`
- Do:
  1. `fetch_neuropil_meshes(ids, out_npz, getter=None)` — default getter imports `fafbseg.flywire` lazily (extra `fetch`; function name UNVERIFIED, so the getter is injectable); saves `{id: verts, faces}` to npz.
  2. `points_from_synapses(feather_path, columns, per_neuropil=2000, seed=0) -> dict[id, points]` — the CC BY 4.0 Zenodo synapse table; column names are parameters (UNVERIFIED).
  3. `brain_frame(all_points) -> (center, scale)` mapping nm to a ~2-unit wide scene; shared with neurons.
  4. `to_nodes(meshes_or_points, frame, max_tris=140_000)` — decimate meshes by area share, or emit point nodes; returns `glb.Node` list plus `kind`.
- Tests: `pipeline/tests/test_brain_neuropils.py` — fake getter; npz round-trip; synthetic feather sampling cap and determinism; frame maps bounds into [-1, 1]; triangle budget met.
- Acceptance: `uv run --directory pipeline pytest tests/test_brain_neuropils.py --no-cov`
### T06.5 — Curated neurons and activity channels
- Files: `pipeline/src/flybrain_pipeline/brain_neurons.py`, `pipeline/tests/test_brain_neurons.py`
- Do:
  1. `primary_neuropil(count_table: pd.DataFrame) -> pd.Series` — argmax per root id from Zenodo `per_neuron_neuropil_count_post_783.feather` (column names as parameters).
  2. `select_neurons(spikes_by_behavior, stimulus_ids, readout_ids, cap=400) -> list[int]` — stimulus ∪ readouts (MN9 `720575940660219265`) ∪ top active per behavior, round-robin until `cap`.
  3. `fetch_skeletons(ids, out_npz, getter=None)` — lazy fafbseg getter (UNVERIFIED name), fallback hook for `navis.skeletonize` of meshes.
  4. `simplify_lines(skeletons, max_segments=290_000)` — keep branch points and endpoints, drop every k-th intermediate node; `to_nodes(skeletons, frame)` → `glb.Lines` nodes named by root id.
  5. `channel_map(primary, neuropil_ids, curated_ids) -> dict[str, list[int]]` — neuropil channels = all simulated neurons whose primary neuropil matches; neuron channels = one id each.
  6. `neuron_infos(ids, annotations, primary) -> list[dict]` matching `NeuronInfo`.
- Tests: `pipeline/tests/test_brain_neurons.py` — argmax ties broken by lowest neuropil id; selection cap, order and required ids present; line simplification keeps topology and meets budget; channel map; infos validate against the `NeuronInfo` part of `schemas/manifest.schema.json`.
- Acceptance: `uv run --directory pipeline pytest tests/test_brain_neurons.py --no-cov`
### T06.6 — Source downloads with checksums
- Files: `pipeline/src/flybrain_pipeline/fetch.py`, `pipeline/tests/test_fetch.py`, `pipeline/config/sources.toml`
- Do:
  1. `sources.toml`: each source with `url`, `dest` exactly as in the raw layout table [PLAN-01 §2b](PLAN-01-architecture.md#2b-raw-data-layout---raw-default-pipelinedataraw-gitignored) (relative to `--raw`, except the Shiu tarball whose dest is `pipeline/sims/shiu/vendor/`), `strip_top_dir` for tarballs, optional `sha256`, `licence`, `size_mb`: flybody repo tarball at a pinned commit (`https://github.com/TuragaLab/flybody/archive/<sha>.tar.gz`), flybody `walking-imitation-dataset` and `flight-imitation-dataset` figshare URLs (taken from flybody `download_data.py` at that commit), Zenodo 10676866 `per_neuron_neuropil_count_post_783.feather` and `proofread_root_ids_783.npy`, optional `flywire_synapses_783.feather` (9.5 GB, only with `--with-synapses`), flywire_annotations TSV at a pinned commit, Shiu repo tarball at a pinned commit (extracted to `pipeline/sims/shiu/vendor/`).
  2. `fetch(name, cfg, opener=urllib.request.urlopen)` — stream to a `.part` file, verify sha256 when set (print it when unset so a human can pin it), atomic rename, skip if present and valid; extract tarballs with `tarfile` `filter="data"` (blocks path traversal).
  3. `main(argv)`: `--raw` (default `pipeline/data/raw`), `--only NAME`, `--with-synapses`, `--list`.
- Tests: `pipeline/tests/test_fetch.py` — fake opener; checksum mismatch deletes `.part` and raises; skip when present; tar with `../evil` entry rejected; `--list` prints all sources; `sources.toml` parses and every entry has `licence`; `dest` values equal the PLAN-01 §2b paths, including `brain/annotations.tsv` and `pipeline/sims/shiu/vendor/` (the constants T06.3 hard-codes).
- Acceptance: `uv run --directory pipeline pytest tests/test_fetch.py --no-cov`

## Wave gate
- Commands: `uv run --directory pipeline pytest && uv run --directory pipeline ruff check . && uv run --directory pipeline ruff format --check . && uv run --directory pipeline/sims/shiu pytest && uv run --directory pipeline/sims/shiu ruff check .`
- Review focus: no network or Brian2 in tests; every UNVERIFIED data-layout fact is a parameter, not a constant; downloads are checksummed and tar extraction is traversal-safe; walking/escape stimuli flagged `assumption: true`; triangle and segment budgets enforced; Shiu code is fetched, never vendored into git (MIT, but kept out to stay small).
