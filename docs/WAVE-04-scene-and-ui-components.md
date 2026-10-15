# WAVE-04 — Scene and UI components
Depends on: WAVE-03
Human prerequisites: none

All components take data and callbacks as props. None of them fetch, read the URL or own global state; WAVE-05 wires them. Render-only `src/scene/*.tsx` files are excluded from unit coverage and covered by Playwright in WAVE-08; all their logic lives in tested `.ts` modules.

## Tasks
### T04.1 — BrainView (neuropils + curated neurons + activity colors)
- Files: `src/scene/BrainView.tsx`, `src/scene/brainColors.ts`, `src/scene/brainColors.test.ts`
- Do:
  1. `brainColors.ts`: `hzToColor(hz, maxHz) -> [r,g,b]` on a perceptual sequential ramp (dark blue → yellow), gamma-corrected; `hzToOpacity` for neuron lines (0.15–1); `topActive(frame, channels, n) -> {id, hz}[]` sorted descending, used later for live-mode context.
  2. `BrainView` props: `neuropilsUrl`, `neuronsUrl`, `channels`, `getFrame: () => Float32Array` (read inside `useFrame`, so React does not re-render per frame), `maxHz: number[]`, `quality: 'high'|'low'`, `selected?: string`, `onSelect(id)`. Load with drei `useGLTF` (meshopt on). Per node: clone material once (memoized), update color/opacity from `getFrame()` in `useFrame` without re-rendering React. `kind: 'points'` neuropils render as `THREE.Points`. Low quality hides neurons.
  3. Click/tap on a neuropil calls `onSelect`; selected region shows a drei `Html` label with full name (from `src/content/neuropils.ts`) and current Hz, plus the text "simulated".
  4. `OrbitControls` with damping; camera fits the brain bounds once.
- Tests: `src/scene/brainColors.test.ts` — ramp endpoints, monotonic luminance, `maxHz=0` gives the floor color, `topActive` ordering and `n` cap, inputs not mutated.
- Acceptance: `npx vitest run src/scene/brainColors`
### T04.2 — BodyView (fly glb + clip synced to clock)
- Files: `src/scene/BodyView.tsx`, `src/scene/clipTime.ts`, `src/scene/clipTime.test.ts`
- Do:
  1. `clipTime.ts`: `clipSeconds(tMs, clipDurationS, timelineMs) -> number` (scales if the glb clip length differs from the timeline by < 5%, otherwise clamps and warns once); `sourceLabel(clipSource) -> string` ("Reference replay (recorded fly kinematics)", "Keyframed by hand", "Physics policy").
  2. `BodyView` props: `url`, `behavior`, `getTimeMs: () => number`, `timelineMs`, `quality`. Load with `useGLTF`; `useAnimations`; play the action named `behavior` paused; set `action.time` from `clipSeconds` each frame; stop other actions on behavior change.
  3. Badge overlay with `sourceLabel`. Low quality: dpr handled by App; here skip shadows.
- Tests: `src/scene/clipTime.test.ts` — exact scaling, clamp case, label per source, warn-once behavior.
- Acceptance: `npx vitest run src/scene/clipTime`
### T04.3 — Controls and narration panel
- Files: `src/components/BehaviorPicker.tsx`, `src/components/BehaviorPicker.test.tsx`, `src/components/Timeline.tsx`, `src/components/Timeline.test.tsx`, `src/components/QualityToggle.tsx`, `src/components/QualityToggle.test.tsx`, `src/components/NarrationPanel.tsx`, `src/components/NarrationPanel.test.tsx`
- Do:
  1. `BehaviorPicker`: radio group of the 4 behaviors (label + clip-source tag), keyboard arrows, `aria-label`.
  2. `Timeline`: play/pause button, native `<input type="range">` scrubber in ms, current time `m:ss.s`, cue tick marks; `aria-valuetext`.
  3. `QualityToggle`: native checkbox "Low quality (faster)".
  4. `NarrationPanel`: current cue text in an `aria-live="polite"` region; the persistent line "Simulated model, assumed neurotransmitter signs."; "fixture data" badge when `dataSource === 'fixture'`.
  5. All controls ≥ 44 px touch targets; plain CSS classes (styles added in WAVE-05).
- Tests: the four `.test.tsx` files — render, keyboard and click callbacks, aria attributes, fixture badge shown/hidden.
- Acceptance: `npx vitest run src/components/BehaviorPicker src/components/Timeline src/components/QualityToggle src/components/NarrationPanel`
### T04.4 — Ask panel, attribution panel, live narration client
- Files: `src/components/AskPanel.tsx`, `src/components/AskPanel.test.tsx`, `src/components/AttributionPanel.tsx`, `src/components/AttributionPanel.test.tsx`, `src/narration/live.ts`, `src/narration/live.test.ts`
- Do:
  1. `live.ts`: `askLive(req: NarrateRequest, fetchFn = fetch, timeoutMs = 15000) -> Promise<string>` — validates `req` with zod before sending; POST `/api/narrate`; parse `NarrateResponse`; on 429 return "Too many questions, try again in a minute."; on other errors or timeout throw `LiveNarrationError` with a user-readable message.
  2. `AskPanel` props: `ask(question) => Promise<string>`, `suggestions: string[]`, `mode: 'replay'|'live'`. Text input (maxLength 280), submit, suggestion chips, loading and error states, answer rendered as plain text. Mode tag "Replay" or "Live (Claude)".
  3. `AttributionPanel` props: `attribution` from the manifest. Native `<details>`; lists name, licence, link, citation; heading text includes "Non-commercial demo".
- Tests: `src/narration/live.test.ts` (fake fetch: success, 429, 500, timeout, invalid request never sent); `AskPanel.test.tsx` (submit, suggestion click, loading, error, 280-char cap); `AttributionPanel.test.tsx` (renders every entry and link, NC notice).
- Acceptance: `npx vitest run src/components/AskPanel src/components/AttributionPanel src/narration/live`

## Wave gate
- Commands: `npm run lint && npm test && npm run build`
- Review focus: no per-frame React state updates (colors and clip time set in `useFrame`); materials cloned once, disposed on unmount; components accessible (labels, keyboard, live region, contrast); answers rendered as text, never HTML; every scientific label present.
