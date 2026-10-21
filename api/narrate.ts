// Vercel edge-function port of the Cloudflare Pages Function in
// functions/api/narrate.ts. Same handler: env comes from process.env and the
// client IP arrives via x-forwarded-for instead of CF-Connecting-IP.
// ponytail: in-memory rate limit is per-isolate; upgrade path is Vercel KV or
// the same external binding used on Cloudflare (NARRATE_LIMITER).
import { handle, type Env } from "../functions/api/narrate.ts";

export const config = { runtime: "edge" };

const env: Env = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  NARRATION_MODEL: process.env.NARRATION_MODEL,
};

export default function handler(request: Request): Promise<Response> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!ip || request.headers.has("cf-connecting-ip")) {
    return handle(request, env);
  }
  const headers = new Headers(request.headers);
  headers.set("cf-connecting-ip", ip);
  return handle(new Request(request, { headers }), env);
}
