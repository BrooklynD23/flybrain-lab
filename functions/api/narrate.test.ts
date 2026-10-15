// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { callModel, handle, type Env } from "./narrate.ts";

const KEY = "sk-secret-test-key";
const good = {
  behavior: "feeding",
  tMs: 1000,
  question: "What is happening?",
  active: [{ id: "SMP", hz: 12 }],
};
let ipN = 0;
const freshIp = () => `10.0.0.${++ipN}`;

function req(
  body: unknown,
  init: { ip?: string; method?: string; raw?: string } = {},
) {
  const raw = init.raw ?? JSON.stringify(body);
  return new Request("https://x.test/api/narrate", {
    method: init.method ?? "POST",
    headers: { "CF-Connecting-IP": init.ip ?? freshIp() },
    ...(init.method === "GET" ? {} : { body: raw }),
  });
}
const env: Env = { ANTHROPIC_API_KEY: KEY };
const fake = vi.fn(async () => ({ text: "hello", model: "claude-haiku-5-5" }));
const deps = (now = 0) => ({ callModel: fake, now: () => now });

afterEach(() => {
  vi.restoreAllMocks();
  fake.mockClear();
});

describe("handle", () => {
  it("200 path with no-store", async () => {
    const res = await handle(req(good), env, deps());
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({
      text: "hello",
      model: "claude-haiku-5-5",
    });
  });

  it("405 on GET", async () => {
    const res = await handle(req(null, { method: "GET" }), env, deps());
    expect(res.status).toBe(405);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("413 on big body", async () => {
    const res = await handle(req(null, { raw: "x".repeat(3000) }), env, deps());
    expect(res.status).toBe(413);
  });

  it("413 on big Content-Length header", async () => {
    const r = new Request("https://x.test/", {
      method: "POST",
      headers: { "content-length": "5000", "CF-Connecting-IP": freshIp() },
      body: "{}",
    });
    expect((await handle(r, env, deps())).status).toBe(413);
  });

  it("400 on malformed JSON", async () => {
    expect(
      (await handle(req(null, { raw: "{nope" }), env, deps())).status,
    ).toBe(400);
  });

  it.each([
    ["bad behavior", { ...good, behavior: "dancing" }],
    ["negative tMs", { ...good, tMs: -1 }],
    ["tMs too big", { ...good, tMs: 60001 }],
    ["empty question", { ...good, question: "   " }],
    ["long question", { ...good, question: "a".repeat(281) }],
    [
      "too many active",
      {
        ...good,
        active: Array.from({ length: 11 }, () => ({ id: "SMP", hz: 1 })),
      },
    ],
    ["extra key", { ...good, extra: 1 }],
    ["not an object", [1]],
  ])("400 on %s", async (_n, body) => {
    const res = await handle(req(body), env, deps());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid request" });
  });

  it("429 after 10 calls per IP, resets after 60 s", async () => {
    const ip = freshIp();
    for (let i = 0; i < 10; i++) {
      expect((await handle(req(good, { ip }), env, deps(1000))).status).toBe(
        200,
      );
    }
    expect((await handle(req(good, { ip }), env, deps(2000))).status).toBe(429);
    expect(
      (await handle(req(good, { ip: freshIp() }), env, deps(2000))).status,
    ).toBe(200);
    expect((await handle(req(good, { ip }), env, deps(62000))).status).toBe(
      200,
    );
  });

  it("uses the binding when present", async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const ip = freshIp();
    const res = await handle(
      req(good, { ip }),
      { ...env, NARRATE_LIMITER: { limit } },
      deps(),
    );
    expect(limit).toHaveBeenCalledWith({ key: ip });
    expect(res.status).toBe(429);
    const ok = vi.fn(async () => ({ success: true }));
    const res2 = await handle(
      req(good),
      { ...env, NARRATE_LIMITER: { limit: ok } },
      deps(),
    );
    expect(res2.status).toBe(200);
  });

  it("503 when key missing", async () => {
    const res = await handle(req(good), {}, deps());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "live mode unavailable" });
  });

  it("502 when callModel throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const boom = vi.fn(async () => {
      throw new Error(`upstream ${KEY}`);
    });
    const res = await handle(req(good), env, { callModel: boom, now: () => 0 });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "narration failed" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain(KEY);
  });

  it("trims text to 600 chars", async () => {
    const long = vi.fn(async () => ({ text: "a".repeat(900), model: "m" }));
    const res = await handle(req(good), env, { callModel: long, now: () => 0 });
    expect(((await res.json()) as { text: string }).text).toHaveLength(600);
  });
});

describe("callModel", () => {
  const parsed = {
    behavior: "feeding" as const,
    tMs: 1,
    question: "q",
    active: [],
  };
  const okFetch = () =>
    vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
      Response.json({ content: [{ type: "text", text: "hi" }] }),
    );

  it("posts to Anthropic with headers and body", async () => {
    const f = okFetch();
    vi.stubGlobal("fetch", f);
    const out = await callModel(
      { ...env, NARRATION_MODEL: "claude-sonnet-5-5" },
      parsed,
    );
    expect(out).toEqual({ text: "hi", model: "claude-sonnet-5-5" });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const h = init.headers as Record<string, string>;
    expect(h["x-api-key"]).toBe(KEY);
    expect(h["anthropic-version"]).toBe("2023-06-01");
    const body = JSON.parse(init.body as string);
    expect(body.max_tokens).toBe(300);
    expect(body.messages[0].content).toBe(JSON.stringify(parsed));
    expect(body.system).toMatch(/simulated/);
  });

  it("falls back to haiku for models outside the allowlist", async () => {
    const f = okFetch();
    vi.stubGlobal("fetch", f);
    const out = await callModel(
      { ...env, NARRATION_MODEL: "gpt-evil" },
      parsed,
    );
    expect(out.model).toBe("claude-haiku-5-5");
    expect(
      JSON.parse((f.mock.calls[0]![1] as RequestInit).body as string).model,
    ).toBe("claude-haiku-5-5");
  });

  it("throws status-only error on upstream 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(`secret ${KEY}`, { status: 500 })),
    );
    await expect(callModel(env, parsed)).rejects.toThrow(/^upstream 500$/);
  });

  it("throws on unexpected payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ content: [] })),
    );
    await expect(callModel(env, parsed)).rejects.toThrow();
  });
});
