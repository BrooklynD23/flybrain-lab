import { useState, useSyncExternalStore } from "react";

export interface ClockSnapshot {
  readonly tMs: number;
  readonly playing: boolean;
  readonly durationMs: number;
}

/**
 * Behavior playback clock shared by both 3D panes. Time advances only via
 * `tick(nowMs)` — a rAF loop injects real time, tests inject fake time.
 * Getters (`tMs`, `playing`, `durationMs`) are safe to read every frame
 * without subscribing; `subscribe` + `getSnapshot` feed useSyncExternalStore
 * for UI that must re-render on change.
 */
export interface Clock {
  readonly tMs: number;
  readonly playing: boolean;
  readonly durationMs: number;
  play(): void;
  pause(): void;
  /** Clamp into [0, durationMs]. */
  seek(tMs: number): void;
  setDuration(durationMs: number): void;
  /** Advance using injected time. No-op while paused; wraps at durationMs. */
  tick(nowMs: number): void;
  /** Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Stable object identity until state changes (useSyncExternalStore). */
  getSnapshot(): ClockSnapshot;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export function createClock(durationMs = 0): Clock {
  let tMs = 0;
  let playing = false;
  let duration = Math.max(0, durationMs);
  // Baseline for the next tick; null until the first tick after play(),
  // so resume never jumps by the paused interval.
  let lastTickMs: number | null = null;
  let snapshot: ClockSnapshot = { tMs, playing, durationMs: duration };
  const listeners = new Set<() => void>();

  function emit() {
    snapshot = { tMs, playing, durationMs: duration };
    for (const listener of listeners) listener();
  }

  return {
    get tMs() {
      return tMs;
    },
    get playing() {
      return playing;
    },
    get durationMs() {
      return duration;
    },
    play() {
      if (playing) return;
      playing = true;
      lastTickMs = null;
      emit();
    },
    pause() {
      if (!playing) return;
      playing = false;
      lastTickMs = null;
      emit();
    },
    seek(next: number) {
      const clamped = clamp(next, 0, duration);
      if (clamped === tMs) return;
      tMs = clamped;
      emit();
    },
    setDuration(next: number) {
      duration = Math.max(0, next);
      tMs = clamp(tMs, 0, duration);
      lastTickMs = null;
      emit();
    },
    tick(nowMs: number) {
      if (!playing) {
        lastTickMs = null;
        return;
      }
      if (lastTickMs !== null && duration > 0) {
        const delta = Math.max(0, nowMs - lastTickMs); // ignore backwards time
        if (delta > 0) {
          tMs = (tMs + delta) % duration; // loop
          emit();
        }
      }
      lastTickMs = nowMs;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      return snapshot;
    },
  };
}

/**
 * Returns one stable Clock per component instance. Create it once in App
 * and pass it down — both panes then read the same clock via getters.
 */
export function useClock(durationMs = 0): Clock {
  const [clock] = useState(() => createClock(durationMs));
  return clock;
}

/** Reactive snapshot for UI (Timeline, buttons) — wraps useSyncExternalStore. */
export function useClockSnapshot(clock: Clock): ClockSnapshot {
  return useSyncExternalStore(clock.subscribe, clock.getSnapshot);
}
