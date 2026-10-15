# WAVE-08 — E2E on the demo flow, CI/CD, security headers, release review
Depends on: WAVE-05, WAVE-07
Human prerequisites: none

The deploy workflow is written and tested here but only runs on GitHub after [HUMAN-01](HUMAN-01-github-repo.md) and [HUMAN-02](HUMAN-02-cloudflare-pages.md). Without their secrets it skips with a notice, so this wave never blocks on a person.

## Tasks
### T08.1 — Playwright E2E on the demo flow
- Files: `playwright.config.ts`, `e2e/demo.spec.ts`, `e2e/mobile.spec.ts`
- Do:
  1. Config: `webServer` = `npm run build && npm run preview` on port 4173 with `VITE_NARRATION_MODE=replay`; projects `chromium` (1440×900) and `mobile` (Pixel 7 device); Chromium args `--use-angle=swiftshader --enable-unsafe-swiftshader`; `retries: 1` in CI; trace on first retry.
  2. `demo.spec.ts` follows [PLAN-00 §4](PLAN-00-overview.md#4-three-minute-audience-demo-script): page loads with no console errors; both canvases present and not blank (read a pixel via `canvas.toDataURL` and check it differs from the clear color); "fixture data" badge visible when serving fixtures; pick Feeding → press play → timeline value increases within 2 s; a narration cue appears in the live region; scrub to 1500 ms → cue text matches the script; pick Grooming → clip-source tag reads "Keyframed"; click a suggested question → replay answer appears; open attribution → contains "CC BY-NC 4.0" and "Non-commercial"; `?quality=low` → low-quality checkbox checked; `?debug=1` shows an fps number.
  3. `mobile.spec.ts`: at 390 px wide no horizontal scroll (`scrollWidth <= clientWidth`), panes stacked, controls ≥ 44 px.
- Tests: the two spec files (this task is the tests).
- Acceptance: `npx playwright test --list` (full E2E runs in the wave gate: `npx playwright install chromium` first; `--with-deps` needs sudo, CI only)
### T08.2 — CI and deploy workflows
- Files: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- Do:
  1. `ci.yml`: keep `web` and `pipeline` jobs; add `npm run contracts:check`; add job `shiu` (`uv run --directory pipeline/sims/shiu pytest`); add job `assets` (`uv run --project pipeline flybrain budget public/fixtures` and, if `public/data/manifest.json` exists, `flybrain budget public/data --dist dist` after a build); add job `e2e` (needs `web`; `npx playwright install --with-deps chromium`; `npm run e2e`; upload `playwright-report` on failure). `permissions: contents: read`.
  2. `deploy.yml`: `on: workflow_run` of CI on `main` with `conclusion == success`, plus `workflow_dispatch`. Steps: checkout, setup-node, `npm ci`, `npm run build` with `VITE_NARRATION_MODE: ${{ vars.VITE_NARRATION_MODE || 'replay' }}`; if `secrets.CLOUDFLARE_API_TOKEN` is empty, print a notice linking HUMAN-02 and exit 0; else `cloudflare/wrangler-action@v3` with `command: pages deploy dist --project-name=flybrain-lab --branch=main`, `apiToken`, `accountId`. `permissions: contents: read, deployments: write`. `concurrency: deploy-production`.
- Tests: none (config); validated by actionlint.
- Acceptance: `uvx --from actionlint-py actionlint .github/workflows/ci.yml .github/workflows/deploy.yml`
### T08.3 — Security and cache headers
- Files: `public/_headers`, `scripts/headers.test.ts`
- Do:
  1. `public/_headers` ([Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)): for `/*` — `Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. For `/data/*` and `/fixtures/*`: `Cache-Control: public, max-age=86400`. For `/api/*`: `Cache-Control: no-store`.
  2. Confirm the CSP works with the meshopt decoder and drei `Html` in `npm run preview` (Vite preview does not apply `_headers`; test with `npx wrangler pages dev dist` once manually and note the result in the commit body).
- Tests: `scripts/headers.test.ts` — parses `_headers`; asserts CSP present on `/*` with `frame-ancestors 'none'` and no `unsafe-eval` (only `wasm-unsafe-eval`); `/api/*` no-store.
- Acceptance: `npx vitest run scripts/headers`

## Wave gate
- Commands: `npm ci && npm run lint && npm test && npm run contracts:check && npm run build && npx playwright install chromium && npm run e2e && uv run --directory pipeline pytest && uv run --directory pipeline ruff check . && uv run --directory pipeline/sims/shiu pytest && uv run --project pipeline flybrain budget public/fixtures && uvx --from actionlint-py actionlint`
- Review focus (release review): run the PLAN-00 demo script by hand against `npm run preview`; keyless path works with zero secrets; live mode documented in HUMAN-03 and fails closed; every HUMAN doc has links, env var names, verification and cost; attribution and "simulated / keyframed / assumption" labels visible; budget table met; no secrets in repo history (`git log -p | grep -iE "sk-ant|api[_-]?key\s*="` returns nothing); dependency list equals PLAN-01 §5.
