# HUMAN-05 — Run the real-data pipeline and commit `public/data/`

| Item | Value |
|---|---|
| Needed before | Showing real data in the hosted demo (after WAVE-07). Not a wave prerequisite: the app uses `public/fixtures/` until this is done |
| Machine | Linux or macOS, ≥ 16 GB RAM, ≥ 8 CPU cores, ≥ 20 GB free disk (≥ 35 GB with `--with-synapses`), C++ compiler for Brian2 code generation ([Brian2 install](https://brian2.readthedocs.io/en/stable/introduction/install.html)) |
| Time | ≈ 2 h hands-on + ≈ 1–2 h unattended simulation (Shiu ≈ 60 s wall per simulated second on 2 CPUs, [shaduf](https://shaduf.ai/p/digital-fly-catalog/projects/shiu-drosophila-brain-model/); 4 behaviors × 4 s × 5 trials) |
| Cost | $0 (own machine). Fallback: a free Colab VM (≈ 12 GB RAM) for the Shiu step only |
| Credentials | FlyWire account + API token for `fetch-brain` (mesh mode). Token stored by `fafbseg` in `~/.cloudvolume/secrets/global.daf-apis.com-cave-secret.json`; no env var |
| Depends on | [HUMAN-04](HUMAN-04-flywire-licence-email.md) answer decides mesh mode vs point-cloud mode |

## Steps

1. Get a FlyWire account at https://flywire.ai and accept the terms. Get a token at https://global.daf-apis.com/auth/api/v1/user/token (if it shows `[]`, use https://global.daf-apis.com/auth/api/v1/create_token). Set it ([fafbseg setup](https://fafbseg-py.readthedocs.io/en/latest/source/tutorials/flywire_setup.html)):
   ```bash
   uv run --project pipeline --extra fetch python -c "from fafbseg import flywire; flywire.set_chunkedgraph_secret('<TOKEN>')"
   ```
2. Download sources (checksums printed on first run; pin them in `pipeline/config/sources.toml` and commit):
   ```bash
   uv run --project pipeline flybrain fetch --raw pipeline/data/raw   # add --with-synapses for point-cloud mode
   ```
3. Check the UNVERIFIED facts against the real files and update parameters if needed: HDF5 dataset keys and fps of the flybody imitation datasets; annotation TSV column names; neuropil-count column names; `fafbseg` function names. List of items: [RESEARCH-01 §Unverified](RESEARCH-01-fly-projects.md#unverified).
4. Run the brain model (separate py3.10 env):
   ```bash
   uv sync --directory pipeline/sims/shiu
   uv run --directory pipeline/sims/shiu python run_behaviors.py --behaviors walking grooming feeding escape --n-proc 4
   # writes pipeline/data/raw/spikes/<behavior>.parquet (raw layout: PLAN-01 §2b); raise --n-proc only with > 16 GB RAM
   ```
5. Fetch brain geometry for the selected neurons (mesh mode) or skip for point-cloud mode:
   ```bash
   uv run --project pipeline --extra fetch flybrain fetch-brain --raw pipeline/data/raw
   # point-cloud fallback (no FlyWire token, no fetch extra):
   # uv run --project pipeline flybrain fetch-brain --raw pipeline/data/raw --skip-neuropils --skip-skeletons
   ```
6. Build, validate and budget-check:
   ```bash
   uv run --project pipeline flybrain build --raw pipeline/data/raw --out public/data   # add --points --no-neuron-lines for fallback
   npm run build
   uv run --project pipeline flybrain budget public/data --dist dist
   npx vitest run src/data/assets && npm run e2e
   ```
7. Look at it: `npm run dev`, play all 4 behaviors, check the fly faces forward, clips loop cleanly, and activity peaks make sense (feeding → GNG/PRW). Fix keyframes in `pipeline/config/keyframes.toml` if needed and rebuild.
8. Commit: `git add public/data pipeline/config && git commit -m "feat: real FlyWire/flybody assets"`.

## Verification

```bash
uv run --project pipeline flybrain validate public/data/manifest.json manifest --schema-dir schemas && uv run --project pipeline flybrain budget public/data && grep -q '"dataSource": "flywire-783"' public/data/manifest.json
```
