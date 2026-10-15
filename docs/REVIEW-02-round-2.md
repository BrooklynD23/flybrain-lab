# REVIEW-02 — Round 2 (verifying the round-1 fixes)

**Verdict: FAIL.** 1 blocking issue: the real-data point-cloud fallback is not fully specified. All 7 round-1 blockers and all 5 nits are fixed. The rename to `public/data` broke nothing.

## Round-1 fixes

| # | Fix | Status | Evidence |
|---|---|---|---|
| B1 | Fall back to fixtures on non-OK / non-JSON / parse error; add `404.html` | Fixed | WAVE-03:18,24,27; PLAN-00:61 |
| B2 | Prettier and ESLint ignore lists | Fixed | WAVE-00:14 |
| B3 | `.ts` import extensions and `allowImportingTsExtensions` | Fixed | WAVE-00:13 |
| B4 | `--with-deps` used only in CI | Fixed | WAVE-08:15,19 |
| B5 | Fixture `clipSource` and `stimulus` set, with tests | Fixed | WAVE-03:14,19 |
| B6 | Shiu default paths hard-coded and cross-checked by T06.6 | Fixed | WAVE-06:31,61 |
| B7 | Raw layout and CLI flags defined | Partly fixed (see R1) | PLAN-01 §2b (lines 83-108); WAVE-06:58; WAVE-07:9,13; HUMAN-05:20,26,31,35 |
| Nits 1-5 | `stimuli.json` name, re-runnable build, asset-URL test, node environment for the narrate test, `--n-proc 4` | Fixed | PLAN-00:73, WAVE-07:12, WAVE-03:19, WAVE-05:28, HUMAN-05:26 |

## Regression sweep

| Check | Result |
|---|---|
| Stale `/assets/` or `public/assets` references | None left. The remaining hits are valid: Vite's `dist/assets/*.js` (PLAN-01:226), flybody's `fruitfly/assets/` path, and `src/data/assets.test.ts` |
| Wave format | Each of the 9 waves has as many `- Acceptance:` lines as `### T` tasks. Headers and gates are present |
| Tasks in each wave touch separate files | Yes. The new `public/404.html` is owned only by T03.1. `cli.py` and `test_cli.py` are re-owned only by T07.1 |
| AGENT.md / README / CLAUDE.md | 90 lines / 28 lines / exactly `@AGENT.md` |
| Security and coverage | Unchanged from round 1, still pass |

## Blocking issue

| # | Where | Problem | Fix |
|---|---|---|---|
| R1 | HUMAN-05:31, PLAN-01 §2b (lines 98-106), HUMAN-04:33 | The point-cloud fallback (used if FlyWire says no) still runs `fetch-brain --skip-neuropils`. That still downloads skeletons, which needs a FlyWire token and pulls in exactly the data we may not re-host. Also, nothing in the raw layout stores the selected neuron ids. When `skeletons.npz` is absent, `build --points --no-neuron-lines` has no defined source for its neuron activity channels | Add `brain/selected_neurons.json` to §2b, written by `fetch-brain`. Give `fetch-brain` a selection-only mode (`--skip-neuropils --skip-skeletons`) that needs no token. `build` reads that file, or calls `select_neurons` itself when the file is missing. Fallback commands in HUMAN-05 step 5: `--skip-neuropils --skip-skeletons`. HUMAN-04:33 should list `--with-synapses`, `--points` and `--no-neuron-lines` |

## Non-blocking nits

1. WAVE-00:33: `.gitattributes` is missing `*.hdf5`, `*.feather` and `*.npy`, which the test raw data in WAVE-07:9 uses.
2. HUMAN-05:36: `budget --dist dist` runs before any `npm run build`. Add `npm run build` first.
3. WAVE-03:24: match the content type with `includes('application/json')`, because servers send `; charset=utf-8`.
4. WAVE-06:31: `--n-proc` is listed twice.
