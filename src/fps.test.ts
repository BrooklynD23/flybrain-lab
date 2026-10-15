import { describe, expect, it } from "vitest";
import { createFpsMeter } from "./fps";

describe("createFpsMeter", () => {
  it("reports 60 for 60 ticks in one second", () => {
    const meter = createFpsMeter();
    let fps = 0;
    for (let i = 0; i < 60; i++) fps = meter.tick((i * 1000) / 60);
    expect(fps).toBe(60);
  });

  it("rolls the window as old ticks expire", () => {
    const meter = createFpsMeter();
    for (let i = 0; i < 60; i++) meter.tick((i * 1000) / 60);
    // 30 fps over the next second: old 60 Hz ticks fall out of the window.
    let fps = 0;
    for (let i = 1; i <= 30; i++) fps = meter.tick(1000 + (i * 1000) / 30);
    expect(fps).toBe(30);
  });

  it("reports 1 for a single tick", () => {
    expect(createFpsMeter().tick(5)).toBe(1);
  });
});
