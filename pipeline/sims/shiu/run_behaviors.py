"""Run the Shiu et al. LIF brain model for each FlyBrain Lab behavior (py3.10 env)."""

import argparse
import csv
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
VENDOR_DIR = HERE / "vendor"
ANNOTATIONS = HERE / "../../data/raw/brain/annotations.tsv"
OUT_DIR = HERE / "../../data/raw/spikes"
STIMULI = HERE / "stimuli.json"


def _stimuli():
    return json.loads(STIMULI.read_text())


def resolve_ids(spec, annotations_tsv, id_col, type_col):
    """Root ids for a stimulus spec; unknown cell types raise ValueError listing them."""
    if "root_ids" in spec:
        return [int(i) for i in spec["root_ids"]]
    with open(annotations_tsv, newline="") as f:
        rows = list(csv.DictReader(f, delimiter="\t"))
    wanted = spec["cell_types"]
    missing = [t for t in wanted if not any(r[type_col] == t for r in rows)]
    if missing:
        raise ValueError(f"unknown cell types: {', '.join(missing)}")
    return [int(r[id_col]) for r in rows if r[type_col] in wanted]


def _load_model(vendor_dir):
    from brian2 import Hz, ms

    sys.path.insert(0, str(vendor_dir))
    import model

    return model.run_exp, dict(model.default_params), ms, Hz


def run(behavior, ids, vendor_dir, out_dir, run_exp=None, n_proc=4):
    """Simulate one behavior; writes <out_dir>/<behavior>.parquet via Shiu run_exp."""
    stimuli = _stimuli()
    if behavior not in stimuli:
        raise ValueError(f"unknown behavior: {behavior}")
    spec = stimuli[behavior]
    vendor_dir, out_dir = Path(vendor_dir), Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    if run_exp is None:
        run_exp, params, ms, hz = _load_model(vendor_dir)
    else:  # injected fake (tests): plain numbers, no Brian2 units
        params, ms, hz = {}, 1, 1
    params.update(
        t_run=spec["t_run_ms"] * ms, n_run=spec["n_run"], r_poi=spec["r_poi_hz"] * hz
    )
    run_exp(
        exp_name=behavior,
        neu_exc=list(ids),
        path_res=out_dir,
        path_comp=vendor_dir / "Completeness_783.csv",
        path_con=vendor_dir / "Connectivity_783.parquet",
        params=params,
        n_proc=n_proc,
        force_overwrite=True,
    )


def main(argv=None):
    stimuli = _stimuli()
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--behaviors", nargs="+", choices=sorted(stimuli), default=sorted(stimuli)
    )
    p.add_argument("--n-proc", type=int, default=4)
    p.add_argument("--out", type=Path, default=OUT_DIR)
    p.add_argument("--annotations", type=Path, default=ANNOTATIONS)
    p.add_argument("--vendor", type=Path, default=VENDOR_DIR)
    a = p.parse_args(argv)
    for b in a.behaviors:
        ids = resolve_ids(stimuli[b], a.annotations, "root_id", "cell_type")
        run(b, ids, a.vendor, a.out, n_proc=a.n_proc)


if __name__ == "__main__":
    main()
