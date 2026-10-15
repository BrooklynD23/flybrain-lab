import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { createClock } from "../data/clock.ts";
import { Timeline, formatTimeMs } from "./Timeline.tsx";

afterEach(cleanup);

describe("formatTimeMs", () => {
  it.each([
    [0, "0:00.0"],
    [500, "0:00.5"],
    [1500, "0:01.5"],
    [4000, "0:04.0"],
    [59999, "0:59.9"],
    [61500, "1:01.5"],
  ])("formats %i ms as %s", (ms, expected) => {
    expect(formatTimeMs(ms)).toBe(expected);
  });
});

describe("Timeline", () => {
  it("renders a play button, a range scrubber and the current time", () => {
    const clock = createClock(4000);
    render(<Timeline clock={clock} cueTimesMs={[]} />);

    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();

    const slider = screen.getByRole("slider", {
      name: "Seek",
    }) as HTMLInputElement;
    expect(slider.type).toBe("range");
    expect(slider.min).toBe("0");
    expect(slider.max).toBe("4000");
    expect(slider.getAttribute("aria-valuetext")).toBe("0:00.0");

    expect(screen.getByText("0:00.0")).toBeTruthy();
    expect(screen.getByText("0:04.0")).toBeTruthy(); // duration
  });

  it("toggles between play and pause", async () => {
    const user = userEvent.setup();
    const clock = createClock(4000);
    render(<Timeline clock={clock} cueTimesMs={[]} />);

    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(clock.playing).toBe(true);
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(clock.playing).toBe(false);
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });

  it("seeks the clock when the scrubber changes", () => {
    const clock = createClock(4000);
    render(<Timeline clock={clock} cueTimesMs={[]} />);

    const slider = screen.getByRole("slider", { name: "Seek" });
    fireEvent.change(slider, { target: { value: "2000" } });

    expect(clock.tMs).toBe(2000);
    expect(slider.getAttribute("aria-valuetext")).toBe("0:02.0");
    expect(screen.getByText("0:02.0")).toBeTruthy();
  });

  it("re-renders as the clock ticks", () => {
    const clock = createClock(4000);
    render(<Timeline clock={clock} cueTimesMs={[]} />);

    act(() => {
      clock.play();
      clock.tick(1000);
      clock.tick(1500);
    });

    expect(clock.tMs).toBe(500);
    expect(screen.getByText("0:00.5")).toBeTruthy();
  });

  it("renders one tick mark per cue time at the right position", () => {
    const clock = createClock(4000);
    const { container } = render(
      <Timeline clock={clock} cueTimesMs={[0, 2000, 4000]} />,
    );
    const ticks = container.querySelectorAll(".fbl-cue-tick");
    expect(ticks).toHaveLength(3);
    expect((ticks[0] as HTMLElement).style.left).toBe("0%");
    expect((ticks[1] as HTMLElement).style.left).toBe("50%");
    expect((ticks[2] as HTMLElement).style.left).toBe("100%");
  });

  it("drops cue ticks outside the duration", () => {
    const clock = createClock(4000);
    const { container } = render(
      <Timeline clock={clock} cueTimesMs={[-10, 500, 4500]} />,
    );
    expect(container.querySelectorAll(".fbl-cue-tick")).toHaveLength(1);
  });

  it("gives the play button a touch target of at least 44px", () => {
    const clock = createClock(4000);
    render(<Timeline clock={clock} cueTimesMs={[]} />);
    const button = screen.getByRole("button", { name: "Play" });
    expect((button as HTMLElement).style.minHeight).toBe("44px");
    expect((button as HTMLElement).style.minWidth).toBe("44px");
  });
});
