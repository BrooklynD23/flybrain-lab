# HUMAN-06 — Record the demo video (fallback for live demos)

| Item | Value |
|---|---|
| Needed before | Presentation day (after HUMAN-02; ideally after HUMAN-05) |
| Time | 3 h (2 takes + edit) |
| Cost | $0 with OBS Studio |
| Env vars | none |

## Steps

1. Install OBS Studio: https://obsproject.com/download
2. Open the hosted URL in a clean Chrome profile, 1920×1080, zoom 100%. Close other tabs.
3. Rehearse the 3-minute script in [PLAN-00 §4](PLAN-00-overview.md#4-three-minute-audience-demo-script) twice.
4. Record display + microphone, 1080p30, MP4 ([OBS quick start](https://obsproject.com/kb/quick-start-guide)).
5. Make sure the "simulated model, assumed signs" line and the attribution panel are visible on screen.
6. Trim start and end; keep it ≤ 3:00. Add captions (YouTube auto-captions or hand-written SRT).
7. Upload as unlisted (YouTube or team drive). Do not commit the video to git (size).
8. Add the link to `README.md` under "Demo".

## Verification

```bash
grep -iE "video|youtu" README.md
```
Prints the video link line.
