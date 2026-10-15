import {
  NarrateRequestSchema,
  type NarrateRequest,
} from "../../src/contracts/api.ts";

export interface Env {
  ANTHROPIC_API_KEY?: string;
  NARRATION_MODEL?: string;
  NARRATE_LIMITER?: {
    limit(opts: { key: string }): Promise<{ success: boolean }>;
  };
}

interface Deps {
  callModel: (
    env: Env,
    req: NarrateRequest,
  ) => Promise<{ text: string; model: string }>;
  now: () => number;
}

const MAX_BODY_BYTES = 2048;
const MAX_TEXT = 600;
const LIMIT = 10;
const WINDOW_MS = 60_000;
const MODELS = ["claude-haiku-5-5", "claude-sonnet-5-5"];
const SYSTEM =
  "You explain fruit fly brain activity to a lay audience in at most 80 words. " +
  "State that the activity comes from a simulated model with assumed signs. " +
  "Do not invent neuron names beyond those given in the JSON input.";

// ponytail: per-isolate only; binding is the real limit
const buckets = new Map<string, { count: number; resetAt: number }>();

function respond(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function fail(status: number, error: string): Response {
  return respond({ error }, status);
}

async function allowed(
  request: Request,
  env: Env,
  now: number,
): Promise<boolean> {
  const key = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (env.NARRATE_LIMITER)
    return (await env.NARRATE_LIMITER.limit({ key })).success;
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (b.count >= LIMIT) return false;
  buckets.set(key, { ...b, count: b.count + 1 });
  return true;
}

export async function callModel(
  env: Env,
  req: NarrateRequest,
): Promise<{ text: string; model: string }> {
  const model = MODELS.includes(env.NARRATION_MODEL ?? "")
    ? env.NARRATION_MODEL!
    : MODELS[0]!;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      system: SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(req) }],
    }),
  });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const data = (await res.json()) as {
    content?: { type?: string; text?: string }[];
  };
  const text = data.content?.find((c) => c.type === "text")?.text;
  if (typeof text !== "string") throw new Error("upstream bad payload");
  return { text, model };
}

export async function handle(
  request: Request,
  env: Env,
  deps: Deps = { callModel, now: Date.now },
): Promise<Response> {
  if (request.method !== "POST") return fail(405, "method not allowed");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return fail(413, "payload too large");
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES)
    return fail(413, "payload too large");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return fail(400, "invalid request");
  }
  const parsed = NarrateRequestSchema.safeParse(json);
  if (!parsed.success) return fail(400, "invalid request");
  if (!(await allowed(request, env, deps.now())))
    return fail(429, "rate limited");
  if (!env.ANTHROPIC_API_KEY) return fail(503, "live mode unavailable");
  try {
    const { text, model } = await deps.callModel(env, parsed.data);
    return respond({ text: text.slice(0, MAX_TEXT), model });
  } catch (err) {
    // status only: never log the key or the upstream body
    console.error(
      "narrate upstream failed",
      err instanceof Error
        ? err.message.replace(env.ANTHROPIC_API_KEY, "[redacted]")
        : "unknown",
    );
    return fail(502, "narration failed");
  }
}

export const onRequestPost = ({
  request,
  env,
}: {
  request: Request;
  env: Env;
}) => handle(request, env);
