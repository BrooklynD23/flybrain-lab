# Status

Updated by the loop-build workflow after each wave gate.

| Wave | Status | Last gate result |
|---|---|---|
| WAVE-00 bootstrap | passed | gate ok 2026-10-14 @ea32d9d (r2, .gitignore fix) |
| WAVE-01 contracts | passed | gate ok 2026-10-14 @3d78f1f |
| WAVE-02 pipeline-writers | passed | gate ok 2026-10-14 @86c322f |
| WAVE-03 fixtures-data-layer | passed | gate ok 2026-10-14 @e8ea166 |
| WAVE-04 scene-and-ui-components | passed | gate ok 2026-10-15 @1bc0321 |
| WAVE-05 app-and-live-narration | passed | gate ok 2026-10-15 @1040219 |
| WAVE-06 pipeline-sources | passed | gate ok 2026-10-15 @07dddc7 |
| WAVE-07 asset-build | todo | — |
| WAVE-08 deploy-e2e-release | todo | — |

| Human step | Status |
|---|---|
| HUMAN-01 github-repo | todo |
| HUMAN-02 cloudflare-pages | todo |
| HUMAN-03 anthropic-key (optional) | todo |
| HUMAN-04 flywire-licence-email | todo |
| HUMAN-05 real-data-pipeline-run | todo |
| HUMAN-06 demo-video | todo |

## Cross-review 2026-10-14
- WAVE-01/02/03/06/07 task acceptance: `pytest --cov-fail-under=0` -> `--no-cov` (12 places); addopts `--cov` made parallel tasks write the same `pipeline/.coverage`. Gates still enforce 80%.
- WAVE-05 T05.1: dropped `npm run build` from task acceptance; build stays in the wave gate.
- WAVE-08 T08.1: acceptance `playwright install && npm run e2e` -> `npx playwright test --list`; gate now runs `npx playwright install chromium` before `npm run e2e`.
