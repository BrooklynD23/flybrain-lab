import type { ClipSource } from "../contracts/manifest.ts";

/**
 * If a glb clip is within this fraction of the timeline length, small export
 * rounding is assumed and timeline ms are scaled onto clip seconds. Beyond it
 * the mismatch is real: seconds are clamped to the clip and a warning fires.
 */
const SCALE_TOLERANCE = 0.05;

/** Mismatches already warned about — one console.warn per clip/timeline pair. */
const warnedMismatches = new Set<string>();

/** Test hook: forget which mismatches have already warned. */
export function resetClipTimeWarnings(): void {
  warnedMismatches.clear();
}

/**
 * Timeline position (ms) -> animation time (seconds) for a glb clip.
 * - Clip within 5% of the timeline: scale, so tMs = timelineMs still reaches
 *   the clip's last frame.
 * - Bigger mismatch: plain seconds clamped to [0, clipDurationS], warn once.
 * Always returns a value inside [0, clipDurationS].
 */
export function clipSeconds(
  tMs: number,
  clipDurationS: number,
  timelineMs: number,
): number {
  if (timelineMs <= 0 || clipDurationS <= 0) return 0;
  const timelineS = timelineMs / 1000;
  const relDiff = Math.abs(clipDurationS - timelineS) / timelineS;
  let seconds: number;
  if (relDiff < SCALE_TOLERANCE) {
    seconds = (tMs / timelineMs) * clipDurationS;
  } else {
    const key = `${clipDurationS}/${timelineMs}`;
    if (!warnedMismatches.has(key)) {
      warnedMismatches.add(key);
      console.warn(
        `[BodyView] clip duration ${clipDurationS}s differs from timeline ` +
          `${timelineMs}ms by >=5%; clamping playback instead of scaling`,
      );
    }
    seconds = tMs / 1000;
  }
  return Math.min(Math.max(seconds, 0), clipDurationS);
}

const SOURCE_LABELS: Record<ClipSource, string> = {
  "reference-replay": "Reference replay (recorded fly kinematics)",
  keyframed: "Keyframed by hand",
  policy: "Physics policy",
};

/** Audience-facing provenance label for a body clip (AGENT.md convention 8). */
export function sourceLabel(clipSource: ClipSource): string {
  return SOURCE_LABELS[clipSource];
}
