import { z } from "zod";

import { BehaviorIdSchema, IdSchema } from "./manifest.ts";

export const CueFocusSchema = z
  .object({
    neuropils: z.array(IdSchema),
    neurons: z.array(IdSchema),
  })
  .strict();
export type CueFocus = z.infer<typeof CueFocusSchema>;

export const NarrationCueSchema = z
  .object({
    // Cue tMs ascending and < durationMs is checked by the app, NOT the schema
    // (WAVE-01 T01.1); the schema only requires a non-negative integer.
    tMs: z.number().int().nonnegative(),
    text: z.string().max(280),
    focus: CueFocusSchema,
  })
  .strict();
export type NarrationCue = z.infer<typeof NarrationCueSchema>;

export const QaEntrySchema = z
  .object({
    q: z.string().min(1),
    a: z.string().min(1),
  })
  .strict();
export type QaEntry = z.infer<typeof QaEntrySchema>;

// public/narration/<behavior>.json (PLAN-01 §2)
export const NarrationScriptSchema = z
  .object({
    behavior: BehaviorIdSchema,
    cues: z.array(NarrationCueSchema),
    qa: z.array(QaEntrySchema), // replay answers for the Ask panel
  })
  .strict();
export type NarrationScript = z.infer<typeof NarrationScriptSchema>;
