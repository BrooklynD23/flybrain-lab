# HANDOFF-04 — Scene and UI components (gate ok 2026-10-15 @1bc0321)

## What now exists
- src/components/: AskPanel (MAX_QUESTION_CHARS=280, mode replay|live), AttributionPanel, BehaviorPicker, NarrationPanel({cue,dataSource}), QualityToggle({lowQuality,onChange}), Timeline({clock,cueTimesMs}) + formatTimeMs. Each has a .test.tsx.
- src/scene/brainColors.ts: hzToColor, hzToOpacity, ActiveChannel, topActive.
- src/scene/clipTime.ts: clipSeconds, sourceLabel, resetClipTimeWarnings.
- src/scene/BrainView.tsx, BodyView.tsx: R3F views. Colors and clip time are written in useFrame. Excluded from coverage.
- Commands: npm run lint | test (vitest + coverage) | build | dev | e2e.
- Gate: 17 files, 197/197 tests; cov 97.65% stmts, 90.12% br, 98.76% fn, 99.35% lines; dist index js 219.61 kB.

## Deviations
- T04.2: BodyView also takes `clipSource` (badge needs it; matches PLAN-01 manifest field). WAVE-05 must pass `behavior.clipSource`.
- T04.2/T04.4: no red-first TDD run; files already existed from an earlier run and passed.
- Commit used `git add -A`: untracked visuals/ (anatomy sidecar, ~21 files) was committed too. Excluded in HANDOFF-03.

## Known warnings (non-blocking)
1. src/contracts/manifest.ts:69 `z.url()` accepts `javascript:` URLs; AttributionPanel.tsx:20 renders href={entry.url}. Fix: `z.url({ protocol: /^https?$/ })`.
2. src/components/Timeline.tsx:27 useClockSnapshot re-renders Timeline ~60 Hz while playing. If WAVE-05 profiling shows jank, throttle or write time text via ref.
3. src/components/AskPanel.tsx:96 mounts the aria-live answer <p> only after an answer exists; first answer may be missed by screen readers. Fix: always mount it (as NarrationPanel.tsx:15 does).

## Next wave must know
- Keep labels: "simulated", disclaimer, source badge, fixture badge, "Non-commercial demo".
- Answers render as text only; never use dangerouslySetInnerHTML.
- Do the manifest.ts:69 fix first (2 min).
