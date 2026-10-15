import { ManifestSchema, type Manifest } from "../contracts/manifest.ts";

/** Asset roots tried in order. URLs inside the manifest resolve against `base`. */
export const MANIFEST_URLS = [
  "/data/manifest.json",
  "/fixtures/manifest.json",
] as const;

export type FetchFn = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

/** User-readable failure of manifest loading. App shows this and a Retry. */
export class ManifestError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ManifestError";
  }
}

export interface LoadedManifest {
  manifest: Manifest;
  /** "/data" or "/fixtures" — join as `${base}/${assetUrl}`. */
  base: string;
}

const baseOf = (url: string) => url.slice(0, url.lastIndexOf("/"));

function describeIssues(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): string {
  return error.issues
    .slice(0, 3)
    .map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

/**
 * Fetch and zod-parse one manifest URL.
 * Returns null when the caller should try the next URL (non-OK status,
 * non-JSON content-type, or a JSON parse error — Pages/vite-preview answer
 * unknown paths with index.html + 200). Throws ManifestError on network
 * or schema failure.
 */
async function fetchManifest(
  url: string,
  fetchFn: FetchFn,
): Promise<Manifest | null> {
  let res: Response;
  try {
    res = await fetchFn(url);
  } catch (cause) {
    throw new ManifestError(
      `Could not reach ${url}. Check your connection and reload the page.`,
      { cause },
    );
  }
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    return null;
  }
  const parsed = ManifestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ManifestError(
      `The manifest at ${url} is invalid: ${describeIssues(parsed.error)}`,
    );
  }
  const manifest = parsed.data;
  // Boundary check per WAVE-03 spec. BehaviorInfoSchema.refine already
  // enforces this, so it can only fire if the schema ever loosens.
  for (const b of manifest.behaviors) {
    if (b.activity.nBins * b.activity.binMs !== b.durationMs) {
      throw new ManifestError(
        `The manifest at ${url} is invalid: ${b.id} activity has ` +
          `${b.activity.nBins} x ${b.activity.binMs} ms bins, which does not ` +
          `cover ${b.durationMs} ms.`,
      );
    }
  }
  return manifest;
}

/**
 * Load the app manifest: real data first, fixture data as the built-in
 * fallback. Resolves with the parsed manifest plus its asset base.
 */
export async function loadManifest(
  fetchFn: FetchFn = fetch,
): Promise<LoadedManifest> {
  for (const url of MANIFEST_URLS) {
    const manifest = await fetchManifest(url, fetchFn);
    if (manifest) return { manifest, base: baseOf(url) };
  }
  throw new ManifestError(
    "Could not load the site data: neither /data nor /fixtures served a " +
      "valid manifest. Reload the page; if that does not help, the site " +
      "deployment is broken.",
  );
}
