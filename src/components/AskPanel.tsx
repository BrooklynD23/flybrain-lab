import { useState, type FormEvent } from "react";

export type AskMode = "replay" | "live";

export interface AskPanelProps {
  /** Resolves with the answer text; may reject with a user-readable Error. */
  ask: (question: string) => Promise<string>;
  /** Clickable sample questions, e.g. from `suggestedQuestions(script)`. */
  suggestions: string[];
  mode: AskMode;
}

export const MAX_QUESTION_CHARS = 280;

const MODE_TAG: Record<AskMode, string> = {
  replay: "Replay",
  live: "Live (Claude)",
};

/**
 * Question box for the narration panel. Renders the answer as plain text
 * (JSX string interpolation — never HTML).
 */
export function AskPanel({ ask, suggestions, mode }: AskPanelProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(raw: string) {
    const q = raw.trim();
    if (q === "" || loading) return;
    setLoading(true);
    setAnswer(null);
    setError(null);
    try {
      setAnswer(await ask(q));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Something went wrong. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void run(question);
  }

  function onSuggestion(question: string) {
    setQuestion(question.slice(0, MAX_QUESTION_CHARS));
    void run(question);
  }

  return (
    <section>
      <span>{MODE_TAG[mode]}</span>
      <form onSubmit={onSubmit}>
        <label htmlFor="ask-question">Ask a question</label>
        <input
          id="ask-question"
          type="text"
          value={question}
          maxLength={MAX_QUESTION_CHARS}
          disabled={loading}
          onChange={(event) =>
            setQuestion(event.target.value.slice(0, MAX_QUESTION_CHARS))
          }
          placeholder="e.g. What is the fly doing?"
        />
        <button type="submit" disabled={loading || question.trim() === ""}>
          Ask
        </button>
      </form>
      {suggestions.length > 0 && (
        <ul>
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                disabled={loading}
                onClick={() => onSuggestion(s)}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
      {loading && <p role="status">Thinking…</p>}
      {error !== null && <p role="alert">{error}</p>}
      {answer !== null && <p aria-live="polite">{answer}</p>}
    </section>
  );
}
