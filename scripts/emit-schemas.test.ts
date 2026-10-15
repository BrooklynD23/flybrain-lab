import { describe, expect, it } from "vitest";

import { renderSchemas } from "./emit-schemas.ts";

describe("renderSchemas", () => {
  it("returns exactly the 4 contract schemas", () => {
    const out = renderSchemas();
    expect(Object.keys(out).sort()).toEqual([
      "activity",
      "api",
      "manifest",
      "narration",
    ]);
  });

  it("each entry parses as JSON and declares $schema", () => {
    for (const [name, text] of Object.entries(renderSchemas())) {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      expect(parsed, name).toHaveProperty("$schema");
    }
  });

  it("is deterministic and ends with a trailing newline", () => {
    const first = renderSchemas();
    expect(first).toEqual(renderSchemas());
    for (const [name, text] of Object.entries(first)) {
      expect(text.endsWith("\n"), name).toBe(true);
    }
  });
});
