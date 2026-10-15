# HANDOFF — WAVE-00 → WAVE-01

## What exists
- Root vite+react project: `src/App.tsx` (h1 "FlyBrain Lab"), `src/main.tsx`, `vite.config.ts` (jsdom, coverage excludes `src/scene/*.tsx`+`src/main.tsx`, thresholds 80), `tsconfig.json` (strict, noUncheckedIndexedAccess, bundler, noEmit, allowImportingTsExtensions, erasableSyntaxOnly), `eslint.config.js` (typescript-eslint recommended + react-hooks), prettier, `package-lock.json`.
- `pipeline/`: uv project py3.12, src layout, `flybrain_pipeline.cli` (`flybrain --version` → 0.1.0), all §5 pins (numpy, pandas, pyarrow, mujoco, h5py, fast-simplification, jsonschema; `fetch` extra fafbseg+navis installed only via extra), pytest cov-80, ruff.
- Root: `.gitignore` (incl. `.coverage*`), `.gitattributes` binary markers, `.nvmrc` 24, `.editorconfig`, `.github/workflows/ci.yml` (web + pipeline jobs, `permissions: contents: read`).

## Deviations
- `typescript@6.0.3` NOT 7.0.2 — typescript-eslint@8.71.2 peer caps at <6.1.0 (allowed fallback per task).
- eslint.config.js has no `@eslint/js` recommended base (not an approved dep); plain .js files get no core rules.
- react-hooks config resolved via fallback chain.
- npm audit: 3 high transitive vulns inside pinned @gltf-transform/cli (unfixable without unpinning — left as-is).

## Warnings
- Default `node` v26 is WRONG: `export PATH=/home/danny/.nvm/versions/node/v24.22.0/bin:$PATH` before npm/node.
- /mnt/c is extremely slow: first `npm ci` ~14 min; vitest cold-start may hit the 60s worker timeout once — retry passes (warm cache).
- npm blocked `esbuild`/`workerd` postinstall scripts; if `wrangler pages dev` is needed later → `npm install-scripts approve workerd`.
- `npm run contracts` references `scripts/emit-schemas.ts` — created by WAVE-01.

## For WAVE-01 (contracts)
- `src/contracts/*.ts` zod schemas = source of truth; `npm run contracts` emits `schemas/*.schema.json`; drift check stages output + regenerates + `git diff --exit-code`.
