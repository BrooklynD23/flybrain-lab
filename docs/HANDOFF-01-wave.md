# HANDOFF — WAVE-01 → WAVE-02

## What exists
- `src/contracts/`: `manifest.ts` (BEHAVIORS, IdSchema, AssetPathSchema `/^(?!.*\.\.)[a-z0-9_\-/.]+$/`, NeuronInfo, Stimulus, BehaviorInfo incl. `nBins*binMs===durationMs` refine, Attribution, Manifest), `activity.ts` (ActivityInfo: binMs literal 50, encoding 'uint8-bin-major', maxHz.length===channels.length), `narration.ts` (CueFocus, NarrationCue, QaEntry, NarrationScript), `api.ts` (ActiveRegion, NarrateRequest question trimmed 1–280 + active ≤10 + tMs 0–60000, NarrateResponse union), `index.ts` re-exports. All `.strict()`. Inferred types exported.
- `scripts/emit-schemas.ts`: `renderSchemas()` pure + main writes `schemas/{manifest,activity,narration,api}.schema.json` (sorted keys, 2-space, trailing \n). `npm run contracts` regenerates; `contracts:check` fails on drift.
- `pipeline/src/flybrain_pipeline/validate.py`: `load_schema`, `validate_file` (Draft202012, returns `$.path: msg` list, never raises on invalid), `python -m flybrain_pipeline.validate <file> <name> [--schema-dir]` CLI (exit 0/1).

## Deviations
- `attribution.url` = `z.url()` (external link, emits format:uri) — NOT the asset-path regex; asset-path fields use the regex. Python side ignores `format` anyway.
- `api.schema.json` contains NarrateRequest only (Response is app-side).
- `emit-schemas.ts` has `/// <reference types="node" />` (tsconfig owned by WAVE-00).
- Extra strengthens: min(1) on arrays/strings, nonnegative on hz/maxHz — compatible with §2.

## Warnings
- `export PATH=/home/danny/.nvm/versions/node/v24.22.0/bin:$PATH` before node/npm. First `npm ci` ~14 min on /mnt/c; vitest cold-run may hit one 60s worker timeout — retry.
- `schemas/` was untracked until now — `contracts:check` drift detection only works from this commit onward.
- Python `validate` raises JSONDecodeError on malformed input file (caught in main → exit 1); fine per spec.

## For WAVE-02 (pipeline writers)
- Python pipeline validates its outputs via `validate_file` against `schemas/` — reuse it. Refinements zod can't express (listed in emit-schemas.ts header comment) must be re-checked in Python.
