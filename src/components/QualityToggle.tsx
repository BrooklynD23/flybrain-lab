export interface QualityToggleProps {
  /** true renders the low-cost scene (no neuron lines, no shadows). */
  lowQuality: boolean;
  onChange: (lowQuality: boolean) => void;
}

// WAVE-05 moves this into the stylesheet; set inline so the ≥44px touch
// target holds before the styles land.
const TOUCH_TARGET = { minWidth: 44, minHeight: 44 } as const;

export function QualityToggle({ lowQuality, onChange }: QualityToggleProps) {
  return (
    <label className="fbl-quality-toggle" style={TOUCH_TARGET}>
      <input
        type="checkbox"
        checked={lowQuality}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      Low quality (faster)
    </label>
  );
}
