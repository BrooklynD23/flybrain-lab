# WAVE-05 — App wiring and live narration endpoint
Depends on: WAVE-04
Human prerequisites: none

## Tasks
### T05.1 — App wiring, layout, modes
- Files: `src/App.tsx`, `src/App.test.tsx`, `src/main.tsx`, `src/styles.css`, `src/fps.ts`, `src/fps.test.ts`
- Do:
  1. On mount: `loadManifest()`; show a loading state, then a readable error panel with a Retry button on `ManifestError`.
  2. Behavior state (default `feeding`, or `?behavior=` if valid). On change: `loadActivity` + `loadScript`, reset clock to 0, set duration.
  3. Two `<Canvas>` panes side by side (≥ 900 px) or stacked (< 900 px): left `BrainView`, right `BodyView`. Both read the single clock from `useClock()` via getters. A rAF loop calls `clock.tick`.
  4. Quality: `?quality=low` or `QualityToggle`; low sets Canvas `dpr={1}`, `antialias: false`, hides neurons. Default low when `navigator.hardwareConcurrency <= 4` or a coarse pointer and narrow screen.
  5. Narration mode from `import.meta.env.VITE_NARRATION_MODE` (`replay` default; anything else than `live` = replay). Ask handler: replay → `answerReplay`; live → `askLive` with `topActive(frame, channels, 10)`; if live throws, show the error and fall back to the replay answer.
  6. `fps.ts`: `createFpsMeter()` (rolling 1 s window, pure, injected time); App shows it when `?debug=1`.
  7. `styles.css`: dark theme with CSS custom properties, `prefers-reduced-motion` disables idle rotation, 16 px gutters, no horizontal scroll at 360 px.
  8. Mount `AttributionPanel`, `NarrationPanel`, `AskPanel`, `BehaviorPicker`, `Timeline`, `QualityToggle`.
- Tests: `src/App.test.tsx` — mock `@react-three/fiber` `Canvas` and the scene components (jsdom has no WebGL); with fixture manifest: renders picker, switching behavior loads its activity URL, error panel + retry on bad manifest, replay ask returns qa answer, live ask failure falls back to replay, `?quality=low` honored. `src/fps.test.ts` — 60 ticks in 1 s gives 60, window rolls.
- Acceptance: `npx vitest run src/App src/fps` (build runs in the wave gate)
### T05.2 — Pages Function `/api/narrate`
- Files: `functions/api/narrate.ts`, `functions/api/narrate.test.ts`, `wrangler.toml`
- Do:
  1. `wrangler.toml`: `name = "flybrain-lab"`, `pages_build_output_dir = "dist"`, `compatibility_date` = date of implementation, `[vars] NARRATION_MODEL = "claude-haiku-5-5"`, a `[[ratelimits]]` binding `NARRATE_LIMITER` with `simple = { limit = 10, period = 60 }` ([rate-limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit)). If `wrangler pages dev` rejects the binding for Pages, remove it and rely on the fallback (step 3), and note it in the commit body.
  2. Export `onRequestPost` and a testable `handle(request, env, deps = { callModel, now })`. Order: method check (405) → `Content-Length`/body > 2048 bytes (413) → JSON parse (400) → `NarrateRequestSchema` (400, generic message) → rate limit keyed by `CF-Connecting-IP` (429) → missing `ANTHROPIC_API_KEY` (503 `{error:"live mode unavailable"}`) → model call.
  3. Rate limit: use `env.NARRATE_LIMITER.limit({key})` when present; otherwise a module-level `Map` token bucket, 10/min per IP (`// ponytail: per-isolate only; binding is the real limit`).
  4. `callModel`: one `fetch` to `https://api.anthropic.com/v1/messages` with headers `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`; body `{model, max_tokens: 300, system, messages:[{role:'user', content}]}`. `model` must be in the allowlist `claude-haiku-5-5`, `claude-sonnet-5-5`, else use haiku. System prompt: explain to a lay audience, ≤ 80 words, say the activity is from a simulated model with assumed signs, do not invent neuron names beyond those given. User content = JSON of the validated request only.
  5. Response `{text, model}`; trim to 600 chars. Upstream errors → 502 `{error:"narration failed"}` and `console.error` with status only (never the key or full body).
  6. `Cache-Control: no-store` on all responses.
- Tests: `functions/api/narrate.test.ts` (first line `// @vitest-environment node`; the default is jsdom) with a fake `callModel` and fake `fetch` — 200 path; 405; 413; malformed JSON; each schema violation; 429 after 10 calls from one IP within 60 s and reset after; binding path used when present; 503 when key missing; model allowlist; 502 on upstream 500; the API key never appears in any response or log call.
- Acceptance: `npx vitest run functions/api/narrate`

## Wave gate
- Commands: `npm run lint && npm test && npm run build && npm run contracts:check`
- Review focus: the keyless path (replay) works end to end with fixtures; live mode cannot leak the key, accepts only validated input, is rate limited, and fails closed to replay; layout works at 360 px and 1440 px; single clock drives both panes; no per-frame React re-render.
