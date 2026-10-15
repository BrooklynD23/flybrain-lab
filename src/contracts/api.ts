import { z } from "zod";

import { BehaviorIdSchema, IdSchema } from "./manifest.ts";

export const ActiveRegionSchema = z
  .object({
    id: IdSchema,
    hz: z.number().nonnegative(),
  })
  .strict();
export type ActiveRegion = z.infer<typeof ActiveRegionSchema>;

// POST /api/narrate request body (live mode, PLAN-01 §2 and §7).
export const NarrateRequestSchema = z
  .object({
    behavior: BehaviorIdSchema,
    tMs: z.number().int().min(0).max(60000),
    // Trimmed BEFORE the length check. The trim itself is NOT expressible in
    // JSON Schema — Python callers must re-check: question.strip() then 1..280.
    question: z.string().trim().min(1).max(280),
    active: z.array(ActiveRegionSchema).max(10),
  })
  .strict();
export type NarrateRequest = z.infer<typeof NarrateRequestSchema>;

export const NarrateResponseSchema = z.union([
  z.object({ text: z.string(), model: z.string() }).strict(),
  z.object({ error: z.string() }).strict(),
]);
export type NarrateResponse = z.infer<typeof NarrateResponseSchema>;
