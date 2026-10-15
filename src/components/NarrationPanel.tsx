import type { Manifest } from "../contracts/manifest.ts";
import type { NarrationCue } from "../contracts/narration.ts";

export interface NarrationPanelProps {
  /** Cue active at the current timeline position; null before the first cue. */
  cue: NarrationCue | null;
  dataSource: Manifest["dataSource"];
}

export function NarrationPanel({ cue, dataSource }: NarrationPanelProps) {
  return (
    <section className="fbl-narration" aria-label="Narration">
      {/* Always mounted so screen readers announce cue text changes. */}
      <p className="fbl-narration-cue" aria-live="polite">
        {cue?.text ?? ""}
      </p>
      <p className="fbl-narration-disclaimer">
        Simulated model, assumed neurotransmitter signs.
      </p>
      {dataSource === "fixture" ? (
        <span className="fbl-badge fbl-badge-fixture">fixture data</span>
      ) : null}
    </section>
  );
}
