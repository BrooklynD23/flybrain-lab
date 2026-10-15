import {
  NarrateRequestSchema,
  NarrateResponseSchema,
  type NarrateRequest,
} from "../contracts/api.ts";

export const NARRATE_URL = "/api/narrate";

/** Returned (not thrown) on HTTP 429 — the ask panel shows it as the answer. */
export const RATE_LIMITED_MESSAGE =
  "Too many questions, try again in a minute.";

/** User-readable failure of the live narration call. UI shows this verbatim. */
export class LiveNarrationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LiveNarrationError";
  }
}

/**
 * Ask the live narrator (Pages Function -> Anthropic). Validates the request
 * with zod before anything is sent; parses NarrateResponse on the way back.
 * Rejects with LiveNarrationError on timeout, network, HTTP or schema errors —
 * except HTTP 429, which resolves to RATE_LIMITED_MESSAGE.
 */
export async function askLive(
  req: NarrateRequest,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 15000,
): Promise<string> {
  const parsed = NarrateRequestSchema.safeParse(req);
  if (!parsed.success) {
    throw new LiveNarrationError(
      "That question cannot be sent to live mode. Keep it between 1 and 280 " +
        "characters and try again.",
    );
  }

  // AbortController + setTimeout (not AbortSignal.timeout) so the timeout also
  // works when a custom fetchFn ignores the abort signal — and jsdom's
  // AbortSignal lacks .timeout.
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Flag, not DOMException: jsdom's DOMException is not an Error subclass.
  let expired = false;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      expired = true;
      controller.abort();
      reject(new Error("The operation timed out."));
    }, timeoutMs);
  });

  let res: Response;
  try {
    res = await Promise.race([
      fetchFn(NARRATE_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
        signal: controller.signal,
      }),
      timedOut,
    ]);
  } catch (cause) {
    const name =
      cause !== null && typeof cause === "object" && "name" in cause
        ? String(cause.name)
        : "";
    if (expired || name === "TimeoutError" || name === "AbortError") {
      throw new LiveNarrationError(
        "The live answer took too long. Try again, or switch to replay mode.",
        { cause },
      );
    }
    throw new LiveNarrationError(
      "Could not reach the live narrator. Check your connection and try " +
        "again, or switch to replay mode.",
      { cause },
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) return RATE_LIMITED_MESSAGE;

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON body — handled below as invalid/unavailable.
  }
  const body = NarrateResponseSchema.safeParse(json);

  if (!res.ok) {
    const detail =
      body.success && "error" in body.data ? ` ${body.data.error}` : "";
    throw new LiveNarrationError(
      `The live narrator is unavailable right now (HTTP ${res.status}).` +
        `${detail} Try replay mode.`,
    );
  }
  if (!body.success) {
    throw new LiveNarrationError(
      "The live narrator sent an unexpected response. Try again, or switch " +
        "to replay mode.",
    );
  }
  if ("error" in body.data) {
    throw new LiveNarrationError(`Live narration failed: ${body.data.error}`);
  }
  return body.data.text;
}
