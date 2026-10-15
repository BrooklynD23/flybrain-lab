import { describe, expect, it } from "vitest";

import type { ActivityInfo } from "../contracts/activity.ts";
import { frameAt, loadActivity, rateAt } from "./activity.ts";
import type { FetchFn } from "./loadManifest.ts";

const info: ActivityInfo = {
  url: "activity/walking.bin",
  binMs: 50,
  nBins: 4,
  channels: ["GNG", "AL_L"],
  maxHz: [30, 60],
  encoding: "uint8-bin-major",
};

// uint8-bin-major: byte[bin * channels.length + channel]
const bytes = new Uint8Array([
  0,
  0, // bin 0: [0 Hz, 0 Hz]
  255,
  128, // bin 1: [30 Hz, 128/255*60 Hz]
  51,
  0, // bin 2: [51/255*30 = 6 Hz, 0 Hz]
  10,
  255, // bin 3: [10/255*30 Hz, 60 Hz]
]);

function bytesFetch(body: Uint8Array, status = 200) {
  const calls: string[] = [];
  const fetchFn: FetchFn = (input) => {
    calls.push(String(input));
    return Promise.resolve(new Response(body.slice(), { status }));
  };
  return { fetchFn, calls };
}

describe("loadActivity", () => {
  it("fetches base + url and returns an Activity", async () => {
    const { fetchFn, calls } = bytesFetch(bytes);
    const activity = await loadActivity(info, "/fixtures", fetchFn);
    expect(calls).toEqual(["/fixtures/activity/walking.bin"]);
    expect(activity.info).toBe(info);
    expect(activity.bytes.length).toBe(8);
  });

  it("rejects when byte length != nBins * channels.length", async () => {
    const { fetchFn } = bytesFetch(bytes.slice(0, 7));
    await expect(loadActivity(info, "/data", fetchFn)).rejects.toThrow(
      /byte|length|corrupt/i,
    );
  });

  it("rejects on a non-OK response", async () => {
    const { fetchFn } = bytesFetch(bytes, 404);
    await expect(loadActivity(info, "/data", fetchFn)).rejects.toThrow(
      /404|load/i,
    );
  });
});

describe("rateAt", () => {
  const activity = { info, bytes };

  it("dequantizes a channel by id: v / 255 * maxHz", () => {
    expect(rateAt(activity, 50, "GNG")).toBe(30); // 255/255 * 30
    expect(rateAt(activity, 50, "AL_L")).toBeCloseTo((128 / 255) * 60);
  });

  it("accepts a channel index", () => {
    expect(rateAt(activity, 100, 0)).toBeCloseTo(6); // 51/255 * 30
    expect(rateAt(activity, 150, 1)).toBe(60); // 255/255 * 60
  });

  it("clamps tMs into the bin range", () => {
    expect(rateAt(activity, -100, "GNG")).toBe(0); // bin 0
    expect(rateAt(activity, 999_999, "GNG")).toBeCloseTo((10 / 255) * 30); // last bin
  });

  it("throws on an unknown channel id", () => {
    expect(() => rateAt(activity, 0, "NOPE")).toThrow(/channel/i);
  });
});

describe("frameAt", () => {
  const activity = { info, bytes };

  it("returns all channels dequantized for the bin at tMs", () => {
    const frame = frameAt(activity, 100);
    expect(frame).toBeInstanceOf(Float32Array);
    expect(frame.length).toBe(2);
    expect(frame[0]).toBeCloseTo(6);
    expect(frame[1]).toBe(0);
  });

  it("clamps tMs into the bin range", () => {
    expect(frameAt(activity, -5)[0]).toBe(0); // bin 0
    expect(frameAt(activity, 999_999)[1]).toBe(60); // bin 3
  });

  it("returns a fresh array on every call", () => {
    const a = frameAt(activity, 50);
    a[0] = -999;
    const b = frameAt(activity, 50);
    expect(b[0]).toBe(30);
    expect(b).not.toBe(a);
  });
});
