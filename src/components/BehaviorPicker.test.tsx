import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BehaviorId } from "../contracts/manifest.ts";
import { BehaviorPicker, type BehaviorOption } from "./BehaviorPicker.tsx";

const BEHAVIORS: BehaviorOption[] = [
  { id: "walking", label: "Walking", clipSource: "reference-replay" },
  { id: "grooming", label: "Grooming", clipSource: "keyframed" },
  { id: "feeding", label: "Feeding", clipSource: "keyframed" },
  { id: "escape", label: "Escape response", clipSource: "reference-replay" },
];

function Controlled({ initial }: { initial: BehaviorId }) {
  const [selected, setSelected] = useState<BehaviorId>(initial);
  return (
    <BehaviorPicker
      behaviors={BEHAVIORS}
      selected={selected}
      onSelect={setSelected}
    />
  );
}

afterEach(cleanup);

describe("BehaviorPicker", () => {
  it("renders a labelled radio group with one radio per behavior", () => {
    render(
      <BehaviorPicker
        behaviors={BEHAVIORS}
        selected="walking"
        onSelect={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("radiogroup", { name: "Choose a behavior" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getByRole("radio", { name: /walking/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /escape/i })).toBeTruthy();
  });

  it("shows a clip-source tag next to each label", () => {
    render(
      <BehaviorPicker
        behaviors={BEHAVIORS}
        selected="walking"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getAllByText("Reference replay")).toHaveLength(2);
    expect(screen.getAllByText("Keyframed")).toHaveLength(2);
  });

  it("checks the radio matching the selected prop", () => {
    render(
      <BehaviorPicker
        behaviors={BEHAVIORS}
        selected="grooming"
        onSelect={vi.fn()}
      />,
    );
    const grooming = screen.getByRole("radio", {
      name: /grooming/i,
    }) as HTMLInputElement;
    expect(grooming.checked).toBe(true);
  });

  it("calls onSelect when a radio is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <BehaviorPicker
        behaviors={BEHAVIORS}
        selected="walking"
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByRole("radio", { name: /feeding/i }));
    expect(onSelect).toHaveBeenCalledWith("feeding");
  });

  it("arrow keys move selection to the next/previous behavior", async () => {
    const user = userEvent.setup();
    render(<Controlled initial="walking" />);
    const walking = screen.getByRole("radio", { name: /walking/i });
    (walking as HTMLElement).focus();

    await user.keyboard("{ArrowDown}");
    const grooming = screen.getByRole("radio", {
      name: /grooming/i,
    }) as HTMLInputElement;
    expect(grooming.checked).toBe(true);
    expect(document.activeElement).toBe(grooming);

    await user.keyboard("{ArrowUp}");
    expect((walking as HTMLInputElement).checked).toBe(true);
  });

  it("arrow keys wrap around at both ends", async () => {
    const user = userEvent.setup();
    render(<Controlled initial="walking" />);
    (screen.getByRole("radio", { name: /walking/i }) as HTMLElement).focus();

    await user.keyboard("{ArrowUp}");
    const escape = screen.getByRole("radio", {
      name: /escape/i,
    }) as HTMLInputElement;
    expect(escape.checked).toBe(true);

    await user.keyboard("{ArrowRight}");
    const walking = screen.getByRole("radio", {
      name: /walking/i,
    }) as HTMLInputElement;
    expect(walking.checked).toBe(true);
  });

  it("Home and End select the first and last behavior", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <BehaviorPicker
        behaviors={BEHAVIORS}
        selected="grooming"
        onSelect={onSelect}
      />,
    );
    (screen.getByRole("radio", { name: /grooming/i }) as HTMLElement).focus();
    await user.keyboard("{End}");
    expect(onSelect).toHaveBeenLastCalledWith("escape");
    await user.keyboard("{Home}");
    expect(onSelect).toHaveBeenLastCalledWith("walking");
  });

  it("gives each option a touch target of at least 44px", () => {
    const { container } = render(
      <BehaviorPicker
        behaviors={BEHAVIORS}
        selected="walking"
        onSelect={vi.fn()}
      />,
    );
    const options = container.querySelectorAll(".fbl-behavior-option");
    expect(options.length).toBe(4);
    for (const option of options) {
      expect((option as HTMLElement).style.minHeight).toBe("44px");
    }
  });
});
