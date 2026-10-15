import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { NarrationScriptSchema } from "../contracts/narration.ts";
import { NEUROPILS } from "./neuropils.ts";

const BEHAVIOR_FILES = ["walking", "grooming", "feeding", "escape"] as const;

function scriptPath(behavior: string): string {
  return join(process.cwd(), "public", "narration", `${behavior}.json`);
}

function loadScript(behavior: string): unknown {
  return JSON.parse(readFileSync(scriptPath(behavior), "utf8"));
}

describe("narration scripts", () => {
  it.each(BEHAVIOR_FILES)(
    "%s.json parses with NarrationScriptSchema and names its behavior",
    (behavior) => {
      const parsed = NarrationScriptSchema.safeParse(loadScript(behavior));
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.behavior).toBe(behavior);
    },
  );

  it.each(BEHAVIOR_FILES)(
    "%s has 6-8 cues, ascending in tMs and all < 4000 ms",
    (behavior) => {
      const script = NarrationScriptSchema.parse(loadScript(behavior));
      expect(script.cues.length).toBeGreaterThanOrEqual(6);
      expect(script.cues.length).toBeLessThanOrEqual(8);
      let previous = -1;
      for (const cue of script.cues) {
        expect(cue.tMs).toBeGreaterThan(previous);
        expect(cue.tMs).toBeLessThan(4000);
        previous = cue.tMs;
      }
    },
  );

  it.each(BEHAVIOR_FILES)(
    "%s focus neuropil ids all exist in neuropils.ts",
    (behavior) => {
      const script = NarrationScriptSchema.parse(loadScript(behavior));
      for (const cue of script.cues) {
        for (const id of cue.focus.neuropils) {
          expect(NEUROPILS).toHaveProperty(id);
        }
      }
    },
  );

  it.each(BEHAVIOR_FILES)(
    "%s every cue is <= 280 chars and states 'simulated model'",
    (behavior) => {
      const script = NarrationScriptSchema.parse(loadScript(behavior));
      for (const cue of script.cues) {
        expect(cue.text.length).toBeLessThanOrEqual(280);
        expect(cue.text.toLowerCase()).toContain("simulated model");
      }
    },
  );

  it.each(BEHAVIOR_FILES)("%s has 3-5 qa pairs", (behavior) => {
    const script = NarrationScriptSchema.parse(loadScript(behavior));
    expect(script.qa.length).toBeGreaterThanOrEqual(3);
    expect(script.qa.length).toBeLessThanOrEqual(5);
  });

  it.each(["walking", "escape"] as const)(
    "%s labels its stimulus as an assumption (contains 'assum')",
    (behavior) => {
      const raw = readFileSync(scriptPath(behavior), "utf8");
      expect(raw.toLowerCase()).toContain("assum");
    },
  );

  it("feeding names sugar GRNs -> MN9 and cites Shiu et al. 2024", () => {
    const raw = readFileSync(scriptPath("feeding"), "utf8");
    expect(raw).toContain("GRN");
    expect(raw).toContain("MN9");
    expect(raw).toContain("Shiu");
  });

  it("no cue claims activity was recorded from a real fly", () => {
    for (const behavior of BEHAVIOR_FILES) {
      const script = NarrationScriptSchema.parse(loadScript(behavior));
      for (const cue of script.cues) {
        expect(cue.text.toLowerCase()).not.toMatch(
          /recorded (from|in) a (real|live) fly/,
        );
      }
    }
  });
});

describe("neuropils glossary", () => {
  const REQUIRED_IDS = [
    "GNG",
    "PRW",
    "AMMC_L",
    "AMMC_R",
    "LO_L",
    "LO_R",
    "LOP_L",
    "LOP_R",
    "AL_L",
    "AL_R",
    "MB_CA_L",
    "MB_PED_R",
    "MB_VL_L",
    "MB_ML_R",
    "FB",
    "EB",
    "PB",
  ] as const;

  it.each(REQUIRED_IDS)("covers required neuropil id %s", (id) => {
    expect(NEUROPILS).toHaveProperty(id);
  });

  it("covers all 78 FlyWire neuropil ids", () => {
    expect(Object.keys(NEUROPILS)).toHaveLength(78);
  });

  it("every entry has a name, a role and an https source link", () => {
    for (const [id, info] of Object.entries(NEUROPILS)) {
      expect(id).toMatch(/^[A-Za-z0-9_]{1,20}$/);
      expect(info.name.length).toBeGreaterThan(0);
      expect(info.role.length).toBeGreaterThan(0);
      expect(info.source).toMatch(/^https:\/\//);
    }
  });
});
