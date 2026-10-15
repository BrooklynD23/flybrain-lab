import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("@react-three/fiber", () => ({
  Canvas: ({
    children,
    dpr,
    gl,
  }: {
    children: ReactNode;
    dpr: unknown;
    gl: { antialias: boolean };
  }) => (
    <div
      data-testid="canvas"
      data-dpr={JSON.stringify(dpr)}
      data-aa={String(gl.antialias)}
    >
      {children}
    </div>
  ),
}));
vi.mock("./scene/BrainView", () => ({
  BrainView: ({ quality }: { quality: string }) => (
    <div data-testid="brain" data-quality={quality} />
  ),
}));
vi.mock("./scene/BodyView", () => ({
  BodyView: ({ behavior }: { behavior: string }) => (
    <div data-testid="body" data-behavior={behavior} />
  ),
}));

const pub = (path: string) => readFileSync(join(process.cwd(), "public", path));
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

let fetched: string[] = [];
let badManifest = false;
let liveFails = false;

function fakeFetch(input: string | URL | Request): Promise<Response> {
  const url = String(input);
  fetched.push(url);
  if (url === "/api/narrate") {
    return Promise.resolve(
      liveFails
        ? json({ error: "x" }, 500)
        : json({ text: "live!", model: "m" }),
    );
  }
  if (url === "/fixtures/manifest.json") {
    return Promise.resolve(
      badManifest ? json({ nope: true }) : json(JSON.parse(String(pub(url)))),
    );
  }
  if (url.startsWith("/data/"))
    return Promise.resolve(new Response("", { status: 404 }));
  if (url.endsWith(".json"))
    return Promise.resolve(json(JSON.parse(String(pub(url)))));
  const buf = pub(url);
  return Promise.resolve(new Response(new Uint8Array(buf), { status: 200 }));
}

function setUrl(search: string) {
  window.history.replaceState(null, "", `/${search}`);
}

beforeEach(() => {
  fetched = [];
  badManifest = false;
  liveFails = false;
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
  vi.stubGlobal("hardwareConcurrency", 8);
  Object.defineProperty(navigator, "hardwareConcurrency", {
    value: 8,
    configurable: true,
  });
  setUrl("");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("App", () => {
  it("shows loading, then the picker and both panes", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "FlyBrain Lab" })).toBeTruthy();
    expect(screen.getByText(/loading/i)).toBeTruthy();
    expect(await screen.findByRole("radiogroup")).toBeTruthy();
    expect(await screen.findByTestId("brain")).toBeTruthy();
    expect(screen.getByTestId("body").dataset.behavior).toBe("feeding");
  });

  it("loads the activity for a newly selected behavior", async () => {
    render(<App />);
    await screen.findByTestId("brain");
    fireEvent.click(screen.getByRole("radio", { name: /walking/i }));
    await waitFor(() =>
      expect(fetched.some((u) => u.endsWith("walking.bin"))).toBe(true),
    );
    await waitFor(() =>
      expect(screen.getByTestId("body").dataset.behavior).toBe("walking"),
    );
  });

  it("honors ?behavior=", async () => {
    setUrl("?behavior=grooming");
    render(<App />);
    await waitFor(() =>
      expect(screen.getByTestId("body").dataset.behavior).toBe("grooming"),
    );
  });

  it("shows an error panel and retries on a bad manifest", async () => {
    badManifest = true;
    render(<App />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    badManifest = false;
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByRole("radiogroup")).toBeTruthy();
  });

  it("answers from the replay script by default", async () => {
    render(<App />);
    await screen.findByTestId("brain");
    const script = JSON.parse(String(pub("/narration/feeding.json")));
    const { q, a } = script.qa[0];
    fireEvent.change(screen.getByLabelText(/ask a question/i), {
      target: { value: q },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByText(a)).toBeTruthy();
    expect(fetched).not.toContain("/api/narrate");
  });

  it("falls back to the replay answer when live fails", async () => {
    vi.stubEnv("VITE_NARRATION_MODE", "live");
    liveFails = true;
    render(<App />);
    await screen.findByTestId("brain");
    const script = JSON.parse(String(pub("/narration/feeding.json")));
    const { q, a } = script.qa[0];
    fireEvent.change(screen.getByLabelText(/ask a question/i), {
      target: { value: q },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByText(new RegExp(a.slice(0, 20)))).toBeTruthy();
    expect(fetched).toContain("/api/narrate");
  });

  it("honors ?quality=low", async () => {
    setUrl("?quality=low");
    render(<App />);
    const canvases = await screen.findAllByTestId("canvas");
    for (const c of canvases) {
      expect(c.dataset.dpr).toBe("1");
      expect(c.dataset.aa).toBe("false");
    }
    expect(screen.getByTestId("brain").dataset.quality).toBe("low");
  });

  it("defaults to low quality on weak hardware", async () => {
    Object.defineProperty(navigator, "hardwareConcurrency", {
      value: 4,
      configurable: true,
    });
    render(<App />);
    expect((await screen.findByTestId("brain")).dataset.quality).toBe("low");
  });

  it("shows fps only with ?debug=1", async () => {
    setUrl("?debug=1");
    render(<App />);
    expect(await screen.findByTestId("fps")).toBeTruthy();
  });
});
