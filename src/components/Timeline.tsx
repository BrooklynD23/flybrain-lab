import { useClockSnapshot, type Clock } from "../data/clock.ts";

export interface TimelineProps {
  /** Shared behavior clock from `createClock`/`useClock` in src/data. */
  clock: Clock;
  /** Narration cue start times (ms), drawn as tick marks under the scrubber. */
  cueTimesMs?: readonly number[];
}

// WAVE-05 moves this into the stylesheet; set inline so the ≥44px touch
// target holds before the styles land.
const TOUCH_TARGET = { minWidth: 44, minHeight: 44 } as const;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** "m:ss.s" — minutes, zero-padded seconds, tenths of a second. */
export function formatTimeMs(tMs: number): string {
  const total = Math.max(0, tMs);
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const tenths = Math.floor((total % 1000) / 100);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

export function Timeline({ clock, cueTimesMs = [] }: TimelineProps) {
  const { tMs, playing, durationMs } = useClockSnapshot(clock);
  const duration = Math.max(0, durationMs);
  const ticks = cueTimesMs.filter((t) => t >= 0 && t <= duration);

  return (
    <div className="fbl-timeline">
      <button
        type="button"
        className="fbl-play-toggle"
        aria-label={playing ? "Pause" : "Play"}
        aria-pressed={playing}
        style={TOUCH_TARGET}
        onClick={() => (playing ? clock.pause() : clock.play())}
      >
        {playing ? "Pause" : "Play"}
      </button>
      <div className="fbl-scrubber-wrap">
        <input
          type="range"
          className="fbl-scrubber"
          min={0}
          max={duration}
          step={1}
          value={clamp(Math.round(tMs), 0, duration)}
          aria-label="Seek"
          aria-valuetext={formatTimeMs(tMs)}
          onChange={(event) => clock.seek(Number(event.currentTarget.value))}
          style={TOUCH_TARGET}
        />
        <div className="fbl-cue-ticks" aria-hidden="true">
          {ticks.map((t) => (
            <span
              key={t}
              className="fbl-cue-tick"
              style={{ left: `${duration > 0 ? (t / duration) * 100 : 0}%` }}
            />
          ))}
        </div>
      </div>
      <span className="fbl-time">
        <span className="fbl-time-current">{formatTimeMs(tMs)}</span>
        {" / "}
        <span className="fbl-time-duration">{formatTimeMs(duration)}</span>
      </span>
    </div>
  );
}
