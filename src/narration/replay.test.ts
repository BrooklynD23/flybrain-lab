import { describe, expect, it } from "vitest";

import type { NarrationScript } from "../contracts/narration.ts";
import {
  answerReplay,
  cueAt,
  loadScript,
  suggestedQuestions,
} from "./replay.ts";

const scriptJson: NarrationScript = {
  behavior: "walking",
  cues: [
    {
      tMs: 500,
      text: "The fly starts to walk. Simulated model.",
      focus: { neuropils: ["GNG"], neurons: [] },
    },
    {
      tMs: 1500,
      text: "Leg neuropils light up.",
      focus: { neuropils: ["GNG"], neurons: ["720575940621039145"] },
    },
    {
      tMs: 3000,
      text: "Walking continues.",
      focus: { neuropils: [], neurons: [] },
    },
  ],
  qa: [
    { q: "What is the fly doing?", a: "It is walking." },
    { q: "Which brain regions are active?", a: "The leg neuropils." },
    { q: "Is this real data?", a: "No, it is a simulated model." },
    { q: "A fourth question?", a: "Fourth answer." },
  ],
};

const fetchOk = (body: unknown = scriptJson) =>
  (() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )) as typeof fetch;

describe("loadScript", () => {
  it("fetches and zod-parses a valid script", async () => {
    const script = await loadScript("/narration/walking.json", fetchOk());
    expect(script.behavior).toBe("walking");
    expect(script.cues).toHaveLength(3);
    expect(script.qa).toHaveLength(4);
  });

  it("rejects cues that are out of order", async () => {
    const bad = structuredClone(scriptJson);
    [bad.cues[0], bad.cues[1]] = [bad.cues[1]!, bad.cues[0]!];
    await expect(
      loadScript("/narration/walking.json", fetchOk(bad)),
    ).rejects.toThrow();
  });

  it("rejects cues with duplicate tMs (not strictly ascending)", async () => {
    const bad = structuredClone(scriptJson);
    bad.cues[1]!.tMs = bad.cues[0]!.tMs;
    await expect(
      loadScript("/narration/walking.json", fetchOk(bad)),
    ).rejects.toThrow();
  });

  it("rejects a schema-invalid script", async () => {
    const bad = { ...scriptJson, behavior: "flying" };
    await expect(
      loadScript("/narration/walking.json", fetchOk(bad)),
    ).rejects.toThrow();
  });

  it("rejects on a non-OK response", async () => {
    const fetch404 = (() =>
      Promise.resolve(new Response("nope", { status: 404 }))) as typeof fetch;
    await expect(
      loadScript("/narration/walking.json", fetch404),
    ).rejects.toThrow();
  });

  it("rejects on a non-JSON body", async () => {
    const fetchHtml = (() =>
      Promise.resolve(
        new Response("<html></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      )) as typeof fetch;
    await expect(
      loadScript("/narration/walking.json", fetchHtml),
    ).rejects.toThrow();
  });
});

describe("cueAt", () => {
  const script = {
    ...scriptJson,
    cues: scriptJson.cues.map((c) => ({ ...c })),
  };

  it("returns null before the first cue", () => {
    expect(cueAt(script, 0)).toBeNull();
    expect(cueAt(script, 499)).toBeNull();
  });

  it("returns the cue at its exact tMs", () => {
    expect(cueAt(script, 500)?.text).toBe(
      "The fly starts to walk. Simulated model.",
    );
    expect(cueAt(script, 1500)?.text).toBe("Leg neuropils light up.");
  });

  it("returns the last cue at or before tMs between cues", () => {
    expect(cueAt(script, 501)?.text).toBe(
      "The fly starts to walk. Simulated model.",
    );
    expect(cueAt(script, 2999)?.text).toBe("Leg neuropils light up.");
  });

  it("returns the last cue after the final cue", () => {
    expect(cueAt(script, 99999)?.text).toBe("Walking continues.");
  });

  it("returns null for an empty cue list", () => {
    expect(cueAt({ ...script, cues: [] }, 1000)).toBeNull();
  });
});

describe("answerReplay", () => {
  it("answers an exact match after normalization", () => {
    expect(answerReplay(scriptJson, "What is the fly doing?")).toBe(
      "It is walking.",
    );
    expect(answerReplay(scriptJson, "  WHAT   is THE fly doing?! ")).toBe(
      "It is walking.",
    );
  });

  it("answers the best token-overlap qa entry at or above 0.5", () => {
    // tokens {what,is,the,fly,doing,right,now} vs {what,is,the,fly,doing} -> 5/7
    expect(answerReplay(scriptJson, "what is the fly doing right now")).toBe(
      "It is walking.",
    );
  });

  it("returns the fallback below the 0.5 overlap threshold", () => {
    // shares at most 1 token with any entry
    expect(answerReplay(scriptJson, "tell me about wing muscles")).toBe(
      "Replay mode has no answer for that. Try one of the suggested questions.",
    );
  });

  it("returns the fallback for an empty question", () => {
    expect(answerReplay(scriptJson, "   ")).toBe(
      "Replay mode has no answer for that. Try one of the suggested questions.",
    );
  });

  it("returns the fallback when qa is empty", () => {
    expect(
      answerReplay({ ...scriptJson, qa: [] }, "What is the fly doing?"),
    ).toBe(
      "Replay mode has no answer for that. Try one of the suggested questions.",
    );
  });
});

describe("suggestedQuestions", () => {
  it("returns the first 3 questions", () => {
    expect(suggestedQuestions(scriptJson)).toEqual([
      "What is the fly doing?",
      "Which brain regions are active?",
      "Is this real data?",
    ]);
  });

  it("returns fewer when qa has fewer than 3 entries", () => {
    const script = { ...scriptJson, qa: [scriptJson.qa[0]!] };
    expect(suggestedQuestions(script)).toEqual(["What is the fly doing?"]);
  });
});
