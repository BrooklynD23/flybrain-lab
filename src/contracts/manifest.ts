import { z } from "zod";

import { ActivityInfoSchema } from "./activity.ts";

export const BEHAVIORS = ["walking", "grooming", "feeding", "escape"] as const;
export type BehaviorId = (typeof BEHAVIORS)[number];
export const BehaviorIdSchema = z.enum(BEHAVIORS);

export const CLIP_SOURCES = [
  "reference-replay",
  "policy",
  "keyframed",
] as const;
export type ClipSource = (typeof CLIP_SOURCES)[number];
export const ClipSourceSchema = z.enum(CLIP_SOURCES);

// Shared field rules. Both are emitted to JSON Schema as `pattern`, so Python
// jsonschema enforces them identically.
export const ID_PATTERN = /^[A-Za-z0-9_]{1,20}$/;
export const IdSchema = z.string().regex(ID_PATTERN);

// Relative asset path: no ".." segments, so URLs cannot escape the asset root.
export const ASSET_PATH_PATTERN = /^(?!.*\.\.)[a-z0-9_\-/.]+$/;
export const AssetPathSchema = z.string().regex(ASSET_PATH_PATTERN);

// glTF node names = flywire root ids.
export const NeuronInfoSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    cellType: z.string().min(1),
    neuropil: IdSchema,
  })
  .strict();
export type NeuronInfo = z.infer<typeof NeuronInfoSchema>;

export const StimulusSchema = z
  .object({
    description: z.string().min(1),
    cellTypes: z.array(z.string().min(1)),
    assumption: z.boolean(),
    source: z.string().min(1),
  })
  .strict();
export type Stimulus = z.infer<typeof StimulusSchema>;

export const BehaviorInfoSchema = z
  .object({
    id: BehaviorIdSchema,
    label: z.string().min(1),
    durationMs: z.number().int().positive(), // body clip and activity share this length
    clipSource: ClipSourceSchema,
    activity: ActivityInfoSchema,
    narrationUrl: AssetPathSchema,
    stimulus: StimulusSchema,
  })
  .strict()
  // NOT expressible in JSON Schema — Python callers must re-check per behavior:
  // activity.nBins * activity.binMs === durationMs.
  .refine((b) => b.activity.nBins * b.activity.binMs === b.durationMs, {
    message: "activity nBins * binMs must equal durationMs",
  });
export type BehaviorInfo = z.infer<typeof BehaviorInfoSchema>;

export const AttributionSchema = z
  .object({
    name: z.string().min(1),
    licence: z.string().min(1),
    url: z.url(), // external link to the source (not an asset path)
    citation: z.string().min(1),
  })
  .strict();
export type Attribution = z.infer<typeof AttributionSchema>;

export const ManifestSchema = z
  .object({
    version: z.literal(1),
    dataSource: z.enum(["fixture", "flywire-783"]),
    brain: z
      .object({
        // glTF node names = neuropil ids, e.g. "GNG", "AMMC_L"
        neuropils: z
          .object({
            url: AssetPathSchema,
            kind: z.enum(["mesh", "points"]),
            ids: z.array(IdSchema).min(1),
          })
          .strict(),
        neurons: z
          .object({
            url: AssetPathSchema,
            items: z.array(NeuronInfoSchema),
          })
          .strict(),
      })
      .strict(),
    // fly.glb, one animation per behavior, named by BehaviorId
    body: z.object({ url: AssetPathSchema }).strict(),
    behaviors: z.array(BehaviorInfoSchema).min(1),
    attribution: z.array(AttributionSchema).min(1),
  })
  .strict();
export type Manifest = z.infer<typeof ManifestSchema>;
