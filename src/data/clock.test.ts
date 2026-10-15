import { act, renderHook } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { describe, expect, it, vi } from "vitest";

import { createClock, useClock } from "./clock.ts";

describe("createClock", () => {
  it("starts paused at tMs 0", () => {
    const clock = createClock(4000);
    const snap = clock.getSnapshot();
    expect(snap.tMs).toBe(0);
    expect(snap.playing).toBe(false);
    expect(snap.durationMs).toBe(4000);
  });

  it("advances tMs on tick while playing, using injected time", () => {
    const clock = createClock(4000);
    clock.play();
    clock.tick(1000); // first tick sets the baseline, no advance
    clock.tick(1150);
    clock.tick(1250);
    expect(clock.getSnapshot().tMs).toBe(250);
    expect(clock.tMs).toBe(250);
    expect(clock.playing).toBe(true);
  });

  it("does not advance while paused", () => {
    const clock = createClock(4000);
    clock.tick(1000);
    clock.tick(2000);
    expect(clock.tMs).toBe(0);
  });

  it("pause freezes time; play resumes without a jump", () => {
    const clock = createClock(4000);
    clock.play();
    clock.tick(0);
    clock.tick(1000); // tMs = 1000
    clock.pause();
    clock.tick(5000); // ignored
    clock.play();
    clock.tick(9000); // baseline resets on play: no 4000 ms jump
    clock.tick(9500);
    expect(clock.tMs).toBe(1500);
  });

  it("seek sets tMs clamped into [0, durationMs]", () => {
    const clock = createClock(4000);
    clock.seek(1500);
    expect(clock.tMs).toBe(1500);
    clock.seek(-50);
    expect(clock.tMs).toBe(0);
    clock.seek(99_999);
    expect(clock.tMs).toBe(4000);
  });

  it("loops at durationMs and keeps playing", () => {
    const clock = createClock(4000);
    clock.play();
    clock.tick(0);
    clock.tick(3950);
    expect(clock.tMs).toBe(3950);
    clock.tick(4100); // +150 -> 4100 -> wraps to 100
    expect(clock.tMs).toBe(100);
    expect(clock.playing).toBe(true);
  });

  it("ignores backwards ticks", () => {
    const clock = createClock(4000);
    clock.play();
    clock.tick(5000);
    clock.tick(100); // nowMs went backwards: no rewind
    expect(clock.tMs).toBe(0);
    clock.tick(250);
    expect(clock.tMs).toBe(150);
  });

  it("setDuration updates durationMs and clamps tMs", () => {
    const clock = createClock(4000);
    clock.seek(3900);
    clock.setDuration(2000);
    const snap = clock.getSnapshot();
    expect(snap.durationMs).toBe(2000);
    expect(snap.tMs).toBe(2000);
  });

  it("does not advance when durationMs is 0", () => {
    const clock = createClock(0);
    clock.play();
    clock.tick(0);
    clock.tick(1000);
    expect(clock.tMs).toBe(0);
  });

  it("getSnapshot returns the same object until state changes", () => {
    const clock = createClock(4000);
    const a = clock.getSnapshot();
    expect(clock.getSnapshot()).toBe(a);
    clock.seek(10);
    const b = clock.getSnapshot();
    expect(b).not.toBe(a);
    expect(clock.getSnapshot()).toBe(b);
  });

  it("notifies subscribers on change and stops after unsubscribe", () => {
    const clock = createClock(4000);
    const listener = vi.fn();
    const unsub = clock.subscribe(listener);
    clock.seek(10);
    clock.play();
    clock.pause();
    expect(listener).toHaveBeenCalledTimes(3);
    clock.pause(); // no state change: no notification
    expect(listener).toHaveBeenCalledTimes(3);
    unsub();
    clock.seek(20);
    expect(listener).toHaveBeenCalledTimes(3);
  });
});

describe("useClock", () => {
  it("returns a stable Clock across rerenders", () => {
    const { result, rerender } = renderHook(() => useClock(4000));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    expect(first.getSnapshot().durationMs).toBe(4000);
  });

  it("is compatible with useSyncExternalStore", () => {
    const clock = createClock(4000);
    const { result } = renderHook(() =>
      useSyncExternalStore(clock.subscribe, clock.getSnapshot),
    );
    expect(result.current.tMs).toBe(0);
    act(() => {
      clock.seek(500);
    });
    expect(result.current.tMs).toBe(500);
    act(() => {
      clock.play();
    });
    expect(result.current.playing).toBe(true);
  });
});
