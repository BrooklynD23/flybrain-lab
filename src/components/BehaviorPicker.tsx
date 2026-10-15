import { useRef, type KeyboardEvent } from "react";

import type {
  BehaviorId,
  BehaviorInfo,
  ClipSource,
} from "../contracts/manifest.ts";

/** Minimal shape the picker needs — `manifest.behaviors` satisfies it. */
export type BehaviorOption = Pick<BehaviorInfo, "id" | "label" | "clipSource">;

export interface BehaviorPickerProps {
  behaviors: readonly BehaviorOption[];
  selected: BehaviorId;
  onSelect: (id: BehaviorId) => void;
}

/** Short provenance tag shown next to each behavior label. */
const CLIP_SOURCE_TAGS: Record<ClipSource, string> = {
  "reference-replay": "Reference replay",
  keyframed: "Keyframed",
  policy: "Physics policy",
};

// WAVE-05 moves this into the stylesheet; set inline so the ≥44px touch
// target holds before the styles land.
const TOUCH_TARGET = { minWidth: 44, minHeight: 44 } as const;

const NEXT_KEYS = new Set(["ArrowDown", "ArrowRight"]);
const PREV_KEYS = new Set(["ArrowUp", "ArrowLeft"]);

export function BehaviorPicker({
  behaviors,
  selected,
  onSelect,
}: BehaviorPickerProps) {
  const inputs = useRef(new Map<BehaviorId, HTMLInputElement>());

  function selectAt(index: number) {
    const target = behaviors[index];
    if (!target) return;
    onSelect(target.id);
    inputs.current.get(target.id)?.focus();
  }

  function move(delta: number) {
    if (behaviors.length === 0) return;
    const index = behaviors.findIndex((b) => b.id === selected);
    selectAt(
      index === -1 ? 0 : (index + delta + behaviors.length) % behaviors.length,
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (NEXT_KEYS.has(event.key)) {
      event.preventDefault();
      move(1);
    } else if (PREV_KEYS.has(event.key)) {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectAt(0);
    } else if (event.key === "End") {
      event.preventDefault();
      selectAt(behaviors.length - 1);
    }
  }

  return (
    <div
      className="fbl-behavior-picker"
      role="radiogroup"
      aria-label="Choose a behavior"
      onKeyDown={onKeyDown}
    >
      {behaviors.map((b) => (
        <label key={b.id} className="fbl-behavior-option" style={TOUCH_TARGET}>
          <input
            type="radio"
            name="fbl-behavior"
            value={b.id}
            checked={b.id === selected}
            onChange={() => onSelect(b.id)}
            ref={(el) => {
              if (el) {
                inputs.current.set(b.id, el);
              } else {
                inputs.current.delete(b.id);
              }
            }}
          />
          <span className="fbl-behavior-label">{b.label}</span>
          <span className="fbl-clip-source">
            {CLIP_SOURCE_TAGS[b.clipSource]}
          </span>
        </label>
      ))}
    </div>
  );
}
