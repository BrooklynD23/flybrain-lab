import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";

afterEach(cleanup);

describe("App", () => {
  it("renders the FlyBrain Lab heading", () => {
    render(<App />);
    const heading = screen.getByRole("heading", { name: "FlyBrain Lab" });
    expect(heading).toBeTruthy();
    expect(heading.tagName).toBe("H1");
  });
});
