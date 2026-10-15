# WAVE-01 — Shared contracts: zod schemas, JSON Schemas, Python validator
Depends on: WAVE-00
Human prerequisites: none

## Tasks
### T01.1 — TS contracts and JSON Schema emit
- Files: `src/contracts/manifest.ts`, `src/contracts/activity.ts`, `src/contracts/narration.ts`, `src/contracts/api.ts`, `src/contracts/index.ts`, `src/contracts/contracts.test.ts`, `scripts/emit-schemas.ts`, `scripts/emit-schemas.test.ts`, `schemas/*.schema.json`
- Do:
  1. Implement the zod schemas and inferred types exactly as in [PLAN-01 §2](PLAN-01-architecture.md#2-data-contracts): `BEHAVIORS`, `ManifestSchema`, `ActivityInfoSchema`, `NarrationScriptSchema`, `NarrateRequestSchema`, `NarrateResponseSchema`. Use `.strict()` objects.
  2. Refinements: `activity.maxHz.length === channels.length`; `nBins * binMs === durationMs` (checked at manifest level per behavior); cue `tMs` ascending and `< durationMs` is checked by the app, not the schema; `question` trimmed 1–280; `active` max 10; ids match `/^[A-Za-z0-9_]{1,20}$/`; URLs are relative paths (`/^[a-z0-9_\-/.]+$/`, no `..`).
  3. `index.ts` re-exports everything. Every relative import in `src/contracts/` and `scripts/` uses an explicit `.ts` extension (e.g. `./manifest.ts`), because `npm run contracts` runs `node scripts/emit-schemas.ts` with Node type stripping.
  4. `scripts/emit-schemas.ts`: for each schema call `z.toJSONSchema(schema)` and write `schemas/<name>.schema.json` (stable key order, 2-space indent, trailing newline). Export a pure `renderSchemas(): Record<string,string>` for tests.
  5. Run `npm run contracts` and commit `schemas/`.
- Tests: `src/contracts/contracts.test.ts` — one valid and at least two invalid samples per schema (wrong behavior id, mismatched `maxHz` length, question 281 chars, 11 `active` items, url with `..`). `scripts/emit-schemas.test.ts` — `renderSchemas()` returns 4 entries, each parses as JSON and has `$schema`.
- Acceptance: `npx vitest run src/contracts scripts && npm run contracts:check`
### T01.2 — Python schema validator
- Files: `pipeline/src/flybrain_pipeline/validate.py`, `pipeline/tests/test_validate.py`, `pipeline/tests/data/schemas/tiny.schema.json`
- Do:
  1. `load_schema(name: str, schema_dir: Path) -> dict` reads `schemas/<name>.schema.json`.
  2. `validate_file(path: Path, name: str, schema_dir: Path) -> list[str]` returns error messages (empty = valid) using `jsonschema.Draft202012Validator`; never raises on invalid data; raises `FileNotFoundError` with a clear message on a missing schema.
  3. `main(argv)` for `python -m flybrain_pipeline.validate <file> <schema-name> [--schema-dir schemas]`; exit 1 and print errors when invalid.
  4. Tests use only `tests/data/schemas/tiny.schema.json`, so this task does not depend on T01.1 files.
- Tests: `pipeline/tests/test_validate.py` — valid file passes; invalid file returns errors with JSON path; missing schema raises; CLI exit codes 0/1.
- Acceptance: `uv run --directory pipeline pytest tests/test_validate.py --no-cov && uv run --directory pipeline ruff check .`

## Wave gate
- Commands: `npm run lint && npm test && npm run contracts:check && npm run build && uv run --directory pipeline pytest && uv run --directory pipeline ruff check . && ! uv run --project pipeline python -m flybrain_pipeline.validate schemas/manifest.schema.json manifest --schema-dir schemas` (the last step must fail: a schema file is not a valid manifest)
- Review focus: contracts match PLAN-01 §2 field-for-field; schemas are generated, not hand-written; refinements that cannot be expressed in JSON Schema are listed in a comment so Python callers know to re-check them; URL fields cannot escape the asset root; no `any`.
