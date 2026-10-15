import { describe, expect, it } from "vitest";

import { ActivityInfoSchema } from "./activity.ts";
import { NarrateRequestSchema, NarrateResponseSchema } from "./api.ts";
import { ManifestSchema } from "./manifest.ts";
import { NarrationScriptSchema } from "./narration.ts";

const validActivity = {
  url: "data/activity/walking.bin",
  binMs: 50,
  nBins: 80,
  channels: ["GNG", "720575940621039145"],
  maxHz: [30, 60],
  encoding: "uint8-bin-major",
};

const validManifest = {
  version: 1,
  dataSource: "fixture",
  brain: {
    neuropils: { url: "data/brain.glb", kind: "mesh", ids: ["GNG"] },
    neurons: {
      url: "data/neurons.glb",
      items: [
        {
          id: "720575940621039145",
          name: "Test neuron",
          cellType: "DNp01",
          neuropil: "GNG",
        },
      ],
    },
  },
  body: { url: "data/fly.glb" },
  behaviors: [
    {
      id: "walking",
      label: "Walking",
      durationMs: 4000,
      clipSource: "keyframed",
      activity: validActivity,
      narrationUrl: "narration/walking.json",
      stimulus: {
        description: "optogenetic activation of descending neurons",
        cellTypes: ["DNp01"],
        assumption: true,
        source: "fixture stimulus",
      },
    },
  ],
  attribution: [
    {
      name: "FlyBrain fixtures",
      licence: "CC0-1.0",
      url: "https://example.org/fixtures",
      citation: "Synthetic test data",
    },
  ],
};

const validNarration = {
  behavior: "walking",
  cues: [
    {
      tMs: 0,
      text: "The fly starts to walk.",
      focus: { neuropils: ["GNG"], neurons: [] },
    },
    {
      tMs: 1500,
      text: "Leg neuropils light up.",
      focus: { neuropils: ["GNG"], neurons: ["720575940621039145"] },
    },
  ],
  qa: [{ q: "What is the fly doing?", a: "Walking." }],
};

const validRequest = {
  behavior: "escape",
  tMs: 1500,
  question: "What is firing right now?",
  active: [{ id: "GNG", hz: 12.5 }],
};

describe("ManifestSchema", () => {
  it("accepts a valid manifest", () => {
    expect(ManifestSchema.safeParse(validManifest).success).toBe(true);
  });

  it("rejects an unknown behavior id", () => {
    const bad = structuredClone(validManifest);
    bad.behaviors[0]!.id = "flying";
    expect(ManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an asset url containing '..'", () => {
    const bad = structuredClone(validManifest);
    bad.body.url = "data/../secret.glb";
    expect(ManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects when activity nBins * binMs != durationMs", () => {
    const bad = structuredClone(validManifest);
    bad.behaviors[0]!.durationMs = 4001;
    expect(ManifestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects extra keys (strict object)", () => {
    const bad = { ...validManifest, extra: true };
    expect(ManifestSchema.safeParse(bad).success).toBe(false);
  });
});

describe("ActivityInfoSchema", () => {
  it("accepts a valid activity info", () => {
    expect(ActivityInfoSchema.safeParse(validActivity).success).toBe(true);
  });

  it("rejects when maxHz length does not match channels length", () => {
    const bad = { ...validActivity, maxHz: [30] };
    expect(ActivityInfoSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a binMs other than 50", () => {
    const bad = { ...validActivity, binMs: 100, nBins: 40 };
    expect(ActivityInfoSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an activity url containing '..'", () => {
    const bad = { ...validActivity, url: "data/../out.bin" };
    expect(ActivityInfoSchema.safeParse(bad).success).toBe(false);
  });
});

describe("NarrationScriptSchema", () => {
  it("accepts a valid narration script", () => {
    expect(NarrationScriptSchema.safeParse(validNarration).success).toBe(true);
  });

  it("rejects an unknown behavior id", () => {
    const bad = { ...validNarration, behavior: "flying" };
    expect(NarrationScriptSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a cue text longer than 280 chars", () => {
    const bad = structuredClone(validNarration);
    bad.cues[0]!.text = "x".repeat(281);
    expect(NarrationScriptSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a focus id with invalid characters", () => {
    const bad = structuredClone(validNarration);
    bad.cues[0]!.focus.neuropils = ["BAD ID!"];
    expect(NarrationScriptSchema.safeParse(bad).success).toBe(false);
  });
});

describe("NarrateRequestSchema", () => {
  it("accepts a valid request", () => {
    expect(NarrateRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it("trims question then enforces 1..280 chars", () => {
    const ok = NarrateRequestSchema.safeParse({
      ...validRequest,
      question: "  hi  ",
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.question).toBe("hi");
    expect(
      NarrateRequestSchema.safeParse({ ...validRequest, question: "   " })
        .success,
    ).toBe(false);
  });

  it("rejects a question longer than 280 chars", () => {
    const bad = { ...validRequest, question: "q".repeat(281) };
    expect(NarrateRequestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects more than 10 active items", () => {
    const bad = {
      ...validRequest,
      active: Array.from({ length: 11 }, (_, i) => ({
        id: `n${i}`,
        hz: 1,
      })),
    };
    expect(NarrateRequestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an active id that does not match the id regex", () => {
    const bad = { ...validRequest, active: [{ id: "bad id!", hz: 1 }] };
    expect(NarrateRequestSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a non-integer or out-of-range tMs", () => {
    expect(
      NarrateRequestSchema.safeParse({ ...validRequest, tMs: 1.5 }).success,
    ).toBe(false);
    expect(
      NarrateRequestSchema.safeParse({ ...validRequest, tMs: 60001 }).success,
    ).toBe(false);
  });
});

describe("NarrateResponseSchema", () => {
  it("accepts both response variants", () => {
    expect(
      NarrateResponseSchema.safeParse({ text: "answer", model: "m" }).success,
    ).toBe(true);
    expect(NarrateResponseSchema.safeParse({ error: "nope" }).success).toBe(
      true,
    );
  });

  it("rejects a text response missing model", () => {
    expect(NarrateResponseSchema.safeParse({ text: "answer" }).success).toBe(
      false,
    );
  });

  it("rejects an object mixing both variants (strict)", () => {
    const bad = { text: "answer", model: "m", error: "x" };
    expect(NarrateResponseSchema.safeParse(bad).success).toBe(false);
  });
});
