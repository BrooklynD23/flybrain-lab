# HANDOFF-05 (WAVE-05 App wiring and live narration endpoint) @1040219

## What now exists
- src/App.tsx: default export App. One shared clock drives both panes; rAF loop writes fps to a ref; cue via useSyncExternalStore.
- src/narration/live.ts: NARRATE_URL=/api/narrate, RATE_LIMITED_MESSAGE, LiveNarrationError, askLive().
- src/narration/replay.ts: loadScript, cueAt, answerReplay, suggestedQuestions, REPLAY_FALLBACK.
- src/fps.ts: createFpsMeter.
- functions/api/narrate.ts: onRequestPost, handle, callModel, Env. Order: 405, 413, 400, 429, 503, model call. 502 on upstream error. Cache-Control: no-store.
- wrangler.toml: NARRATION_MODEL var, [[ratelimits]] NARRATE_LIMITER (limit 10 / 60s).
- Modes: replay by default; live only if VITE_NARRATION_MODE === "live". Live failure falls back to replay.
- Commands: npm run lint | test | build | contracts:check

## Deviations
1. manifest.ts:69 `z.url()` fix from HANDOFF-04 NOT done (file outside task list).
2. `?quality=high` is honored, can override low-hardware default.
3. Unknown `?behavior=` falls back to first behavior in manifest.
4. Live failure answer: "<error> Showing the replay answer instead: <replay answer>" (AskPanel has one slot).
5. styles.css reduced-motion rule disables all animation/transitions; no idle rotation exists yet.
6. wrangler.toml namespace_id="1001" is a placeholder (task omitted it); compatibility_date 2026-10-15; toml not prettier-formatted.
7. Error log redacts upstream message; callModel throws only "upstream <status>".

## Known warnings
- Build: 1,344 kB JS chunk over 500 kB (advisory).
- Fallback Map in narrate.ts:33 never evicts expired IPs; add sweep past resetAt if needed.
- Coverage 97.14% stmts; 230/230 tests; 19 files.

## Next wave must know
- Run `npx wrangler pages dev dist` once before deploy; if NARRATE_LIMITER binding is rejected, drop the [[ratelimits]] block (Map fallback covers it).
- Fix manifest.ts:69 `z.url()` in the wave that owns that file.
- Reduced-motion rule has nothing to stop until BrainView gets autoRotate.
- Test key "sk-secret-test-key" in narrate.test.ts:6 is a dummy.
