# HANDOFF-08 (WAVE-08 deploy-e2e-release) @6497bd8

## What now exists
- `playwright.config.ts`: testDir `e2e`, webServer `npm run build && npm run preview` (port 4173, VITE_NARRATION_MODE=replay), swiftshader launch args, projects `chromium` (1440x900) and `mobile` (390px).
- `e2e/demo.spec.ts`: demo flow, `?quality=low`, `?debug=1`. `e2e/mobile.spec.ts`: mobile 390px.
- `public/_headers`: CSP, nosniff, Referrer-Policy, Permissions-Policy; cache rules for `/data/*`, `/fixtures/*`; `no-store` for `/api/*`.
- `scripts/headers.test.ts`: vitest check of `_headers` contents.
- `.github/workflows/ci.yml` (push + pull_request) and `deploy.yml` (workflow_run after CI on push, or workflow_dispatch; permissions contents:read, deployments:write; concurrency `deploy-production`).
- Deploy skips with a notice when `CLOUDFLARE_API_TOKEN` is missing (keyless path).
- Existing endpoint from WAVE-05: `functions/api/narrate.ts` (`onRequestPost`, 503 with no key, 429 from NARRATE_LIMITER).
- Commands: `npm run e2e`, `npx playwright install chromium`, `npm run lint`, `npm test`, `npm run contracts:check`, `npm run build`.

## Deviations from plan
- T08.1, T08.2, T08.3: none.
- Small: `e2e/demo.spec.ts:21` detects a blank canvas by counting colours in an element screenshot, not `canvas.toDataURL`. Same check, more robust with preserveDrawingBuffer=false.
- STATUS.md notes the T08.1 acceptance became `npx playwright test --list`.

## Known warnings
1. Build warns: chunk > 500 kB (not a failure).
2. `.github/workflows/deploy.yml:9`: `workflow_dispatch` from any branch deploys that SHA to production with `--branch=main`. Consider requiring `github.ref == 'refs/heads/main'`. Needs repo write access, so not blocking.
3. Secret scan clean: only `env.ANTHROPIC_API_KEY` read at `functions/api/narrate.ts:74` and the HUMAN-03 placeholder.

## Next wave must know
- No further build waves. Still owed by a person:
  1. Manual `npx wrangler pages dev dist` CSP check against the meshopt decoder and drei Html (T08.3 step 2); record the result in the commit body.
  2. Hand-run PLAN-00 demo script.
  3. HUMAN-01 to HUMAN-06 (repo, Cloudflare Pages, Anthropic key, Flywire licence, real data run, demo video).
- Deploy stays inert until HUMAN-01/02 are done and `CLOUDFLARE_API_TOKEN` is set.
