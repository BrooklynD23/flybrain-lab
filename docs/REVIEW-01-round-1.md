# REVIEW-01 — Round 1 (adversarial plan review)

**Verdict: FAIL.** 7 blocking issues. Fix them and run round 2.

## Checklist

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Hosted web app, works with no keys, live mode documented | FAIL | The design is right (PLAN-00:59-61, HUMAN-03), but the fallback from `/assets` to `/fixtures` breaks when hosted (B1) |
| 2 | Wave format, acceptance commands, file-disjoint tasks, no cycles | FAIL | Format, tasks and DAG are fine (PLAN-02:22-38). Some gate or acceptance commands cannot pass as written (B2, B3, B4, B5) |
| 3 | TDD, 80% coverage, Playwright E2E | PASS | WAVE-00:12 (vitest at 80), WAVE-00:23 (pytest-cov at 80), WAVE-06:29 (shiu env at 80), WAVE-08:9-15 (Playwright) |
| 4 | HUMAN docs complete; no human step on a wave's critical path | PASS* | Every wave is fixture-only. HUMAN-01 to 06 each have cost, links, verification and "needed before". *HUMAN-05 cannot actually be run (B7) |
| 5 | Ponytail, security | PASS | Deps listed with reasons (PLAN-01:162-190). Key only in a Pages secret, zod at the boundary, 2 KB body cap, rate limit (WAVE-05:22-27) |
| 6 | Versions and links are real | PASS | 4 links checked with WebFetch (table below) |
| — | AGENT.md, CLAUDE.md, README, STATUS, budget, licences, hours | PASS | AGENT.md is 90 lines and has a Loop kit section. CLAUDE.md is exactly `@AGENT.md\n`. README is 28 lines. STATUS.md exists. Budget is in PLAN-01 §6. FlyWire is listed as CC BY-NC (RESEARCH-03:9). Hours: 150 h, about 3.1 weeks (PLAN-00:78-87) |

## Links checked (2026-10-14)

| Link | Result |
|---|---|
| developers.cloudflare.com/pages/platform/limits/ | Matches the plan: 20,000 files, 25 MiB per file, 500 builds a month |
| zenodo.org/records/10676866 | CC BY 4.0. All 3 files are listed: neuropil-count feather 233.8 MB, root ids 1.1 MB, synapses 9.5 GB |
| github.com/TuragaLab/flybody | Apache-2.0. Model is in `flybody/fruitfly/assets/`. The README does not mention `download_data` (already marked UNVERIFIED) |
| developers.cloudflare.com/pages/configuration/serving-pages/ | With no top-level `404.html`, Pages treats the site as a single-page app and serves `/` for any path that has no file. This confirms B1 |

## Blocking issues

| # | Where | Problem | Fix |
|---|---|---|---|
| B1 | WAVE-03:23, PLAN-00:61 | `loadManifest` only falls back to fixtures on a 404. Cloudflare Pages (with no `404.html`) and `vite preview` both answer `/assets/manifest.json` with the SPA `index.html`. So the keyless hosted demo fails before HUMAN-05, and the WAVE-08 E2E test fails | In T03.2, fall back to fixtures on any non-OK response, a non-JSON content type, or a JSON parse error. Add `public/404.html` to T03.1 or T08.3. Add a test for "200 + text/html → fixtures". Also consider renaming the data folder to `/data/` so it does not clash with Vite's `dist/assets` |
| B2 | WAVE-00:11,14 | `lint` runs `prettier --check .` and `eslint .` over `docs/`, `*.md` and `.claude/`. The docs use compact `\|---\|` tables, so Prettier rewrites them and the WAVE-00 gate fails. ESLint also scans `.claude/workflows/loop-build.js` | Add `docs`, `*.md` and `.claude` to `.prettierignore`. Add `ignores: ['.claude/**','pipeline/**','dist/**','coverage/**']` to the ESLint config |
| B3 | WAVE-00:11,13; WAVE-01:12 | `node scripts/emit-schemas.ts` uses Node's type stripping, which needs explicit `.ts` import paths. With `moduleResolution: bundler`, imports without extensions fail with ERR_MODULE_NOT_FOUND | In T00.1, set tsconfig `allowImportingTsExtensions: true` and `erasableSyntaxOnly: true`. In T01.1, require `.ts` extensions on every relative import in `src/contracts` and `scripts` |
| B4 | WAVE-08:15 | `npx playwright install --with-deps` needs sudo (apt). The loop runs locally on WSL, so this acceptance step can hang or fail | Use `npx playwright install chromium` for acceptance. Keep `--with-deps` in CI only (T08.2) |
| B5 | WAVE-03:9-14 vs WAVE-08:12 | The fixture manifest never sets `clipSource` or `stimulus` per behavior. E2E expects the Grooming tag to read "Keyframed", and T08.1 cannot edit the fixtures | In T03.1, set walking and escape to `reference-replay` and grooming and feeding to `keyframed`. Copy the stimulus fields from `stimuli.json` with `assumption` true for walking and escape. Add a test for both |
| B6 | WAVE-06:31 | The Shiu runner runs on py3.10, which has no `tomllib`. Its defaults read `pipeline/config/sources.toml`, which T06.6 is writing in the same wave. That would need a new dependency (`tomli`) or a guess | Hard-code the default paths as constants in `run_behaviors.py`. In T06.6, add a test that `sources.toml` `dest` values match those constants |
| B7 | WAVE-07:10,13; HUMAN-05:20,31,35 | No contract defines the layout of `--raw`. Nothing says where `fetch`, `fetch-brain` and the Shiu run put `fruitfly.xml`, HDF5, spikes and npz files, or which flags `fetch-brain` takes. The HUMAN-05 build step cannot run | Add a "Raw layout" table to PLAN-01: the path of each input under `pipeline/data/raw/` and the `fetch-brain` flags. Make T06.6 `dest`, the Shiu `--out` and T07.1 follow it. Have the T07.1 test raw dir mirror the layout |

## Non-blocking nits

1. The plan says `stimuli.toml` in PLAN-00:73 and PLAN-01:7,117,155, but `stimuli.json` in WAVE-06:30. Pick one name.
2. WAVE-07:12: an atomic rename onto an existing output dir fails when a gate is re-run. Replace the old dir explicitly.
3. WAVE-03:18: the test "every URL in the manifest exists" will not find `/narration/*.json` in a temp dir. Limit it to asset URLs.
4. WAVE-05:28: `narrate.test.ts` should start with `// @vitest-environment node` (the default environment is jsdom).
5. HUMAN-05:7: running Shiu with `--n-proc -1` on 16 GB of RAM may run out of memory. Suggest `--n-proc 4`.
