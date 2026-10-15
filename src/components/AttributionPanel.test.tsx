import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Attribution } from "../contracts/manifest.ts";
import { AttributionPanel } from "./AttributionPanel.tsx";

afterEach(cleanup);

const attribution: Attribution[] = [
  {
    name: "FlyWire data (meshes, annotations, Codex)",
    licence: "CC BY-NC 4.0",
    url: "https://flywire.ai",
    citation:
      "Dorkenwald et al. (2024) Neuronal wiring diagram of an adult brain. Nature. doi:10.1038/s41586-024-07558-y",
  },
  {
    name: "Shiu et al. Drosophila brain model",
    licence: "MIT",
    url: "https://github.com/philshiu/Drosophila_brain_model",
    citation:
      "Shiu et al. (2024) A Drosophila computational brain model reveals sensorimotor processing. Nature.",
  },
  {
    name: "flybody model, meshes, datasets",
    licence: "Apache-2.0",
    url: "https://github.com/TuragaLab/flybody",
    citation:
      "Vaxenburg et al. (2025) Whole-body physics simulation of fruit fly locomotion. Nature 643.",
  },
];

describe("AttributionPanel", () => {
  it("renders inside a native <details> disclosure", () => {
    const { container } = render(
      <AttributionPanel attribution={attribution} />,
    );
    const details = container.querySelector("details");
    expect(details).toBeTruthy();
    expect(details!.querySelector("summary")).toBeTruthy();
  });

  it("carries a non-commercial demo notice in its heading", () => {
    render(<AttributionPanel attribution={attribution} />);
    expect(screen.getByText(/Non-commercial demo/)).toBeTruthy();
  });

  it("renders every entry with name, licence, link and citation", () => {
    render(<AttributionPanel attribution={attribution} />);
    for (const entry of attribution) {
      const link = screen.getByRole("link", { name: entry.name });
      expect(link.getAttribute("href")).toBe(entry.url);
      expect(link.getAttribute("rel")).toContain("noreferrer");
      expect(screen.getByText(new RegExp(entry.licence))).toBeTruthy();
      expect(screen.getByText(entry.citation)).toBeTruthy();
    }
    expect(screen.getAllByRole("link")).toHaveLength(attribution.length);
  });
});
