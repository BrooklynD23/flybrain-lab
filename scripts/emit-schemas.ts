/// <reference types="node" />
// Needed because the bundler-resolution tsconfig does not auto-include
// @types/node; this file runs under Node only (node scripts/emit-schemas.ts).

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { z } from "zod";

import { ActivityInfoSchema } from "../src/contracts/activity.ts";
import { NarrateRequestSchema } from "../src/contracts/api.ts";
import { ManifestSchema } from "../src/contracts/manifest.ts";
import { NarrationScriptSchema } from "../src/contracts/narration.ts";

// Contract modules enforce extra refinements that JSON Schema cannot express.
// Python callers (jsonschema) must re-check these after validating:
//   - activity: maxHz.length === channels.length
//   - manifest, per behavior: activity.nBins * activity.binMs === durationMs
//   - api: question is trimmed before the 1..280 length check
//   - narration cue tMs ordering / < durationMs: app-side only, not checked
//     by any contract.

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, v]) => [key, sortKeys(v)]),
    );
  }
  return value;
}

const CONTRACTS = [
  ["manifest", ManifestSchema],
  ["activity", ActivityInfoSchema],
  ["narration", NarrationScriptSchema],
  // The api schema validates the POST /api/narrate request body
  // (NarrateRequestSchema); NarrateResponseSchema is app-side only.
  ["api", NarrateRequestSchema],
] as const;

/** Pure: returns { name -> JSON Schema text } for every contract. */
export function renderSchemas(): Record<string, string> {
  return Object.fromEntries(
    CONTRACTS.map(([name, schema]) => [
      name,
      JSON.stringify(sortKeys(z.toJSONSchema(schema)), null, 2) + "\n",
    ]),
  );
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const outDir = fileURLToPath(new URL("../schemas", import.meta.url));
  mkdirSync(outDir, { recursive: true });
  const rendered = renderSchemas();
  for (const [name, text] of Object.entries(rendered)) {
    writeFileSync(path.join(outDir, `${name}.schema.json`), text);
  }
  console.log(`wrote ${Object.keys(rendered).length} schemas to ${outDir}`);
}
