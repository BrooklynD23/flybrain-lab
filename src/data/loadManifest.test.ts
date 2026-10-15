import { describe, expect, it } from "vitest";

import { type FetchFn, loadManifest, ManifestError } from "./loadManifest.ts";

const validManifest = {
  version: 1,
  dataSource: "fixture",
  brain: {
    neuropils: { url: "brain.glb", kind: "mesh", ids: ["GNG"] },
    neurons: {
      url: "neurons.glb",
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
  body: { url: "fly.glb" },
  behaviors: [
    {
      id: "walking",
      label: "Walking",
      durationMs: 4000,
      clipSource: "keyframed",
      activity: {
        url: "activity/walking.bin",
        binMs: 50,
        nBins: 80,
        channels: ["GNG"],
        maxHz: [30],
        encoding: "uint8-bin-major",
      },
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

function jsonResponse(body: unknown, contentType = "application/json") {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": contentType },
  });
}

/** Records requested URLs; the handler maps URL -> Response (or throw). */
function makeFetch(handler: (url: string) => Response) {
  const calls: string[] = [];
  const fetchFn: FetchFn = async (input) => {
    const url = String(input);
    calls.push(url);
    return handler(url);
  };
  return { fetchFn, calls };
}

const DATA = "/data/manifest.json";
const FIXTURES = "/fixtures/manifest.json";

describe("loadManifest", () => {
  it("returns the parsed manifest and base /data when /data serves JSON", async () => {
    const { fetchFn, calls } = makeFetch(() => jsonResponse(validManifest));
    const { manifest, base } = await loadManifest(fetchFn);
    expect(manifest.behaviors[0]!.id).toBe("walking");
    expect(base).toBe("/data");
    expect(calls).toEqual([DATA]);
  });

  it("falls back to /fixtures on a non-OK status", async () => {
    const { fetchFn, calls } = makeFetch((url) =>
      url === DATA
        ? new Response("nope", { status: 404 })
        : jsonResponse(validManifest),
    );
    const { manifest, base } = await loadManifest(fetchFn);
    expect(manifest.dataSource).toBe("fixture");
    expect(base).toBe("/fixtures");
    expect(calls).toEqual([DATA, FIXTURES]);
  });

  it("falls back on a 200 with a non-JSON content-type (HTML fallback page)", async () => {
    const { fetchFn, calls } = makeFetch((url) =>
      url === DATA
        ? new Response("<!doctype html><title>FlyBrain Lab</title>", {
            status: 200,
            headers: { "content-type": "text/html" },
          })
        : jsonResponse(validManifest),
    );
    const { base } = await loadManifest(fetchFn);
    expect(base).toBe("/fixtures");
    expect(calls).toEqual([DATA, FIXTURES]);
  });

  it("falls back on a JSON parse error", async () => {
    const { fetchFn, calls } = makeFetch((url) =>
      url === DATA
        ? new Response("{not json", {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        : jsonResponse(validManifest),
    );
    const { base } = await loadManifest(fetchFn);
    expect(base).toBe("/fixtures");
    expect(calls).toEqual([DATA, FIXTURES]);
  });

  it("accepts 'application/json; charset=utf-8' as a JSON content-type", async () => {
    const { fetchFn, calls } = makeFetch(() =>
      jsonResponse(validManifest, "application/json; charset=utf-8"),
    );
    const { base } = await loadManifest(fetchFn);
    expect(base).toBe("/data");
    expect(calls).toEqual([DATA]);
  });

  it("throws ManifestError with a readable message when both URLs are unusable", async () => {
    const { fetchFn } = makeFetch(() => new Response("gone", { status: 404 }));
    const err = await loadManifest(fetchFn).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ManifestError);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).name).toBe("ManifestError");
    expect((err as Error).message).toMatch(/manifest|data/i);
  });

  it("throws ManifestError on a network failure", async () => {
    const fetchFn: FetchFn = () =>
      Promise.reject(new TypeError("fetch failed"));
    const err = await loadManifest(fetchFn).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ManifestError);
    expect((err as Error).message).toMatch(/reach|load|connection/i);
  });

  it("throws ManifestError on a schema violation without falling back", async () => {
    const bad = { ...validManifest, version: 2 };
    const { fetchFn, calls } = makeFetch(() => jsonResponse(bad));
    const err = await loadManifest(fetchFn).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ManifestError);
    expect((err as Error).message).toMatch(/invalid/i);
    expect(calls).toEqual([DATA]);
  });

  it("rejects a manifest whose activity bins do not cover durationMs", async () => {
    const bad = structuredClone(validManifest);
    bad.behaviors[0]!.durationMs = 4001; // 80 bins * 50 ms !== 4001
    const { fetchFn } = makeFetch(() => jsonResponse(bad));
    const err = await loadManifest(fetchFn).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ManifestError);
    expect((err as Error).message).toMatch(/binms|duration/i);
  });

  it("validates the fixture manifest too", async () => {
    const bad = { ...validManifest, dataSource: "flywire-999" };
    const { fetchFn } = makeFetch((url) =>
      url === DATA ? new Response("nope", { status: 404 }) : jsonResponse(bad),
    );
    const err = await loadManifest(fetchFn).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ManifestError);
  });
});
