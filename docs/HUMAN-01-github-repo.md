# HUMAN-01 — GitHub repo and Actions

| Item | Value |
|---|---|
| Needed before | First push and CI run (after any wave; not a wave prerequisite — gates run locally without it) |
| Time | 15 min |
| Cost | $0 (public repo: standard runners free, [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)) |
| Env vars / secrets | none here (Cloudflare secrets in [HUMAN-02](HUMAN-02-cloudflare-pages.md)) |

## Steps

1. Install GitHub CLI: https://cli.github.com and run `gh auth login`.
2. From the project root (WAVE-00 already ran `git init`):
   ```bash
   gh repo create flybrain-lab --public --source . --remote origin
   git push -u origin main
   ```
   Public is recommended: free Actions minutes and the licence is non-commercial anyway.
3. Open `https://github.com/<OWNER>/flybrain-lab/actions` and confirm the `CI` workflow ran.
4. Settings → Branches → add a rule for `main`: require the `web`, `pipeline` and `e2e` checks ([branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)).

## Verification

```bash
gh repo view --json name,visibility -q '.name+" "+.visibility' && gh run list --workflow ci.yml --limit 1
```
Expect `flybrain-lab PUBLIC` and one run listed.
