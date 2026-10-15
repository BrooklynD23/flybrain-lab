# HANDOFF — WAVE-02 → WAVE-03

## What exists (`pipeline/src/flybrain_pipeline/`)
- `glb.py` — frozen dataclasses `Mesh/Lines/Node/Animation`; `write_glb(path, nodes, animations, extras)` numpy+json+struct only, one buffer, 4-byte-aligned views, min/max on POSITION + anim input, mode 4/1; ValueError on NaN/length mismatch/non-unit quat/dup names/unknown target/bad indices/empty geometry/non-increasing times/empty tracks. `read_glb_json(path)`. Stores TRS + vertices VERBATIM — zero axis conversion.
- `activity.py` — `bin_rates(spikes{t,trial,flywire_id}, channels, duration_ms, bin_ms=50)` → float32 [nBins,nCh] count/(neurons×trials×bin_s); bin-edge → later bin; t<0/t≥duration dropped; zero-neuron ch → ValueError. `quantize` per-ch max → uint8 bin-major, all-zero → maxHz=0. `activity_info` (binMs hardcoded 50 = contract).
- `kinematics.py` — `poses_from_qpos(model, qpos[T,nq])` fresh MjData → xpos/xquat_wxyz; `interpolate_keyframes` np.interp clamped, unkeyed → qpos0, unknown/ball/free joints rejected; `to_gltf_frame` THE ONLY Z-up→Y-up site (premultiply q'=C⊗q, wxyz→xyzw, renormalize) — correct while mesh vertices stay MuJoCo-local.
- `budget.py` — `BUDGET` = PLAN-01 §6 verbatim (MiB units); `check(asset_dir, dist_dir)` stdlib only (own `_glb_json` per spec — no glb.py import); violations list; `main` CLI exit 1.
- `validate.py` (WAVE-01) — validate pipeline outputs against schemas/.

## Deviations
- `activity.bin_rates` ValueErrors on duration not multiple of bin_ms; n_trials = distinct trials (zero-spike trial uncounted).
- `to_gltf_frame` premultiply convention — keep mesh vertex data MuJoCo-local downstream or it breaks.
- BUDGET MiB vs §6 "MB" — stricter, errs safe.
- `interpolate_keyframes` missing keys → KeyError not ValueError (non-finite inputs unguarded until glb.py check).

## Warnings
- Parallel pytest shares /tmp/pytest-of-danny — transient tmp_path ENOENT possible; retry.
- Pipeline cov 94.5%; gate enforces 80.
- `npx --no-install gltf-transform validate` available at repo root (4.5.1).

## For WAVE-03 (fixtures + data layer)
- Fixture assets = tiny synthetic only, commit under `public/fixtures/`; budget-check them (`python -m flybrain_pipeline.budget`). Validation via `validate_file` + emitted `schemas/`. Keep every claim labelled (simulated/keyframed/reference).
