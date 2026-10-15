# RESEARCH-02 — Stack and hosting

Checked 2026-10-14 against npm/PyPI registries and vendor docs. UNVERIFIED items marked.

## 1. Hosting options

| Host | Free allowance | Fit | Link |
|---|---|---|---|
| **Cloudflare Pages Free (chosen)** | 500 builds/month, 20,000 files, 25 MiB per file, 20 min build; bandwidth unlimited (UNVERIFIED) | Static + one Function; no cold start | https://developers.cloudflare.com/pages/platform/limits/ |
| Workers Free (Functions quota) | 100,000 requests/day, 10 ms CPU per request | `/api/narrate` is I/O-bound (waits on Anthropic), fits | https://developers.cloudflare.com/workers/platform/pricing |
| Workers rate-limit binding | `limit` per `period` per key; availability inside Pages Functions UNVERIFIED | Fallback: in-memory limiter | https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit |
| R2 Free | 10 GB-month, free egress | Only if assets outgrow Pages | https://developers.cloudflare.com/r2/pricing |
| GitHub Pages | 1 GB site, 100 GB/month soft | No serverless function for live mode | https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits |
| Vercel Hobby | Non-commercial only; numbers UNVERIFIED | Would work; no advantage | https://vercel.com/docs/limits |
| Render free | 512 MB, sleeps after 15 min, ~1 min cold start | Not needed: no Python at runtime | https://render.com/docs/free |
| HF Spaces | Static Spaces free; Docker/Gradio need PRO | Not needed | https://huggingface.co/docs/hub/spaces-overview |

## 2. npm versions

| Package | Version | Link |
|---|---|---|
| three | 0.186.1 | https://registry.npmjs.org/three/latest |
| @react-three/fiber | 9.8.2 (React 19) | https://r3f.docs.pmnd.rs |
| @react-three/drei | 10.7.9 | https://drei.docs.pmnd.rs |
| react / react-dom | 19.3.1 | https://react.dev |
| vite | 8.3.4 | https://registry.npmjs.org/vite/latest |
| typescript | 7.0.2 (major jump; tooling compatibility checked in WAVE-00) | https://registry.npmjs.org/typescript/latest |
| vitest, @vitest/coverage-v8 | 5.0.4 | https://registry.npmjs.org/vitest/latest |
| @playwright/test | 1.64.1 | https://registry.npmjs.org/@playwright/test/latest |
| eslint / prettier | 10.12.0 / 3.9.10 | https://eslint.org , https://prettier.io |
| zod | 4.6.7 | https://zod.dev |
| @gltf-transform/cli | 4.5.1 | https://gltf-transform.dev/cli |
| wrangler | 4.151.0 | https://developers.cloudflare.com/workers/wrangler |
| @anthropic-ai/sdk | 0.134.0 (not used; plain `fetch`) | https://www.npmjs.com/package/@anthropic-ai/sdk |
| Node | 24 LTS (22 EOL 2026-09-23) | https://nodejs.org/en/about/releases/ |

Draco and Basis decoders ship in `three/examples/jsm/libs/` and would need copying to `public/`; meshopt's decoder is bundled JS, which is one reason we use meshopt only.

## 3. PyPI versions

| Package | Version | Link |
|---|---|---|
| numpy / pandas / pyarrow | 2.5.4 / 3.0.6 / 26.0.0 | https://pypi.org/project/pandas/ |
| mujoco | 3.16.0 | https://pypi.org/project/mujoco/ |
| fast-simplification | 0.2.0 | https://pypi.org/project/fast-simplification/ |
| fafbseg / navis | 3.2.2 / 1.12.0 | https://pypi.org/project/fafbseg/ |
| brian2 | 2.10.1 (Shiu repo pins its own version; we follow the repo) | https://pypi.org/project/Brian2/ |
| pytest / ruff | 9.1.1 / 0.17.0 | https://pypi.org/project/pytest/ |
| uv | 0.13.1 | https://github.com/astral-sh/uv/releases |

## 4. Anthropic API (live mode only)

| Item | Value | Link |
|---|---|---|
| Models | `claude-haiku-5-5` (default), `claude-sonnet-5-5` | https://platform.claude.com/docs/en/about-claude/models/overview |
| Price | Haiku 5.5 $0.10 / $0.50 per MTok; Sonnet 5.5 $2 / $10 (one older note said $1/$5; re-check before relying on cost numbers) | https://platform.claude.com/docs/en/about-claude/pricing |
| Key | env `ANTHROPIC_API_KEY` | https://platform.claude.com/docs/en/get-api-key |
| Rate limits | Tier-dependent; new orgs may start lower | https://platform.claude.com/docs/en/api/rate-limits |
| Spend cap | Console billing settings | https://platform.claude.com/settings/billing |

## 5. CI and deploy

| Item | Link |
|---|---|
| Actions free on public repos | https://docs.github.com/en/billing/concepts/product-billing/github-actions |
| Actions secrets / `gh secret set` | https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets |
| `cloudflare/pages-action` deprecated → `cloudflare/wrangler-action` | https://github.com/cloudflare/wrangler-action |
| Pages secrets: `wrangler pages secret put` | https://developers.cloudflare.com/pages/functions/bindings/#secrets |
| Pages `_headers` file | https://developers.cloudflare.com/pages/configuration/headers/ |
