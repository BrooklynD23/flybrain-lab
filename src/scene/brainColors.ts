/**
 * Activity -> color mapping for BrainView (WAVE-04 T04.1).
 *
 * `hzToColor` walks a sequential perceptual ramp (dark blue -> yellow,
 * stops sampled from matplotlib's plasma) interpolated in linear-light
 * space — the gamma-correct way to blend sRGB colors — so rendered
 * luminance rises monotonically with firing rate. `hzToOpacity` fades
 * neuron lines from a 0.15 floor to fully opaque. `topActive` ranks
 * channels by Hz for live-mode question context.
 *
 * Pure module: no React, no three; inputs are never mutated.
 */

/** sRGB ramp endpoints/stops, 0..1 (plasma: dark blue -> yellow). */
const STOPS_SRGB: readonly (readonly [number, number, number])[] = [
  [13 / 255, 8 / 255, 135 / 255], // dark blue floor
  [126 / 255, 3 / 255, 168 / 255], // purple
  [204 / 255, 71 / 255, 120 / 255], // magenta-red
  [248 / 255, 149 / 255, 64 / 255], // orange
  [240 / 255, 249 / 255, 33 / 255], // yellow top
];

/** Minimum opacity for neuron lines at 0 Hz. */
const OPACITY_FLOOR = 0.15;

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// Ramp stops pre-decoded to linear light; interpolation happens there.
const STOPS_LINEAR: readonly (readonly [number, number, number])[] =
  STOPS_SRGB.map(
    (stop) =>
      [
        srgbToLinear(stop[0]),
        srgbToLinear(stop[1]),
        srgbToLinear(stop[2]),
      ] as const,
  );

/**
 * Firing rate normalized to [0, 1]. Non-positive or non-finite `maxHz`
 * (e.g. a silent channel) pins the fraction to 0 — the floor color.
 */
function rateFraction(hz: number, maxHz: number): number {
  if (!Number.isFinite(hz) || !Number.isFinite(maxHz) || maxHz <= 0) {
    return 0;
  }
  if (hz <= 0) return 0;
  if (hz >= maxHz) return 1;
  return hz / maxHz;
}

/**
 * sRGB [r, g, b] in 0..1 for a firing rate. 0 Hz -> dark blue floor,
 * `maxHz` -> yellow top; values outside the range are clamped.
 * Interpolation is done in linear light (gamma-corrected), so luminance
 * increases monotonically along the ramp.
 */
export function hzToColor(hz: number, maxHz: number): [number, number, number] {
  const t = rateFraction(hz, maxHz);
  const scaled = t * (STOPS_LINEAR.length - 1);
  const i = Math.min(STOPS_LINEAR.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const a = STOPS_LINEAR[i]!;
  const b = STOPS_LINEAR[i + 1]!;
  return [
    linearToSrgb(a[0] + (b[0] - a[0]) * f),
    linearToSrgb(a[1] + (b[1] - a[1]) * f),
    linearToSrgb(a[2] + (b[2] - a[2]) * f),
  ];
}

/** Line opacity for a firing rate: 0.15 at 0 Hz up to 1 at `maxHz`. */
export function hzToOpacity(hz: number, maxHz: number): number {
  return OPACITY_FLOOR + (1 - OPACITY_FLOOR) * rateFraction(hz, maxHz);
}

/** One channel's current rate, as returned by `topActive`. */
export interface ActiveChannel {
  /** Channel id from `channels` (neuropil id or neuron root id). */
  readonly id: string;
  /** Firing rate in Hz. */
  readonly hz: number;
}

/**
 * The `n` most active channels in `frame`, sorted by Hz descending.
 * Ties keep channel order so output is deterministic. Channels beyond
 * `frame.length` (or NaN rates, treated as 0 Hz) still rank; `frame` and
 * `channels` are not mutated.
 */
export function topActive(
  frame: ArrayLike<number>,
  channels: readonly string[],
  n: number,
): ActiveChannel[] {
  const count = Math.min(frame.length, channels.length);
  const ranked: { id: string; hz: number; order: number }[] = [];
  for (let i = 0; i < count; i++) {
    const hz = frame[i]!;
    ranked.push({
      id: channels[i]!,
      hz: Number.isFinite(hz) ? hz : 0,
      order: i,
    });
  }
  ranked.sort((x, y) => y.hz - x.hz || x.order - y.order);
  return ranked.slice(0, Math.max(0, n)).map(({ id, hz }) => ({ id, hz }));
}
