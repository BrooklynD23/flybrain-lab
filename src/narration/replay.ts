import {
  NarrationScriptSchema,
  type NarrationCue,
  type NarrationScript,
} from "../contracts/narration.ts";

export const REPLAY_FALLBACK =
  "Replay mode has no answer for that. Try one of the suggested questions.";

const OVERLAP_THRESHOLD = 0.5;

export async function loadScript(
  url: string,
  fetchFn: typeof fetch = fetch,
): Promise<NarrationScript> {
  const res = await fetchFn(url);
  if (!res.ok) {
    throw new Error(
      `Failed to load narration script ${url}: HTTP ${res.status}`,
    );
  }
  const json: unknown = await res.json();
  const script = NarrationScriptSchema.parse(json);
  for (let i = 1; i < script.cues.length; i++) {
    if (script.cues[i]!.tMs <= script.cues[i - 1]!.tMs) {
      throw new Error(
        `Narration script ${url} has cues out of order at index ${i} (tMs ${script.cues[i]!.tMs} after ${script.cues[i - 1]!.tMs})`,
      );
    }
  }
  return script;
}

export function cueAt(
  script: NarrationScript,
  tMs: number,
): NarrationCue | null {
  let found: NarrationCue | null = null;
  for (const cue of script.cues) {
    if (cue.tMs > tMs) break;
    found = cue;
  }
  return found;
}

// lowercase, punctuation -> space, collapse spaces, trim
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): Set<string> {
  return new Set(normalize(text).split(" ").filter(Boolean));
}

function tokenOverlap(a: Set<string>, b: Set<string>): number {
  const unionSize = a.size + b.size;
  if (unionSize === 0) return 0;
  let shared = 0;
  for (const t of a) {
    if (b.has(t)) shared++;
  }
  return shared / (unionSize - shared); // Jaccard: |A∩B| / |A∪B|
}

export function answerReplay(
  script: NarrationScript,
  question: string,
): string {
  const normalized = normalize(question);
  if (normalized === "") return REPLAY_FALLBACK;

  for (const entry of script.qa) {
    if (normalize(entry.q) === normalized) return entry.a;
  }

  const questionTokens = tokens(question);
  let best: { score: number; a: string } | null = null;
  for (const entry of script.qa) {
    const score = tokenOverlap(questionTokens, tokens(entry.q));
    if (score >= OVERLAP_THRESHOLD && (best === null || score > best.score)) {
      best = { score, a: entry.a };
    }
  }
  return best?.a ?? REPLAY_FALLBACK;
}

export function suggestedQuestions(script: NarrationScript): string[] {
  return script.qa.slice(0, 3).map((entry) => entry.q);
}
