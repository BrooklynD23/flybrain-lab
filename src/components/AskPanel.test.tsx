import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AskPanel } from "./AskPanel.tsx";

afterEach(cleanup);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const renderPanel = (
  ask: (question: string) => Promise<string>,
  props: Partial<{
    suggestions: string[];
    mode: "replay" | "live";
  }> = {},
) =>
  render(
    <AskPanel
      ask={ask}
      suggestions={props.suggestions ?? []}
      mode={props.mode ?? "replay"}
    />,
  );

describe("AskPanel", () => {
  it("tags the panel with the narration mode", () => {
    const ask = vi.fn(async () => "answer");
    const { rerender } = renderPanel(ask, { mode: "replay" });
    expect(screen.getByText("Replay")).toBeTruthy();
    rerender(<AskPanel ask={ask} suggestions={[]} mode="live" />);
    expect(screen.getByText("Live (Claude)")).toBeTruthy();
  });

  it("submits the typed question and shows the answer", async () => {
    const ask = vi.fn(async (q: string) => `Answer to: ${q}`);
    const user = userEvent.setup();
    renderPanel(ask);
    await user.type(
      screen.getByLabelText(/ask a question/i),
      "What is the fly doing?",
    );
    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(ask).toHaveBeenCalledWith("What is the fly doing?");
    expect(
      await screen.findByText("Answer to: What is the fly doing?"),
    ).toBeTruthy();
  });

  it("renders the answer as plain text, never HTML", async () => {
    const ask = vi.fn(async () => "Use <b>legs</b> & wings.");
    const user = userEvent.setup();
    renderPanel(ask);
    await user.type(screen.getByLabelText(/ask a question/i), "how?");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    const el = await screen.findByText("Use <b>legs</b> & wings.");
    expect(el.querySelector("b")).toBeNull();
  });

  it("asks the suggestion when a chip is clicked", async () => {
    const ask = vi.fn(async () => "The legs.");
    const user = userEvent.setup();
    renderPanel(ask, { suggestions: ["Which parts move?", "Is it real?"] });
    await user.click(screen.getByRole("button", { name: "Which parts move?" }));
    expect(ask).toHaveBeenCalledWith("Which parts move?");
    expect(await screen.findByText("The legs.")).toBeTruthy();
  });

  it("shows a loading state and disables the form while asking", async () => {
    const d = deferred<string>();
    const ask = vi.fn(() => d.promise);
    const user = userEvent.setup();
    renderPanel(ask);
    const input = screen.getByLabelText(/ask a question/i);
    await user.type(input, "Why?");
    const submit = screen.getByRole("button", { name: "Ask" });
    await user.click(submit);
    expect(screen.getByRole("status")).toBeTruthy();
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect((input as HTMLInputElement).disabled).toBe(true);
    d.resolve("Because.");
    expect(await screen.findByText("Because.")).toBeTruthy();
  });

  it("shows the error message when ask rejects", async () => {
    const ask = vi.fn(async () => {
      throw new Error("The live narrator is unavailable.");
    });
    const user = userEvent.setup();
    renderPanel(ask);
    await user.type(screen.getByLabelText(/ask a question/i), "hi");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The live narrator is unavailable.");
  });

  it("caps the question at 280 characters", async () => {
    const ask = vi.fn(async () => "answer");
    renderPanel(ask);
    const input = screen.getByLabelText(/ask a question/i) as HTMLInputElement;
    expect(input.maxLength).toBe(280);
    fireEvent.change(input, { target: { value: "x".repeat(300) } });
    expect(input.value).toHaveLength(280);
    expect(ask).not.toHaveBeenCalled();
  });

  it("never calls ask for an empty or blank question", async () => {
    const ask = vi.fn(async () => "answer");
    const user = userEvent.setup();
    renderPanel(ask);
    const submit = screen.getByRole("button", {
      name: "Ask",
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    await user.type(screen.getByLabelText(/ask a question/i), "   ");
    expect(submit.disabled).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });
});
