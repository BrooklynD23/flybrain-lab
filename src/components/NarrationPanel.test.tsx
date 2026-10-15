import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { NarrationCue } from "../contracts/narration.ts";
import { NarrationPanel } from "./NarrationPanel.tsx";

const CUE: NarrationCue = {
  tMs: 500,
  text: "Simulated model: the wave reaches the lobes.",
  focus: { neuropils: ["LAL_L"], neurons: [] },
};

afterEach(cleanup);

describe("NarrationPanel", () => {
  it("shows the current cue inside an aria-live=polite region", () => {
    render(<NarrationPanel cue={CUE} dataSource="flywire-783" />);
    const cue = screen.getByText(CUE.text);
    expect(cue.closest('[aria-live="polite"]')).toBeTruthy();
  });

  it("always shows the persistent simulation disclaimer", () => {
    render(<NarrationPanel cue={null} dataSource="flywire-783" />);
    expect(
      screen.getByText("Simulated model, assumed neurotransmitter signs."),
    ).toBeTruthy();
  });

  it("shows a 'fixture data' badge only when dataSource is fixture", () => {
    const { rerender } = render(
      <NarrationPanel cue={CUE} dataSource="fixture" />,
    );
    expect(screen.getByText("fixture data")).toBeTruthy();

    rerender(<NarrationPanel cue={CUE} dataSource="flywire-783" />);
    expect(screen.queryByText("fixture data")).toBeNull();
  });

  it("keeps the live region mounted when there is no cue", () => {
    const { container } = render(
      <NarrationPanel cue={null} dataSource="fixture" />,
    );
    expect(container.querySelector('[aria-live="polite"]')).toBeTruthy();
  });

  it("updates the live region when the cue changes", () => {
    const { rerender } = render(
      <NarrationPanel cue={CUE} dataSource="fixture" />,
    );
    const next: NarrationCue = { ...CUE, tMs: 1050, text: "Second cue text." };
    rerender(<NarrationPanel cue={next} dataSource="fixture" />);
    const cue = screen.getByText("Second cue text.");
    expect(cue.closest('[aria-live="polite"]')).toBeTruthy();
    expect(screen.queryByText(CUE.text)).toBeNull();
  });
});
