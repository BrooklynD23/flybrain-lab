# PLAN-00 — Overview

## 1. Problem

The adult fly brain connectome (FlyWire, about 139k neurons) and whole-body fly physics models (flybody, NeuroMechFly) are public. Each needs a Python setup and domain knowledge to explore. Nobody outside the field can see "what the brain does while the fly walks" in one place. FlyBrain Lab puts both in one browser tab: brain on the left, body on the right, one timeline.

## 2. Users

| User | Need | What they do |
|---|---|---|
| Audience at a demo or class (primary) | Understand that a fly brain is a mapped circuit that drives behavior | Watch a 3-minute guided demo, then click around on a phone or laptop |
| Student or teacher | A free, link-shareable visual | Pick a behavior, scrub the timeline, read labels |
| Presenter (our team) | A demo that never fails | Opens the URL; no keys, no server, no install |

## 3. MVP scope

| In | Out (stretch or never) |
|---|---|
| 3D brain: FlyWire neuropil meshes (or point-cloud fallback), about 400 curated neurons as line skeletons | Full 139k-neuron rendering, synapse-level view |
| 3D fly body from flybody `fruitfly.xml`, 4 clips: walking, grooming, feeding, escape | Running MuJoCo in the browser (MuJoCo WASM is WIP); live physics |
| Activity overlay: Shiu LIF model run offline per behavior, 50 ms bins, per neuropil and per curated neuron | Live brain simulation; user-chosen perturbations |
| One shared timeline: play, pause, scrub, loop; behavior picker | Multi-behavior sequencing |
| Narration: replay cues from committed JSON (default); optional live Q&A via `/api/narrate` (Anthropic) | Chatbot with memory, accounts, saved sessions |
| Labels: "simulated model, assumed signs", "keyframed", "reference replay"; attribution panel | Claims about real fly neural recordings |
| Low-quality toggle, mobile layout, `?debug=1` fps counter | Native app |
| Stretch only: LLM proposes perturbation experiments (earlier E3/A05 scope) | — |

## 4. Three-minute audience demo script

| Time | Presenter does | Audience sees |
|---|---|---|
| 0:00–0:20 | Open the URL. "This is a map of every neuron region in a fruit fly brain, next to a physics model of the fly's body." | Brain and fly side by side, idle rotation |
| 0:20–0:50 | Pick **Feeding**, press play. | Proboscis extends (labelled keyframed). Taste and feeding regions (GNG/SEZ, PRW) light up. Narration cue: sugar sensors drive the feeding motor neuron MN9 in the model |
| 0:50–1:30 | Pick **Grooming**, scrub to 1.5 s. Tap the AMMC region. | Front legs sweep the antennae. Label shows region name and simulated firing rate |
| 1:30–2:10 | Pick **Walking**, then **Escape**. | Walking replays recorded fly kinematics. Escape shows looming-detector visual regions (LO, LOP) activating before the flight clip |
| 2:10–2:40 | Type "Why does the GNG light up during feeding?" in Ask. | Replay answer (or live Claude answer if live mode is on) |
| 2:40–3:00 | Open the attribution panel. "Simulated model, assumed signs. Data: FlyWire, CC BY-NC." | Licences and citations |

Fallback at any step: the same flow runs from the committed fixture assets; a pre-recorded video ([HUMAN-06](HUMAN-06-demo-video.md)) is the last resort.

## 5. Success metrics

| Metric | Target | How measured |
|---|---|---|
| Hosted demo reachable | 200 on `/` and `/data/manifest.json` | `curl -sf` in [HUMAN-02](HUMAN-02-cloudflare-pages.md) verification |
| Keyless demo works | Full demo flow passes with no secrets | Playwright `e2e/demo.spec.ts` in CI |
| First load size | ≤ 15 MB gzipped | `flybrain budget` (WAVE-07) |
| Frame rate | ≥ 30 fps on a mid laptop and a recent phone; low-quality toggle available | `?debug=1` fps overlay, manual check in release review |
| Time to first frame | ≤ 5 s on 50 Mbit/s | Chrome DevTools network throttle, release review |
| Unit coverage | ≥ 80% (vitest and pytest-cov thresholds) | CI |
| Live mode cost | ≤ $1 per 1,000 questions | Anthropic usage page ([HUMAN-03](HUMAN-03-anthropic-key.md)) |

## 6. Hosted-demo strategy

| Decision | Why |
|---|---|
| Static Vite build on Cloudflare Pages Free | No cold start, unlimited static requests, 25 MiB per file and 20,000 files fit our assets ([limits](https://developers.cloudflare.com/pages/platform/limits/)) |
| All heavy work offline (Python pipeline), output committed as static files | The browser only loads glTF and small binaries; nothing to crash at demo time |
| Default narration = replay JSON | Zero keys, zero cost, deterministic |
| Optional live mode = one Pages Function `/api/narrate` | Only needs `ANTHROPIC_API_KEY`; off unless `VITE_NARRATION_MODE=live` |
| App loads `/data/manifest.json` and falls back to `/fixtures/` on any non-OK status, non-JSON content type or parse error (Pages and `vite preview` answer unknown paths with `index.html` + 200); `public/404.html` stops Pages SPA mode | Site works before real data exists; shows a "fixture data" badge |
| No DB, no auth, no R2 | Nothing to store; R2 only if assets ever exceed Pages limits |

## 7. Risks and fallbacks

| Risk | Likelihood | Fallback |
|---|---|---|
| FlyWire mesh redistribution not allowed ([HUMAN-04](HUMAN-04-flywire-licence-email.md)) | Medium | Neuropil point clouds sampled from the CC BY 4.0 Zenodo synapse table; drop neuron skeletons, show soma points |
| `fafbseg` needs a FlyWire token or API differs | Medium | Token in HUMAN-05; point-cloud fallback needs only Zenodo |
| flybody walking-imitation data format differs from assumption | Medium | Keyframed tripod gait from `pipeline/config/keyframes.toml`, labelled keyframed |
| `fruitfly.xml` fails to compile on mujoco 3.16 | Low | Pin mujoco to the version flybody's `setup.py` pins |
| Shiu model too slow (≈ 60 s wall per 1 s simulated on 2 CPUs, [shaduf](https://shaduf.ai/p/digital-fly-catalog/projects/shiu-drosophila-brain-model/)) | Low (offline) | `n_run=5`, `t_run=4000 ms`, about 20 min per behavior on 2 cores; overnight run |
| Walking/escape stimuli are not from the Shiu paper | Certain | Marked as assumptions in UI and manifest; stimulus sets editable in `pipeline/sims/shiu/stimuli.json` |
| Frame rate low on phones | Medium | Low-quality toggle: neuropils only, no neuron lines, dpr 1 |
| Live endpoint abuse | Medium | Rate limit per IP, 2 KB body cap, `max_tokens` 300, Anthropic spend cap, live mode off by default |
| Headless WebGL flaky in CI | Medium | Chromium SwiftShader flags; E2E asserts DOM state plus a non-blank canvas pixel check |

## 8. Hour estimates (team: 4 people × 12 h/week = 48 h/week)

| Work | Hours |
|---|---|
| Code waves WAVE-00 to WAVE-08 (agent runs + human review), detail in [PLAN-02](PLAN-02-waves.md) | 110 |
| Human steps HUMAN-01 to HUMAN-06 | 15 |
| Buffer 20% | 25 |
| **Total** | **150** |

150 h at 48 h/week is about 3.1 weeks. Plan for 4 calendar weeks: weeks 1–2 code waves 00–05 (fixture demo deployable end of week 2), week 3 pipeline waves 06–07 plus HUMAN-05 real-data run, week 4 deploy, E2E, video.
