# HANDOFF-03 — fixtures, data layer, narration

## What exists now
- `pipeline/src/flybrain_pipeline/fixtures.py` + `test_fixtures.py` — generates committed `public/fixtures/*` (brain GLB, neurons GLB, fly GLB + 4 clips @4000ms/30fps, activity binaries, manifest, `public/404.html`). Deterministic + byte-identical across reruns; 88.8 KB total.
- `src/data/` — `loadManifest` (/data → /fixtures fallback on non-OK / non-JSON content-type / parse error; zod + `nBins*binMs===durationMs`; `{manifest, base}`, `manifest.dataSource:"fixture"` flag), `loadActivity` (byte-length check) + `rateAt`/`frameAt` (dequantize v/255*maxHz, fresh Float32Array, clamp), `createClock`/`useClock`/`useClockSnapshot` (loop at durationMs, stable snapshot).
- `src/narration/replay.ts` — `loadScript` (zod + strictly-ascending cues), `cueAt` (last cue ≤ tMs), `answerReplay` (normalized exact → Jaccard ≥0.5 → `REPLAY_FALLBACK`), `suggestedQuestions` (first 3).
- `public/narration/{walking,grooming,feeding,escape}.json` — 7 cues ≤4000ms + 4 qa each; every cue labelled "Simulated model"; walking/escape state stimulus assumption; feeding names sugar GRN→MN9 (id 720575940660219265, Shiu 2024).
- `src/content/neuropils.ts` — `NEUROPILS` map, all 78 FlyWire v783 neuropil ids (35 L/R + 8 midline), name + plain role + Codex link; extra `NEUROPIL_IDS` export.

## Deviations
- `rateAt` accepts channel id OR index; `useClockSnapshot` added (useSyncExternalStore path for UI re-render).
- Jaccard = "token overlap"; "ascending" = strictly increasing (dup tMs rejected).
- `loadScript`/`loadManifest` reject on non-OK HTTP (spec silent; repo convention 7).
- eslint.config.js + .prettierignore now exclude `visuals/` (orchestrator anatomy sidecar).

## Known warnings / follow-ups
- `feeding.json` cues:24,30 focus neuron `720575940660219265` = real MN9 root id — resolves only under real data; fixture-mode highlight no-ops there (acceptable).
- `rateAt`/`frameAt` return NaN on non-integer channel index or NaN tMs; `setDuration` emits even when unchanged.
- Grooming cue "GNG run mouthpart and head muscles" — loose wording (neck/VNC motor); labelled simulated, acceptable.

## Next wave must know
- `getFrame: () => Float32Array` is the per-frame contract — BrainView reads it inside `useFrame`; no React re-render per frame.
- Components are render-only; `src/scene/*.tsx` excluded from unit coverage (Playwright covers them in WAVE-08).
- `NEUROPILS` is the glossary source for labels — import, don't duplicate.
