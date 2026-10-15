import { describe, expect, it } from "vitest";

import { hzToColor, hzToOpacity, topActive } from "./brainColors.ts";

/** WCAG relative luminance of an sRGB [r,g,b] triple (channels 0..1). */
function luminance(rgb: readonly [number, number, number]): number {
  const lin = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

describe("hzToColor", () => {
  it("returns the dark-blue floor color at 0 Hz", () => {
    const [r, g, b] = hzToColor(0, 60);
    expect(r).toBeCloseTo(13 / 255, 5);
    expect(g).toBeCloseTo(8 / 255, 5);
    expect(b).toBeCloseTo(135 / 255, 5);
  });

  it("returns the yellow top color at maxHz", () => {
    const [r, g, b] = hzToColor(60, 60);
    expect(r).toBeCloseTo(240 / 255, 5);
    expect(g).toBeCloseTo(249 / 255, 5);
    expect(b).toBeCloseTo(33 / 255, 5);
  });

  it("has strictly monotonic luminance across the ramp", () => {
    let prev = -1;
    for (let i = 0; i <= 200; i++) {
      const lum = luminance(hzToColor((i / 200) * 60, 60));
      expect(lum).toBeGreaterThan(prev);
      prev = lum;
    }
  });

  it("clamps: negative Hz gives the floor, Hz above maxHz gives the top", () => {
    expect(hzToColor(-5, 60)).toEqual(hzToColor(0, 60));
    expect(hzToColor(1e9, 60)).toEqual(hzToColor(60, 60));
  });

  it("returns the floor color when maxHz is 0", () => {
    expect(hzToColor(10, 0)).toEqual(hzToColor(0, 60));
    expect(hzToColor(0, 0)).toEqual(hzToColor(0, 60));
  });

  it("returns the floor color for NaN Hz", () => {
    expect(hzToColor(Number.NaN, 60)).toEqual(hzToColor(0, 60));
  });
});

describe("hzToOpacity", () => {
  it("floors at 0.15 for 0 Hz and reaches 1 at maxHz", () => {
    expect(hzToOpacity(0, 60)).toBeCloseTo(0.15, 10);
    expect(hzToOpacity(60, 60)).toBeCloseTo(1, 10);
  });

  it("increases monotonically and stays inside [0.15, 1]", () => {
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const o = hzToOpacity((i / 100) * 60, 60);
      expect(o).toBeGreaterThan(prev);
      expect(o).toBeGreaterThanOrEqual(0.15);
      expect(o).toBeLessThanOrEqual(1);
      prev = o;
    }
  });

  it("returns the 0.15 floor when maxHz is 0", () => {
    expect(hzToOpacity(10, 0)).toBeCloseTo(0.15, 10);
  });

  it("clamps Hz above maxHz to 1", () => {
    expect(hzToOpacity(1e9, 60)).toBeCloseTo(1, 10);
  });
});

describe("topActive", () => {
  const channels = ["GNG", "AL_L", "AL_R", "720575940621000001"] as const;

  it("returns {id, hz} pairs sorted by Hz descending", () => {
    const frame = new Float32Array([3, 40, 12, 25]);
    expect(topActive(frame, channels, 4)).toEqual([
      { id: "AL_L", hz: 40 },
      { id: "720575940621000001", hz: 25 },
      { id: "AL_R", hz: 12 },
      { id: "GNG", hz: 3 },
    ]);
  });

  it("caps the result at n", () => {
    const frame = new Float32Array([3, 40, 12, 25]);
    const top = topActive(frame, channels, 2);
    expect(top).toHaveLength(2);
    expect(top[0]).toEqual({ id: "AL_L", hz: 40 });
    expect(top[1]).toEqual({ id: "720575940621000001", hz: 25 });
  });

  it("returns every channel sorted when n exceeds the channel count", () => {
    const frame = new Float32Array([3, 40, 12, 25]);
    expect(topActive(frame, channels, 99)).toHaveLength(4);
  });

  it("returns [] for n <= 0 or empty inputs", () => {
    const frame = new Float32Array([3, 40, 12, 25]);
    expect(topActive(frame, channels, 0)).toEqual([]);
    expect(topActive(new Float32Array(0), channels, 3)).toEqual([]);
    expect(topActive(frame, [], 3)).toEqual([]);
  });

  it("breaks Hz ties by channel order for determinism", () => {
    const frame = new Float32Array([10, 40, 40, 5]);
    const top = topActive(frame, channels, 2);
    expect(top[0]!.id).toBe("AL_L");
    expect(top[1]!.id).toBe("AL_R");
  });

  it("does not mutate the frame or channels inputs", () => {
    const frame = new Float32Array([3, 40, 12, 25]);
    const frameBefore = Array.from(frame);
    const channelList = ["GNG", "AL_L", "AL_R", "720575940621000001"];
    const channelsBefore = [...channelList];
    topActive(frame, channelList, 3);
    expect(Array.from(frame)).toEqual(frameBefore);
    expect(channelList).toEqual(channelsBefore);
  });

  it("skips channels with no frame entry", () => {
    const frame = new Float32Array([7, 2]);
    expect(topActive(frame, channels, 4)).toEqual([
      { id: "GNG", hz: 7 },
      { id: "AL_L", hz: 2 },
    ]);
  });
});
