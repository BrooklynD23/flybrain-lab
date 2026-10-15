# HUMAN-03 — Anthropic API key (optional live mode)

| Item | Value |
|---|---|
| Needed before | Live Q&A only. The default demo (replay) never needs it |
| Time | 15 min |
| Cost | Haiku 5.5 $0.10 / $0.50 per million input/output tokens; Sonnet 5.5 $2 / $10 ([pricing](https://platform.claude.com/docs/en/about-claude/pricing), fetched 2026-10-14). One question ≈ 800 input + 150 output tokens ≈ $0.00016 on Haiku, so 1,000 questions ≈ $0.16 |
| Pages secret | `ANTHROPIC_API_KEY` |
| Pages var (optional) | `NARRATION_MODEL` = `claude-haiku-5-5` (default, set in `wrangler.toml`) or `claude-sonnet-5-5` |
| GitHub variable | `VITE_NARRATION_MODE=live` (build-time switch for the UI) |

## Steps

1. Create a key: https://platform.claude.com/docs/en/get-api-key (console: https://platform.claude.com).
2. Set a monthly spend limit, e.g. $5: https://platform.claude.com/settings/billing
3. Store the key as a Pages secret (never in GitHub, never in a `VITE_*` var):
   ```bash
   npx wrangler pages secret put ANTHROPIC_API_KEY --project-name flybrain-lab
   ```
   Docs: https://developers.cloudflare.com/pages/functions/bindings/#secrets
4. Turn the UI to live mode: `gh variable set VITE_NARRATION_MODE --body live`, then re-run the `Deploy` workflow.
5. Local test: put `ANTHROPIC_API_KEY=...` in `.dev.vars` (gitignored), then `npm run build && npx wrangler pages dev dist`.
6. To turn live mode off: `gh variable set VITE_NARRATION_MODE --body replay` and redeploy, or `npx wrangler pages secret delete ANTHROPIC_API_KEY --project-name flybrain-lab` (the endpoint then returns 503 and the UI falls back to replay).

## Verification

```bash
curl -s -X POST https://flybrain-lab.pages.dev/api/narrate -H 'content-type: application/json' \
  -d '{"behavior":"feeding","tMs":1000,"question":"Why does the GNG light up?","active":[{"id":"GNG","hz":42}]}'
```
Expect `{"text":"...","model":"claude-haiku-5-5"}`. Without the secret: HTTP 503 `{"error":"live mode unavailable"}`.
