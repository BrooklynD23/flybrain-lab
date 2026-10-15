import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QualityToggle } from "./QualityToggle.tsx";

function Controlled() {
  const [lowQuality, setLowQuality] = useState(false);
  return <QualityToggle lowQuality={lowQuality} onChange={setLowQuality} />;
}

afterEach(cleanup);

describe("QualityToggle", () => {
  it("renders a native checkbox labelled 'Low quality (faster)'", () => {
    render(<QualityToggle lowQuality={false} onChange={vi.fn()} />);
    const box = screen.getByRole("checkbox", {
      name: "Low quality (faster)",
    }) as HTMLInputElement;
    expect(box.checked).toBe(false);
  });

  it("reflects the lowQuality prop", () => {
    render(<QualityToggle lowQuality={true} onChange={vi.fn()} />);
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    expect(box.checked).toBe(true);
  });

  it("calls onChange with the new value when toggled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<QualityToggle lowQuality={false} onChange={onChange} />);
    await user.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("stays controlled end-to-end", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    await user.click(box);
    expect(box.checked).toBe(true);
    await user.click(box);
    expect(box.checked).toBe(false);
  });

  it("gives the toggle a touch target of at least 44px", () => {
    const { container } = render(
      <QualityToggle lowQuality={false} onChange={vi.fn()} />,
    );
    const label = container.querySelector(".fbl-quality-toggle") as HTMLElement;
    expect(label.style.minHeight).toBe("44px");
  });
});
