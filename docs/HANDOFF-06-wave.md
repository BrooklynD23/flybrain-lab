# HANDOFF WAVE-06 — pipeline source adapters (@07dddc7)

## What now exists
Package `pipeline/src/flybrain_pipeline/`:
- fetch.py: `fetch(name,cfg,raw,opener)`, `main` (sha256, safe tar/zip extract)
- body_mesh.py: `body_meshes`, `decimate_to_budget(max_tris=95_000)`, `to_nodes`
- body_clips.py: `load_reference_qpos`, `loop_or_clamp`, `keyframed_qpos`, `make_clip`
- brain_neuropils.py: `fetch_neuropil_meshes`, `load_meshes`, `points_from_synapses`, `brain_frame`, `to_nodes`
- brain_neurons.py: `primary_neuropil`, `select_neurons`, `fetch_skeletons`, `load_skeletons`, `simplify_lines`, `to_nodes`, `channel_map`, `neuron_infos`
- pipeline/sims/shiu/: `run_behaviors.py` (`resolve_ids`, `run`, `main`), `stimuli.json`, own pyproject
Commands (from repo root):
- `uv run --directory pipeline pytest` (125 pass, cov 96.02%)
- `uv run --directory pipeline ruff check .` and `ruff format --check .`
- `uv run --directory pipeline/sims/shiu pytest` (9 pass, cov 88.68%)
Getters (fafbseg meshes/skeletons) are injectable; tests use no network, no Brian2.

## Deviations
- T06.1: tests not run red first (module absent).
- T06.2: keyframed_qpos takes section dict {"keyframes": [...]}; make_clip skips world body; qpos[3:7] = root wxyz (hard-coded); resampled frames = round(n*fps/src_fps), index clamped.
- T06.3: shiu_sha 91bdd1e7dcf193f3e7ca5a8933497fcef63b7960 (main HEAD 2026-10-15, unpinned by docs); pandas/joblib/pyarrow unpinned, numpy >=1.24,<1.25; 21 feeding ids from example.ipynb.
- T06.4: glb has no POINTS, so point mode = degenerate (i,i) Lines; decimation shares by triangle count; added `load_meshes`; `_columns` reads feather schema.
- T06.5: `to_nodes` reuses private `brain_neuropils._apply`; `simplify_lines` raises ValueError if branch+end points exceed budget; added id_col/name_col/type_col params; `ruff format .` ran on whole pipeline dir.
- T06.6: acceptance run from inside pipeline/, not via --directory (gate later passed in --directory form).

## Known warnings (UNVERIFIED, fix by HUMAN-05)
- Joint names guessed from flybody, not checked vs real fruitfly.xml.
- Cell types P9, JO-C, JO-E, LC4, LPLC2 unchecked vs annotations.tsv (resolve_ids raises listing bad names).
- Walking/escape sources (eLife 10.7554/eLife.53510; Curr Biol 10.1016/j.cub.2014.09.035) are guesses.
- `flywire.get_neuropil_volumes` and `fafbseg.flywire.get_skeletons` names unverified; no navis fallback.
- Real Brian2 run_exp never run.
- Confirm shiu_sha; same SHA goes in sources.toml.

## Next wave must know
1. FIX before HUMAN-05: brain_neuropils.py:46-49 `_columns` uses `pf.read_table(path)` (loads 9.5 GB synapse feather). Use `pyarrow.ipc.open_file(path).schema.names`.
2. WAVE-07 build.py must keep only clip tracks whose body has a node; glb.py:160 raises on unknown track target (body_meshes skips bodies without visual mesh).
3. fetch.py:27 `_present` skips existing files without re-checking sha256 (low risk, .part rename after hash).
4. decimate_to_budget keeps >=50 tris/body; total may exceed max_tris. Hard 100k limit enforced by `flybrain budget`.
5. `fetch` CLI subcommand wiring is WAVE-07 T07 scope. pipeline/sims/shiu/vendor/ is gitignored.
