const WINDOW_MS = 1000;

export interface FpsMeter {
  /** Record a frame at `nowMs`; returns frames seen in the last second. */
  tick(nowMs: number): number;
}

/** Rolling 1 s frame counter. Pure: time is injected. */
export function createFpsMeter(): FpsMeter {
  let stamps: number[] = [];
  return {
    tick(nowMs) {
      stamps = [...stamps.filter((t) => t > nowMs - WINDOW_MS), nowMs];
      return stamps.length;
    },
  };
}
