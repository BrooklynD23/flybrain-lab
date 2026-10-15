import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ManifestSchema, NarrationScriptSchema } from "../contracts/index.ts";
import { NEUROPILS } from "../content/neuropils.ts";

const PUBLIC = resolve(process.cwd(), "public");
const MANIFESTS = ["fixtures/manifest.json", "data/manifest.json"].filter((p) =>
  existsSync(join(PUBLIC, p)),
);

// Reads the JSON chunk of a .glb (header 12 bytes, then chunk length + type).
function glbJson(path: string): { animations?: { name?: string }[] } {
  const buf = readFileSync(path);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  expect(view.getUint32(0, true)).toBe(0x46546c67); // "glTF"
  const len = view.getUint32(12, true);
  expect(view.getUint32(16, true)).toBe(0x4e4f534a); // "JSON"
  return JSON.parse(new TextDecoder().decode(buf.subarray(20, 20 + len)));
}

it("finds at least the fixture manifest", () => {
  expect(MANIFESTS).toContain("fixtures/manifest.json");
});

describe.each(MANIFESTS)("asset contract: %s", (rel) => {
  const dir = join(PUBLIC, dirname(rel));
  const manifest = ManifestSchema.parse(
    JSON.parse(readFileSync(join(PUBLIC, rel), "utf8")),
  );

  it("references only files that exist", () => {
    const files = [
      manifest.brain.neuropils.url,
      manifest.brain.neurons.url,
      manifest.body.url,
      ...manifest.behaviors.map((b) => b.activity.url),
    ];
    for (const f of files) expect(existsSync(join(dir, f)), f).toBe(true);
    for (const b of manifest.behaviors) {
      expect(existsSync(join(PUBLIC, b.narrationUrl)), b.narrationUrl).toBe(
        true,
      );
    }
  });

  it("activity file length = nBins x channels", () => {
    for (const b of manifest.behaviors) {
      const { url, nBins, channels } = b.activity;
      expect(readFileSync(join(dir, url)).length, url).toBe(
        nBins * channels.length,
      );
    }
  });

  it("narration parses and focuses known neuropils", () => {
    const known = new Set([
      ...manifest.brain.neuropils.ids,
      ...Object.keys(NEUROPILS),
    ]);
    for (const b of manifest.behaviors) {
      const script = NarrationScriptSchema.parse(
        JSON.parse(readFileSync(join(PUBLIC, b.narrationUrl), "utf8")),
      );
      for (const cue of script.cues) {
        for (const id of cue.focus.neuropils)
          expect(known.has(id), id).toBe(true);
      }
    }
  });

  it("fly.glb has one animation per behavior", () => {
    const names = (glbJson(join(dir, manifest.body.url)).animations ?? []).map(
      (a) => a.name,
    );
    expect([...names].sort()).toEqual(
      manifest.behaviors.map((b) => b.id).sort(),
    );
  });
});
