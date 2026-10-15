import { afterEach, describe, expect, it, vi } from "vitest";

import { clipSeconds, resetClipTimeWarnings, sourceLabel } from "./clipTime.ts";

afterEach(() => {
  resetClipTimeWarnings();
  vi.restoreAllMocks();
});

describe("clipSeconds", () => {
  it("maps timeline ms to clip seconds 1:1 when durations match", () => {
    expect(clipSeconds(0, 4, 4000)).toBe(0);
    expect(clipSeconds(2000, 4, 4000)).toBe(2);
    expect(clipSeconds(4000, 4, 4000)).toBe(4);
  });

  it("scales when the clip differs from the timeline by < 5%", () => {
    // 3.9 s clip vs 4 s timeline = 2.5% off: 2000 ms lands mid-clip, and the
    // end of the timeline still reaches the end of the clip.
    expect(clipSeconds(2000, 3.9, 4000)).toBeCloseTo(1.95);
    expect(clipSeconds(4000, 3.9, 4000)).toBeCloseTo(3.9);
  });

  it("clamps (no scaling) when the clip differs by >= 5%", () => {
    // 4 s clip vs 10 s timeline = 60% off: plain seconds, clamped to the clip.
    expect(clipSeconds(2000, 4, 10_000)).toBe(2);
    expect(clipSeconds(6000, 4, 10_000)).toBe(4);
    // exactly 5% off still clamps
    expect(clipSeconds(4000, 4.2, 4000)).toBe(4);
  });

  it("warns once per mismatched clip, then stays quiet", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    clipSeconds(0, 4, 10_000);
    clipSeconds(1000, 4, 10_000);
    expect(warn).toHaveBeenCalledTimes(1);
    // a different clip length is a new mismatch and warns again
    clipSeconds(0, 5, 10_000);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("clamps out-of-range input and guards degenerate durations", () => {
    expect(clipSeconds(-100, 4, 4000)).toBe(0);
    expect(clipSeconds(999_999, 4, 4000)).toBe(4);
    expect(clipSeconds(100, 4, 0)).toBe(0);
    expect(clipSeconds(100, 0, 4000)).toBe(0);
  });
});

describe("sourceLabel", () => {
  it("labels each clip source", () => {
    expect(sourceLabel("reference-replay")).toBe(
      "Reference replay (recorded fly kinematics)",
    );
    expect(sourceLabel("keyframed")).toBe("Keyframed by hand");
    expect(sourceLabel("policy")).toBe("Physics policy");
  });
});
