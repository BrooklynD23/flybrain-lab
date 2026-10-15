import { z } from "zod";

// Describes activity/<behavior>.bin (PLAN-01 §2).
// The id/path patterns mirror manifest.ts; they are duplicated here on purpose
// so the contract modules stay acyclic (manifest.ts imports this file).
const ID_PATTERN = /^[A-Za-z0-9_]{1,20}$/;
const ASSET_PATH_PATTERN = /^(?!.*\.\.)[a-z0-9_\-/.]+$/;

export const ActivityInfoSchema = z
  .object({
    url: z.string().regex(ASSET_PATH_PATTERN),
    binMs: z.literal(50),
    nBins: z.number().int().positive(), // durationMs / binMs
    channels: z.array(z.string().regex(ID_PATTERN)).min(1), // neuropil ids, then neuron ids
    maxHz: z.array(z.number().nonnegative()), // one per channel; v => v / 255 * maxHz[c] Hz
    encoding: z.literal("uint8-bin-major"), // byte index = bin * channels.length + channel
  })
  .strict()
  // NOT expressible in JSON Schema — Python callers must re-check:
  // maxHz.length === channels.length.
  .refine((a) => a.maxHz.length === a.channels.length, {
    message: "maxHz length must equal channels length",
  });

export type ActivityInfo = z.infer<typeof ActivityInfoSchema>;
