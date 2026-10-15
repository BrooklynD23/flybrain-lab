# HUMAN-04 — Ask FlyWire about redistributing meshes in a web demo

| Item | Value |
|---|---|
| Needed before | Publishing `public/data/` built from FlyWire neuropil meshes or neuron skeletons (HUMAN-05 step 6). Not a wave prerequisite |
| Time | 10 min to send; reply time unknown |
| Cost | $0 |
| Env vars | none |

## Why

FlyWire data is CC BY-NC 4.0 ([flywire.ai](https://flywire.ai), [terms](https://flywire.ai/tos), [guidelines](https://flywire.ai/guidelines)). The Zenodo connectivity release is CC BY 4.0 ([Zenodo 10676866](https://zenodo.org/records/10676866)). Whether simplified meshes and skeletons may be re-hosted as static files in a non-commercial demo is UNVERIFIED. Details: [RESEARCH-03](RESEARCH-03-licences-citations.md).

## Steps

1. Send this email to `flywire@princeton.edu`:

   > Subject: Permission to show simplified FlyWire meshes in a non-commercial web demo
   >
   > Hello FlyWire team,
   > we are building FlyBrain Lab, a free, non-commercial educational web app (<repo URL>). It shows FlyWire neuropil meshes (decimated to about 150k triangles) and about 400 neuron skeletons from public release v783, next to simulated activity from the Shiu et al. (2024) model. The files would be served as static glTF from Cloudflare Pages. We credit FlyWire (Dorkenwald et al. 2024, Schlegel et al. 2024) and state CC BY-NC 4.0 in an in-app attribution panel.
   > 1. Is re-hosting these simplified meshes and skeletons allowed under your terms?
   > 2. Is there a preferred citation or acknowledgment text?
   > 3. Are the neuropil meshes from `fafbseg` covered by the same terms?
   > Thank you, <names>

2. Save the reply as `docs/evidence/flywire-reply.txt` (create the folder).
3. Decide:

| Reply | Action |
|---|---|
| Allowed | Build with `fetch-brain` mesh mode (HUMAN-05) |
| Not allowed or no reply by demo week | Build neuropils as point clouds from the CC BY Zenodo synapse table and drop neuron skeletons: `flybrain fetch --with-synapses`, then `flybrain fetch-brain --skip-neuropils --skip-skeletons` (no token), then `flybrain build --points --no-neuron-lines` (HUMAN-05 steps 2, 5, 6); this is the fallback in [PLAN-00 §7](PLAN-00-overview.md#7-risks-and-fallbacks) |

## Verification

```bash
test -s docs/evidence/flywire-reply.txt && echo "reply on file"
```
