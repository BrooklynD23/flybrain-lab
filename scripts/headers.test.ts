import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Cloudflare Pages _headers: unindented line = path rule, indented lines = "Name: value".
function parse(text: string): Map<string, Map<string, string>> {
  const rules = new Map<string, Map<string, string>>();
  let current: Map<string, string> | undefined;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    if (!/^\s/.test(raw)) {
      current = new Map();
      rules.set(raw.trim(), current);
    } else {
      const i = raw.indexOf(":");
      current?.set(
        raw.slice(0, i).trim().toLowerCase(),
        raw.slice(i + 1).trim(),
      );
    }
  }
  return rules;
}

const rules = parse(readFileSync("public/_headers", "utf8"));

describe("_headers", () => {
  const all = rules.get("/*");
  it("sets CSP on /*", () => {
    const csp = all?.get("content-security-policy") ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("'wasm-unsafe-eval'");
    expect(csp).not.toContain("'unsafe-eval'");
  });
  it("sets the other security headers on /*", () => {
    expect(all?.get("x-content-type-options")).toBe("nosniff");
    expect(all?.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(all?.get("permissions-policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
  });
  it("caches data and fixtures for a day", () => {
    for (const p of ["/data/*", "/fixtures/*"])
      expect(rules.get(p)?.get("cache-control")).toBe("public, max-age=86400");
  });
  it("never caches /api/*", () => {
    expect(rules.get("/api/*")?.get("cache-control")).toBe("no-store");
  });
});
