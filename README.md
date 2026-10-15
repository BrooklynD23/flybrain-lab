# FlyBrain Lab

A web app for exploring the fruit fly (*Drosophila*) brain in 3D next to an animated 3D fly. Pick a behavior (walking, grooming, feeding, escape). The fly body plays that behavior, and simulated brain activity plays on the same timeline.

- Demo: `https://flybrain-lab.pages.dev` (placeholder until [HUMAN-02](docs/HUMAN-02-cloudflare-pages.md) is done)
- Licence: non-commercial demo. FlyWire data is CC BY-NC 4.0. See [RESEARCH-03](docs/RESEARCH-03-licences-citations.md).
- Brain activity comes from a simulated model with assumed neurotransmitter signs. It is not a recording.

## Run locally

Needs Node 24 and [uv](https://docs.astral.sh/uv/). No API keys needed.

```bash
npm ci
uv sync --project pipeline
npm run dev          # http://localhost:5173 (uses committed fixture or real assets)
npm test && uv run --directory pipeline pytest
```

## Docs

| Start here | Then |
|---|---|
| [PLAN-00 overview](docs/PLAN-00-overview.md) | [PLAN-01 architecture](docs/PLAN-01-architecture.md), [PLAN-02 waves](docs/PLAN-02-waves.md) |
| [STATUS](docs/STATUS.md) | `docs/WAVE-*.md` (build), `docs/HUMAN-*.md` (your setup steps) |
| Research | [RESEARCH-01](docs/RESEARCH-01-fly-projects.md), [RESEARCH-02](docs/RESEARCH-02-stack-hosting.md), [RESEARCH-03](docs/RESEARCH-03-licences-citations.md) |

Agent instructions: [AGENT.md](AGENT.md).
