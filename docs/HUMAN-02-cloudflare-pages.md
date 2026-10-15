# HUMAN-02 — Cloudflare account, Pages project, deploy secrets

| Item | Value |
|---|---|
| Needed before | Hosted demo URL (after WAVE-08 and HUMAN-01). Not a wave prerequisite: `deploy.yml` skips with a notice without the secrets |
| Time | 30 min |
| Cost | $0 on Pages Free: 500 builds/month, 20,000 files, 25 MiB per file ([limits](https://developers.cloudflare.com/pages/platform/limits/)); Functions count against Workers Free 100,000 requests/day ([pricing](https://developers.cloudflare.com/workers/platform/pricing)) |
| GitHub secrets | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |
| GitHub variable (optional) | `VITE_NARRATION_MODE` = `replay` (default) or `live` |

## Steps

1. Sign up: https://dash.cloudflare.com/sign-up
2. Copy your Account ID (dashboard sidebar or Workers & Pages overview).
3. Create the Pages project once from your machine (direct upload, no Git integration; GitHub Actions deploys):
   ```bash
   npx wrangler login
   npm run build
   npx wrangler pages project create flybrain-lab --production-branch main
   npx wrangler pages deploy dist --project-name flybrain-lab --branch main
   ```
   Guide: https://developers.cloudflare.com/pages/get-started/direct-upload/
4. Create an API token at https://dash.cloudflare.com/profile/api-tokens with permission **Account → Cloudflare Pages → Edit** for your account only.
5. Add the GitHub secrets ([how](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)):
   ```bash
   gh secret set CLOUDFLARE_API_TOKEN      # paste token
   gh secret set CLOUDFLARE_ACCOUNT_ID     # paste account id
   ```
6. Push to `main` (or run the `Deploy` workflow manually). The deploy uses [`cloudflare/wrangler-action`](https://github.com/cloudflare/wrangler-action).
7. Put the URL (`https://flybrain-lab.pages.dev`) in `README.md`.

## Verification

```bash
curl -sf https://flybrain-lab.pages.dev/ -o /dev/null && curl -sf https://flybrain-lab.pages.dev/fixtures/manifest.json | head -c 80 && curl -sI https://flybrain-lab.pages.dev/ | grep -i content-security-policy
```
All three succeed. After HUMAN-05 also check that `/data/manifest.json` is served as `application/json`.
