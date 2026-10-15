# AGENT.md — FlyBrain Lab

## Mission

FlyBrain Lab is a hosted, static web app for a general audience. It shows the *Drosophila* brain in 3D (FlyWire neuropils plus a curated set of about 400 neurons) next to a 3D fly body. The user picks a behavior: walking, grooming, feeding or escape. The body animates that behavior. Simulated brain activity (Shiu et al. LIF model) plays on the same timeline. An offline Python pipeline turns the source data into small static assets. The site works with no API key (replay narration). An optional live mode answers audience questions through one rate-limited Pages Function. Scope and demo: [PLAN-00](docs/PLAN-00-overview.md).

## Stack (pinned; full table with links and reasons in [PLAN-01 §5](docs/PLAN-01-architecture.md#5-pinned-stack))

| Layer | Pins |
|---|---|
| Web | Node 24 LTS, vite 8.3.4, react 19.3.1, three 0.186.1, @react-three/fiber 9.8.2, @react-three/drei 10.7.9, zod 4.6.7, typescript 7.0.2 |
| Test/lint | vitest 5.0.4 + @vitest/coverage-v8 5.0.4, @playwright/test 1.64.1, eslint 10.12.0, prettier 3.9.10 |
| Assets/deploy | @gltf-transform/cli 4.5.1, wrangler 4.151.0, Cloudflare Pages Free |
| Pipeline | Python 3.12, uv 0.13.1, numpy 2.5.4, pandas 3.0.6, pyarrow 26.0.0, mujoco 3.16.0, fast-simplification 0.2.0, pytest 9.1.1, ruff 0.17.0 |
| Brain sim env | `pipeline/sims/shiu/`: Python 3.10, Brian2 as pinned by the Shiu repo `environment.yml` |
| LLM (live mode only) | Anthropic Messages API over `fetch`, `claude-haiku-5-5` default, `claude-sonnet-5-5` optional |

## Repo layout

```
src/            React app: contracts/ data/ narration/ scene/ components/ content/
functions/api/  narrate.ts — the only server code (Pages Function)
schemas/        JSON Schemas generated from src/contracts (do not hand-edit)
public/         fixtures/ (tiny synthetic, committed)  data/ (real, committed after HUMAN-05)  narration/
pipeline/       uv project (py3.12): src/flybrain_pipeline/, tests/, config/
pipeline/sims/shiu/  separate uv project (py3.10) that runs the Shiu brain model
e2e/            Playwright demo-flow tests
docs/           PLAN, WAVE, HUMAN, RESEARCH, STATUS
```

## Commands

| Task | Command |
|---|---|
| Install | `npm ci && uv sync --project pipeline` |
| Dev server | `npm run dev` (Pages Function: `npm run build && npx wrangler pages dev dist`) |
| Unit tests + coverage | `npm test` and `uv run --directory pipeline pytest` |
| Brain-sim env tests | `uv run --directory pipeline/sims/shiu pytest` |
| Lint + types | `npm run lint` and `uv run --directory pipeline ruff check . && uv run --directory pipeline ruff format --check .` |
| Contracts | `npm run contracts` (regenerate `schemas/`), `npm run contracts:check` (fails on drift) |
| Build | `npm run build` |
| E2E | `npm run e2e` |
| Fixture assets | `uv run --project pipeline flybrain fixtures --out public/fixtures` |
| Real assets | see [HUMAN-05](docs/HUMAN-05-real-data-pipeline-run.md) |

## Conventions

1. Contracts live in `src/contracts/*.ts` as zod schemas. `npm run contracts` emits `schemas/*.schema.json`. Python validates against those files. Never edit `schemas/` by hand.
2. Dependency manifests (`package.json`, `pipeline/pyproject.toml`, lockfiles) change only in WAVE-00; the separate `pipeline/sims/shiu/` project is created by WAVE-06 T06.3. A later task that needs a new dependency stops and asks for a replan.
3. TDD: write the task's named tests first, see them fail, then implement.
4. Coverage gate: 80% lines/branches/functions for `src/` + `functions/` (vitest) and `flybrain_pipeline` (pytest-cov). `src/scene/*.tsx` render code is covered by Playwright, not unit tests; keep logic out of it.
5. Immutable data: return new objects; do not mutate inputs.
6. Secrets only from env: `ANTHROPIC_API_KEY` (Pages secret). Nothing secret in `VITE_*` vars; they ship to the browser.
7. Validate at boundaries: zod on every fetched asset and on `/api/narrate` input; jsonschema on every pipeline output.
8. Every scientific claim in the UI carries its label: "simulated model, assumed signs", "keyframed", or "reference replay".
9. Conventional commits (`feat:`, `fix:`, `test:` ...). Never push or deploy from an agent.
10. Docs: plain English, tables over prose, every external claim has a link.

## Quality bar

- All gate commands in the wave file exit 0.
- No console errors in the demo flow. 30 fps target on a mid laptop (`?debug=1` shows fps).
- First load within the asset budget ([PLAN-01 §6](docs/PLAN-01-architecture.md#6-asset-budget)).
- Works offline from keys: `VITE_NARRATION_MODE=replay` is the default.
- Attribution panel lists every data source and licence from [RESEARCH-03](docs/RESEARCH-03-licences-citations.md).

## Where to look

| Need | Doc |
|---|---|
| Scope, demo script, risks, hours | [PLAN-00](docs/PLAN-00-overview.md) |
| Components, contracts, sequence, budget | [PLAN-01](docs/PLAN-01-architecture.md) |
| Wave map and DAG | [PLAN-02](docs/PLAN-02-waves.md) |
| Current task | `docs/WAVE-NN-*.md`, progress in [STATUS](docs/STATUS.md) |
| Human setup | `docs/HUMAN-NN-*.md` |
| Data sources, sim facts | [RESEARCH-01](docs/RESEARCH-01-fly-projects.md) |
| Versions, hosting limits | [RESEARCH-02](docs/RESEARCH-02-stack-hosting.md) |
| Licences, citations | [RESEARCH-03](docs/RESEARCH-03-licences-citations.md) |

## Loop kit

| Piece | Model | Job |
|---|---|---|
| `.claude/agents/loop-researcher.md` | haiku | read-only lookups |
| `.claude/agents/loop-planner.md` | opus | parse waves, check HUMAN prerequisites, rewrite failing tasks |
| `.claude/agents/loop-implementer.md` | sonnet | one task, TDD, owned files only |
| `.claude/agents/loop-reviewer.md` | opus | production-readiness review per task, wave and release |
| `.claude/workflows/loop-build.js` | — | runs the loop |

Run: ask Claude Code "run the loop-build workflow", or call `Workflow({name:'loop-build', args:{from:0}})`. Per wave: parallel tasks, implement, review, fix (max 3), replan once, wave gate, commit, update [STATUS](docs/STATUS.md). It stops on an unmet HUMAN prerequisite or an unfixable failure. It never pushes or deploys.
