# WAVE-00 — Bootstrap: repo, scaffold, CI, lint, test runners
Depends on: none
Human prerequisites: none

## Tasks
### T00.1 — Web scaffold (Vite + React + r3f + vitest)
- Files: `package.json`, `package-lock.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `src/main.tsx`, `src/App.tsx`, `src/App.test.tsx`, `src/vite-env.d.ts`
- Do:
  1. Create `package.json` (`"type": "module"`, `"private": true`, `engines.node >=24`). Install with `--save-exact` the versions in [PLAN-01 §5](PLAN-01-architecture.md#5-pinned-stack): runtime `react`, `react-dom`, `three`, `@react-three/fiber`, `@react-three/drei`, `zod`; dev `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `@types/three`, `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `prettier`, `@playwright/test`, `@gltf-transform/cli`, `wrangler`. These are all deps the project will use; later waves must not add any.
  2. If `typescript@7.0.2` breaks `typescript-eslint` or `tsc --noEmit`, pin the latest 6.x instead and note it in the commit body.
  3. Scripts: `dev`=`vite`, `build`=`tsc --noEmit && vite build`, `preview`=`vite preview --port 4173`, `test`=`vitest run --coverage`, `lint`=`eslint . && prettier --check . && tsc --noEmit`, `e2e`=`playwright test`, `contracts`=`node scripts/emit-schemas.ts`, `contracts:check`=`node scripts/emit-schemas.ts && git diff --exit-code schemas/`.
  4. `vite.config.ts`: react plugin; `test` block with `environment: 'jsdom'`, `include: ['src/**/*.test.{ts,tsx}', 'functions/**/*.test.ts', 'scripts/**/*.test.ts']`, coverage provider v8, `include: ['src/**', 'functions/**']`, `exclude: ['src/scene/*.tsx', 'src/main.tsx', '**/*.test.*']`, thresholds lines/branches/functions/statements 80.
  5. `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `moduleResolution: bundler`, `noEmit`, `allowImportingTsExtensions: true`, `erasableSyntaxOnly: true` (so `node scripts/*.ts` runs with Node type stripping; relative imports in `src/contracts` and `scripts` use explicit `.ts` extensions), include `src`, `functions`, `scripts`, `e2e`.
  6. `eslint.config.js` flat config with typescript-eslint recommended + react-hooks and `ignores: ['.claude/**', 'pipeline/**', 'dist/**', 'coverage/**', 'playwright-report/**', 'public/**']`. `.prettierignore`: `dist`, `coverage`, `public/fixtures`, `public/data`, `schemas`, `pipeline`, `docs`, `*.md`, `.claude`, `package-lock.json`.
  7. `src/App.tsx` renders `<h1>FlyBrain Lab</h1>`; `src/main.tsx` mounts it.
- Tests: `src/App.test.tsx` — renders App, finds heading "FlyBrain Lab".
- Acceptance: `npm ci && npm run lint && npm test && npm run build`
### T00.2 — Pipeline scaffold (uv, Python 3.12, pytest-cov, ruff)
- Files: `pipeline/pyproject.toml`, `pipeline/uv.lock`, `pipeline/.python-version`, `pipeline/src/flybrain_pipeline/__init__.py`, `pipeline/src/flybrain_pipeline/cli.py`, `pipeline/tests/test_cli.py`
- Do:
  1. `pipeline/.python-version` = `3.12`. `pyproject.toml`: name `flybrain-pipeline`, `requires-python = ">=3.12,<3.13"`, src layout, script `flybrain = "flybrain_pipeline.cli:main"`.
  2. Dependencies (pins per [PLAN-01 §5](PLAN-01-architecture.md#5-pinned-stack)): `numpy`, `pandas`, `pyarrow`, `mujoco`, `h5py`, `fast-simplification`, `jsonschema`. Optional extra `fetch`: `fafbseg`, `navis`. Dev group: `pytest`, `pytest-cov`, `ruff`. These are all pipeline deps; later waves must not add any.
  3. `[tool.pytest.ini_options]`: `testpaths=["tests"]`, `addopts="--cov=flybrain_pipeline --cov-report=term-missing --cov-fail-under=80"`. `[tool.ruff]`: line-length 100, select `E,F,I,B,UP`.
  4. `cli.py`: argparse with `--version` only; `main(argv=None) -> int`.
  5. `uv lock`.
- Tests: `pipeline/tests/test_cli.py` — `main(["--version"])` prints the package version and exits 0.
- Acceptance: `uv sync --project pipeline && uv run --directory pipeline pytest && uv run --directory pipeline ruff check . && uv run --directory pipeline ruff format --check .`
### T00.3 — Git, repo hygiene, CI
- Files: `.git/`, `.gitignore`, `.gitattributes`, `.nvmrc`, `.editorconfig`, `.github/workflows/ci.yml`
- Do:
  1. `git init -b main` if no repo exists.
  2. `.gitignore`: `node_modules/`, `dist/`, `coverage/`, `.venv/`, `__pycache__/`, `.pytest_cache/`, `.ruff_cache/`, `playwright-report/`, `test-results/`, `.wrangler/`, `.dev.vars`, `pipeline/data/`, `pipeline/sims/shiu/vendor/`, `pipeline/sims/shiu/.venv/`.
  3. `.gitattributes`: `*.glb binary`, `*.bin binary`, `*.parquet binary`, `*.npz binary`, `*.h5 binary`, `*.hdf5 binary`, `*.feather binary`, `*.npy binary`.
  4. `.nvmrc` = `24`.
  5. `ci.yml`: on push + pull_request; job `web` (ubuntu-latest, `actions/setup-node` with `.nvmrc`, `npm ci`, `npm run lint`, `npm test`, `npm run build`); job `pipeline` (`astral-sh/setup-uv`, `uv sync --project pipeline`, ruff check + format check, `uv run --directory pipeline pytest`). Pin actions to a major tag. `permissions: contents: read`.
- Tests: none (config only); validated by actionlint.
- Acceptance: `git rev-parse --is-inside-work-tree && uvx --from actionlint-py actionlint .github/workflows/ci.yml`

## Wave gate
- Commands: `npm ci && npm run lint && npm test && npm run build && uv sync --project pipeline && uv run --directory pipeline pytest && uv run --directory pipeline ruff check . && uv run --directory pipeline ruff format --check . && uvx --from actionlint-py actionlint`
- Review focus: exact version pins match PLAN-01 (or documented fallback); coverage thresholds actually enforced (80) in both runners; no secrets or tokens in any file; `.gitignore` covers data, venvs and `.dev.vars`; CI uses least-privilege permissions; no extra deps beyond the PLAN-01 list.
