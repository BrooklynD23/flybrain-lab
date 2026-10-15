import { describe, expect, it, vi } from "vitest";

import type { NarrateRequest } from "../contracts/api.ts";
import { askLive, LiveNarrationError, RATE_LIMITED_MESSAGE } from "./live.ts";

const validRequest: NarrateRequest = {
  behavior: "walking",
  tMs: 1200,
  question: "What is the fly doing?",
  active: [{ id: "GNG", hz: 12.5 }],
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const fetchOk = (body: unknown = { text: "It is walking.", model: "m" }) =>
  (() => Promise.resolve(jsonResponse(body))) as typeof fetch;

describe("askLive", () => {
  it("POSTs the validated request to /api/narrate and returns the text", async () => {
    const fetchFn = vi.fn(fetchOk());
    const answer = await askLive(validRequest, fetchFn);
    expect(answer).toBe("It is walking.");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("/api/narrate");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      "content-type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toEqual(validRequest);
  });

  it("sends the trimmed question, not the raw input", async () => {
    const fetchFn = vi.fn(fetchOk());
    await askLive({ ...validRequest, question: "  padded?  " }, fetchFn);
    const [, init] = fetchFn.mock.calls[0]!;
    expect(JSON.parse(String(init?.body)).question).toBe("padded?");
  });

  it("returns the rate-limit message on HTTP 429 instead of throwing", async () => {
    const fetchFn = (() =>
      Promise.resolve(
        new Response("rate limited", { status: 429 }),
      )) as typeof fetch;
    await expect(askLive(validRequest, fetchFn)).resolves.toBe(
      RATE_LIMITED_MESSAGE,
    );
    expect(RATE_LIMITED_MESSAGE).toBe(
      "Too many questions, try again in a minute.",
    );
  });

  it("throws LiveNarrationError on HTTP 500", async () => {
    const fetchFn = (() =>
      Promise.resolve(new Response("boom", { status: 500 }))) as typeof fetch;
    await expect(askLive(validRequest, fetchFn)).rejects.toThrow(
      LiveNarrationError,
    );
    await expect(askLive(validRequest, fetchFn)).rejects.toThrow(/500/);
  });

  it("throws LiveNarrationError with the server error detail on 503", async () => {
    const fetchFn = (() =>
      Promise.resolve(
        jsonResponse({ error: "live mode unavailable" }, 503),
      )) as typeof fetch;
    await expect(askLive(validRequest, fetchFn)).rejects.toThrow(
      /live mode unavailable/,
    );
  });

  it("throws LiveNarrationError when the request times out", async () => {
    const hang = (() => new Promise<Response>(() => {})) as typeof fetch;
    await expect(askLive(validRequest, hang, 20)).rejects.toThrow(
      LiveNarrationError,
    );
    await expect(askLive(validRequest, hang, 20)).rejects.toThrow(/too long/i);
  });

  it("throws LiveNarrationError on a network failure", async () => {
    const fetchFn = (() =>
      Promise.reject(new TypeError("fetch failed"))) as typeof fetch;
    await expect(askLive(validRequest, fetchFn)).rejects.toThrow(
      LiveNarrationError,
    );
    await expect(askLive(validRequest, fetchFn)).rejects.toThrow(
      /could not reach|connection/i,
    );
  });

  it("never sends a schema-invalid request", async () => {
    const fetchFn = vi.fn(fetchOk());
    const bad = { ...validRequest, question: "x".repeat(281) };
    await expect(askLive(bad, fetchFn)).rejects.toThrow(LiveNarrationError);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("never sends a request with a blank question", async () => {
    const fetchFn = vi.fn(fetchOk());
    const bad = { ...validRequest, question: "   " };
    await expect(askLive(bad, fetchFn)).rejects.toThrow(LiveNarrationError);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("throws LiveNarrationError when a 200 body has an {error} payload", async () => {
    const fetchFn = fetchOk({ error: "model overloaded" });
    await expect(askLive(validRequest, fetchFn)).rejects.toThrow(
      /model overloaded/,
    );
  });

  it("throws LiveNarrationError when a 200 body fails schema parsing", async () => {
    const fetchFn = fetchOk({ answer: 42 });
    await expect(askLive(validRequest, fetchFn)).rejects.toThrow(
      LiveNarrationError,
    );
  });

  it("throws LiveNarrationError when a 200 body is not JSON", async () => {
    const fetchFn = (() =>
      Promise.resolve(
        new Response("<html></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      )) as typeof fetch;
    await expect(askLive(validRequest, fetchFn)).rejects.toThrow(
      LiveNarrationError,
    );
  });
});
