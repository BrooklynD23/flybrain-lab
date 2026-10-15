# WAVE-03 — Fixture assets, web data layer, replay narration
Depends on: WAVE-02
Human prerequisites: none

## Tasks
### T03.1 — Synthetic fixture assets
- Files: `pipeline/src/flybrain_pipeline/fixtures.py`, `pipeline/tests/test_fixtures.py`, `public/fixtures/**`, `public/404.html`
- Do:
  1. `build_fixtures(out: Path) -> None` writes, with `glb.write_glb` and `activity.py`:
     - `brain.glb`: 6 box/icosphere meshes named with real FlyWire neuropil ids `AL_L`, `AL_R`, `AMMC_L`, `GNG`, `PRW`, `LO_R`; under 2k triangles.
     - `neurons.glb`: 5 polylines named by fake 18-digit root ids.
     - `fly.glb`: 4 box bodies (`thorax`, `head`, `wing_left`, `wing_right`) and 4 animations named `walking`, `grooming`, `feeding`, `escape`, each 4000 ms at 30 fps, procedural sine motion.
     - `activity/<behavior>.bin`: 80 bins × 11 channels, deterministic (seeded) synthetic rates where each behavior peaks in a different neuropil.
     - `manifest.json`: `dataSource: "fixture"`, `narrationUrl: "/narration/<behavior>.json"`, `clipSource` = `reference-replay` for walking and escape and `keyframed` for grooming and feeding, `stimulus` per behavior copied from the defaults in [RESEARCH-01 §4](RESEARCH-01-fly-projects.md) (`assumption: true` for walking and escape, false for feeding and grooming), attribution entries copied from [RESEARCH-03](RESEARCH-03-licences-citations.md) table rows.
  2. Validate the manifest with `validate.validate_file` against `schemas/manifest.schema.json`; raise on errors.
  3. `main(argv)` for `python -m flybrain_pipeline.fixtures --out public/fixtures`. Output must be byte-identical across runs (no timestamps).
  4. Generate and commit `public/fixtures/`.
  5. Write `public/404.html` (static "Not found" page with a link to `/`). Its presence turns off Cloudflare Pages SPA fallback ([serving pages](https://developers.cloudflare.com/pages/configuration/serving-pages/)).
- Tests: `pipeline/tests/test_fixtures.py` — builds into tmp dir; manifest validates; every asset URL in the manifest (glb and activity files, not `narrationUrl`) exists in the output dir; clipSource per behavior as above; `stimulus.assumption` true exactly for walking and escape; activity byte length matches; two runs produce identical bytes; total size < 200 KB.
- Acceptance: `uv run --directory pipeline pytest tests/test_fixtures.py --no-cov && uv run --project pipeline python -m flybrain_pipeline.validate public/fixtures/manifest.json manifest --schema-dir schemas`
### T03.2 — Web data layer: manifest loader, activity decoder, clock
- Files: `src/data/loadManifest.ts`, `src/data/loadManifest.test.ts`, `src/data/activity.ts`, `src/data/activity.test.ts`, `src/data/clock.ts`, `src/data/clock.test.ts`
- Do:
  1. `loadManifest(fetchFn = fetch): Promise<{manifest, base}>` — try `/data/manifest.json`; fall back to `/fixtures/manifest.json` on any non-OK status, a `content-type` header that does not include `application/json` (`includes`, so `application/json; charset=utf-8` passes), or a JSON parse error (Cloudflare Pages and `vite preview` answer unknown paths with `index.html` + 200); zod-parse; check `nBins * binMs === durationMs`; throw `ManifestError` with a user-readable message on network or schema failure.
  2. `loadActivity(info, base, fetchFn)` → `Activity` object; reject when byte length ≠ `nBins × channels.length`. `rateAt(activity, tMs, channel) -> Hz` and `frameAt(activity, tMs) -> Float32Array` (new array per call is fine; no shared mutation). Clamp `tMs` into range.
  3. `clock.ts`: `createClock()` with `play`, `pause`, `seek(tMs)`, `setDuration`, `tick(nowMs)`, `subscribe`, `getSnapshot` (for `useSyncExternalStore`); loops at `durationMs`; `useClock()` hook.
- Tests: the three `.test.ts` files — fallback to fixtures on 404, on 200 + `text/html`, and on invalid JSON; schema error message; activity length mismatch; `rateAt` dequantization and clamping; clock play/pause/seek/loop with injected time.
- Acceptance: `npx vitest run src/data`
### T03.3 — Replay narration provider
- Files: `src/narration/replay.ts`, `src/narration/replay.test.ts`
- Do:
  1. `loadScript(url, fetchFn)` zod-parses `NarrationScript`; rejects cues not ascending in `tMs`.
  2. `cueAt(script, tMs)` → last cue with `cue.tMs <= tMs`, or `null`.
  3. `answerReplay(script, question)` → exact match on normalized text (lowercase, strip punctuation, collapse spaces); else best token-overlap `qa` entry if overlap ≥ 0.5; else the fallback string "Replay mode has no answer for that. Try one of the suggested questions."
  4. Export `suggestedQuestions(script)` (first 3 `q`).
- Tests: `src/narration/replay.test.ts` — cue boundaries (before first cue, exact tMs, after last); normalization; overlap threshold; fallback text; out-of-order cues rejected.
- Acceptance: `npx vitest run src/narration/replay`
### T03.4 — Narration content and neuropil glossary
- Files: `public/narration/walking.json`, `public/narration/grooming.json`, `public/narration/feeding.json`, `public/narration/escape.json`, `src/content/neuropils.ts`, `src/content/content.test.ts`
- Do:
  1. `src/content/neuropils.ts`: map of FlyWire neuropil id → full name and one-line plain-English role (cover all ids FlyWire uses, e.g. `GNG` gnathal ganglia, `PRW` prow, `AMMC_L/R` antennal mechanosensory and motor center, `LO_L/R` lobula, `LOP_L/R` lobula plate, `AL_L/R` antennal lobe, `MB_*`, `FB`, `EB`, `PB`). Source link per entry to FlyWire/Codex or VFB.
  2. Four narration scripts, 6–8 cues each, durations ≤ 4000 ms, 3–5 `qa` pairs each. Every cue states the source of activity ("simulated model") and, for walking and escape, that the stimulus is an assumption. Feeding names sugar GRNs → MN9 (Shiu et al. 2024). No claims about real recordings. Plain English, ≤ 280 chars per cue.
  3. Focus ids must exist in `neuropils.ts`.
- Tests: `src/content/content.test.ts` — each JSON parses with `NarrationScriptSchema`; all focus neuropil ids are known; cues ascending and `< 4000`; walking and escape scripts contain the word "assum".
- Acceptance: `npx vitest run src/content`

## Wave gate
- Commands: `npm run lint && npm test && npm run build && uv run --directory pipeline pytest && uv run --directory pipeline ruff check . && uv run --project pipeline python -m flybrain_pipeline.validate public/fixtures/manifest.json manifest --schema-dir schemas`
- Review focus: fixtures are deterministic and tiny; fallback `/data` → `/fixtures` works on 404, HTML-200 and bad JSON, and is visible; every fetched byte is validated before use; narration text is scientifically careful (labels, no overclaiming) and readable by a non-expert.
