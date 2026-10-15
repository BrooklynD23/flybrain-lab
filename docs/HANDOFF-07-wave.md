# HANDOFF WAVE-07 — one-command asset build (@8248a93)

## What now exists
- pipeline/src/flybrain_pipeline/build.py: `build(raw_dir, out_dir, config, compress=True)`, `BuildConfig(fixture_raw, points, neuron_lines)` (frozen), `BuildError`, `main`, `fetch_brain_main`
- cli.py: `command` + REMAINDER; subcommands fetch, fetch-brain, build, fixtures, validate, budget; no command prints help, exit 0
- Tests: pipeline/tests/test_build.py, src/data/assets.test.ts (TS check of manifest + assets)
- Commands (repo root):
  - `uv run --project pipeline flybrain build --raw pipeline/tests/data/raw --out <dir> --fixture-raw`
  - flags: `--points`, `--no-neuron-lines`, `--no-compress`
  - `uv run --project pipeline flybrain budget <dir>`
  - `uv run --directory pipeline pytest` (150 pass, cov 96.51%)
- Build is atomic (temp dir, swap after validation) and byte-identical across runs.
- Manifest carries attribution, stimulus.assumption, clipSource.

## Deviations
1. TDD red run was only the import error, not per-test.
2. `config` undefined in doc -> frozen BuildConfig dataclass.
3. Walking/escape use reference hdf5 (body/walking, body/flight); `walking_fallback` unused.
4. Stimulus ids = stimuli.json root_ids + annotation rows by cell_types; no readout ids selected (feeding MN9 not selected). Description from fixtures.STIMULUS.
5. Curated neuron without skeleton -> BuildError. `--no-neuron-lines` writes empty neurons.glb.
6. Temp output must end .glb (`opt-<name>`); gltf-transform picks format by extension.
7. T07.2: test file written fresh, no red run; public/data/manifest.json absent, only fixture manifest covered. Asset urls resolve relative to manifest folder; narrationUrl from public/.

## Known warnings
- UNVERIFIED constants in build.py for HUMAN-05: h5 key "qpos", source fps 200, count cols root_id/neuropil/count, synapse cols neuropil/x/y/z, annotation cols root_id/cell_type, body scale 1/model.stat.extent.
- `gltf-transform optimize` default flags (simplify/join) untested on real animated node names.
- `npx gltf-transform` ~30 s/call on /mnt/c; compressed build takes minutes; test probe timeout 180 s.
- npm build warns on a chunk over 500 kB (non-blocking).

## Next wave must know
- `brain_neuropils._columns` still loads the whole synapse feather; `--points` is very slow on the real 9.5 GB table. Fix first.
- Later fixes: build.py:288-294 restore `out` from `out.old` if final rename fails; build.py:341 use `_COUNT_COLS["neuropil_col"]`; build.py:345-347 catch ImportError (hint `--extra fetch`); build.py:272 make `fixtures._find_schema_dir` public.
- Flags in HUMAN-05 lines 20-48 match the CLI and PLAN-01 §2b.
