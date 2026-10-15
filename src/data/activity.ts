import type { ActivityInfo } from "../contracts/activity.ts";
import type { FetchFn } from "./loadManifest.ts";

/** Decoded-on-read activity table: one byte per (bin, channel). */
export interface Activity {
  info: ActivityInfo;
  /** uint8-bin-major: `bytes[bin * channels.length + channel]`. */
  bytes: Uint8Array;
}

/**
 * Fetch `base + "/" + info.url` and wrap it as an Activity. Rejects when the
 * byte length does not equal nBins x channels.length (truncated or wrong
 * file).
 */
export async function loadActivity(
  info: ActivityInfo,
  base: string,
  fetchFn: FetchFn = fetch,
): Promise<Activity> {
  const url = `${base}/${info.url}`;
  const res = await fetchFn(url);
  if (!res.ok) {
    throw new Error(
      `Could not load activity data from ${url} (HTTP ${res.status}).`,
    );
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  const expected = info.nBins * info.channels.length;
  if (bytes.length !== expected) {
    throw new Error(
      `Activity data at ${url} is corrupt: expected ${expected} bytes ` +
        `(${info.nBins} bins x ${info.channels.length} channels), ` +
        `got ${bytes.length}.`,
    );
  }
  return { info, bytes };
}

/** Bin index covering tMs, clamped into [0, nBins - 1]. */
function binAt(activity: Activity, tMs: number): number {
  const { nBins, binMs } = activity.info;
  const bin = Math.floor(tMs / binMs);
  return Math.min(nBins - 1, Math.max(0, bin));
}

/**
 * Firing rate in Hz for one channel at tMs. `channel` is a channel id
 * (as listed in info.channels) or a channel index.
 */
export function rateAt(
  activity: Activity,
  tMs: number,
  channel: number | string,
): number {
  const { channels, maxHz } = activity.info;
  const c = typeof channel === "string" ? channels.indexOf(channel) : channel;
  if (c < 0 || c >= channels.length) {
    throw new Error(`Unknown activity channel: ${String(channel)}`);
  }
  const v = activity.bytes[binAt(activity, tMs) * channels.length + c]!;
  return (v / 255) * maxHz[c]!;
}

/**
 * Firing rates in Hz for all channels at tMs. Returns a new Float32Array on
 * every call — callers may mutate the result freely.
 */
export function frameAt(activity: Activity, tMs: number): Float32Array {
  const { channels, maxHz } = activity.info;
  const frame = new Float32Array(channels.length);
  const offset = binAt(activity, tMs) * channels.length;
  for (let c = 0; c < channels.length; c++) {
    frame[c] = (activity.bytes[offset + c]! / 255) * maxHz[c]!;
  }
  return frame;
}
