# WAVE-02 — Pipeline writers: glb, activity, kinematics, budget
Depends on: WAVE-01
Human prerequisites: none

## Tasks
### T02.1 — Minimal glb writer (meshes, lines, node TRS animations)
- Files: `pipeline/src/flybrain_pipeline/glb.py`, `pipeline/tests/test_glb.py`
- Do:
  1. Plain dataclasses (frozen): `Mesh(name, positions float32[N,3], indices uint32[M,3])`, `Lines(name, positions float32[N,3], indices uint32[K,2])`, `Node(name, mesh|lines|None, translation, rotation_xyzw, scale, children)`, `Animation(name, times float32[T], tracks: {node_name: (translations[T,3], rotations_xyzw[T,4])})`.
  2. `write_glb(path, nodes, animations, extras: dict | None) -> None` using only numpy + `json` + `struct`: one binary buffer, 4-byte aligned bufferViews, accessors with `min`/`max` on POSITION and animation input, mode 4 for meshes and mode 1 for lines, a default material with `KHR_materials_unlit` absent (keep core glTF 2.0).
  3. Raise `ValueError` on NaN, mismatched lengths, non-unit quaternions (tolerance 1e-3), duplicate node names.
  4. `read_glb_json(path) -> dict` helper for tests and the budget checker.
- Tests: `pipeline/tests/test_glb.py` — header magic/version/length; one triangle mesh + one line node + 2-frame animation round-trip via `read_glb_json` (counts, min/max, channel targets); each `ValueError` case; output passes `npx --no-install gltf-transform validate` (test skipped only if `npx` is missing).
- Acceptance: `uv run --directory pipeline pytest tests/test_glb.py --no-cov`
### T02.2 — Activity binning and quantization
- Files: `pipeline/src/flybrain_pipeline/activity.py`, `pipeline/tests/test_activity.py`
- Do:
  1. `bin_rates(spikes: pd.DataFrame, channels: dict[str, list[int]], duration_ms: int, bin_ms: int = 50) -> np.ndarray` — input columns `t` (ms), `trial`, `flywire_id` (Shiu parquet layout); output float32 `[nBins, nChannels]` mean rate in Hz per neuron per channel (spike count / (neurons × trials × bin_s)). Channels with zero neurons raise `ValueError`.
  2. `quantize(rates) -> tuple[bytes, list[float]]` — per-channel max; uint8 bin-major; channels with max 0 keep `maxHz=0` and all-zero bytes.
  3. `activity_info(url, channels, rates) -> dict` matching the `ActivityInfo` contract.
- Tests: `pipeline/tests/test_activity.py` — hand-computed 2-channel example; spikes at exactly the bin edge go to the later bin; spikes at `t >= duration_ms` dropped; quantize/dequantize error ≤ maxHz/255; all-zero channel; byte length = nBins × nChannels.
- Acceptance: `uv run --directory pipeline pytest tests/test_activity.py --no-cov`
### T02.3 — Kinematics: joint-space keyframes to world body poses
- Files: `pipeline/src/flybrain_pipeline/kinematics.py`, `pipeline/tests/test_kinematics.py`
- Do:
  1. `poses_from_qpos(model: mujoco.MjModel, qpos: np.ndarray[T, nq]) -> (xpos[T,B,3], xquat_wxyz[T,B,4])` using `mujoco.mj_kinematics` on a fresh `MjData` per call.
  2. `interpolate_keyframes(model, keyframes: list[{t_ms, joints: {name: rad}}], fps=30) -> qpos[T,nq]` — linear in joint space, unspecified joints keep `qpos0`; unknown joint names raise `ValueError` listing them.
  3. `to_gltf_frame(xpos, xquat_wxyz, scale) -> (translations, rotations_xyzw)` — MuJoCo Z-up to glTF Y-up (rotate −90° about X), wxyz→xyzw, renormalize.
- Tests: `pipeline/tests/test_kinematics.py` — inline 2-body MJCF string with one hinge: 90° hinge gives expected child pose; keyframe interpolation midpoint; unknown joint error; axis conversion maps +Z to +Y; quaternions unit length.
- Acceptance: `uv run --directory pipeline pytest tests/test_kinematics.py --no-cov`
### T02.4 — Asset budget checker
- Files: `pipeline/src/flybrain_pipeline/budget.py`, `pipeline/tests/test_budget.py`
- Do:
  1. `BUDGET` constant = the table in [PLAN-01 §6](PLAN-01-architecture.md#6-asset-budget) (bytes, triangles, line segments, file count, per-file 25 MiB).
  2. `check(asset_dir: Path, dist_dir: Path | None) -> list[str]` — gzip size via stdlib `gzip`; triangle/segment counts from glb JSON accessors (parse the JSON chunk directly with `struct` + `json`, no import from `glb.py`, so this task is independent); returns violations.
  3. `main(argv)` for `python -m flybrain_pipeline.budget <asset_dir> [--dist dist]`; prints a table; exit 1 on any violation.
- Tests: `pipeline/tests/test_budget.py` — tmp dir with small files passes; oversized file, too many triangles (synthetic glb JSON chunk), and > 20,000 files each produce a violation; exit codes.
- Acceptance: `uv run --directory pipeline pytest tests/test_budget.py --no-cov`

## Wave gate
- Commands: `uv run --directory pipeline pytest && uv run --directory pipeline ruff check . && uv run --directory pipeline ruff format --check . && npm test`
- Review focus: glb output is valid glTF 2.0 (gltf-transform validate clean); quantization math and bin edges correct; MuJoCo quaternion order handled once, in one place; functions are pure (no input mutation); budget numbers equal PLAN-01 §6.
