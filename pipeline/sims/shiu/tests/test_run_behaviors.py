import json
from pathlib import Path

import pytest

import run_behaviors as rb

HERE = Path(__file__).parent
TSV = HERE / "data" / "annotations.tsv"
ROOT = Path(rb.__file__).parent


def test_resolve_ids_from_cell_types():
    spec = {"cell_types": ["P9", "LC4"]}
    assert rb.resolve_ids(spec, TSV, "root_id", "cell_type") == [
        720575940600000001,
        720575940600000002,
        720575940600000003,
    ]


def test_resolve_ids_passes_root_ids_through():
    assert rb.resolve_ids({"root_ids": [5, 6]}, TSV, "root_id", "cell_type") == [5, 6]


def test_resolve_ids_unknown_type_lists_it():
    with pytest.raises(ValueError, match="NOPE.*ZED|ZED.*NOPE"):
        rb.resolve_ids(
            {"cell_types": ["P9", "NOPE", "ZED"]}, TSV, "root_id", "cell_type"
        )


def test_run_calls_run_exp(tmp_path):
    calls = []
    rb.run(
        "walking",
        [1, 2],
        tmp_path / "vendor",
        tmp_path / "out",
        run_exp=lambda **kw: calls.append(kw),
    )
    (kw,) = calls
    assert kw["exp_name"] == "walking"
    assert kw["neu_exc"] == [1, 2]
    assert kw["params"]["t_run"] == 4000
    assert kw["params"]["n_run"] == 5
    assert kw["params"]["r_poi"] == 150
    assert Path(kw["path_res"]) == tmp_path / "out"
    assert (tmp_path / "out").is_dir()
    assert Path(kw["path_comp"]) == tmp_path / "vendor" / "Completeness_783.csv"
    assert Path(kw["path_con"]) == tmp_path / "vendor" / "Connectivity_783.parquet"


def test_run_rejects_unknown_behavior(tmp_path):
    with pytest.raises(ValueError, match="flying"):
        rb.run("flying", [1], tmp_path, tmp_path, run_exp=lambda **kw: None)


def test_stimuli_json():
    data = json.loads((ROOT / "stimuli.json").read_text())
    assert set(data) == {"walking", "grooming", "feeding", "escape"}
    assert data["walking"]["assumption"] is True
    assert data["escape"]["assumption"] is True
    assert data["feeding"]["assumption"] is False
    assert data["grooming"]["assumption"] is False
    for spec in data.values():
        assert (spec["r_poi_hz"], spec["t_run_ms"], spec["n_run"]) == (150, 4000, 5)
        assert spec["source"].startswith("http")
        assert ("cell_types" in spec) != ("root_ids" in spec)


def test_path_constants():
    assert rb.VENDOR_DIR == ROOT / "vendor"
    assert rb.ANNOTATIONS == ROOT / "../../data/raw/brain/annotations.tsv"
    assert rb.OUT_DIR == ROOT / "../../data/raw/spikes"


def test_main_runs_selected_behaviors(tmp_path, monkeypatch):
    seen = []
    monkeypatch.setattr(
        rb, "run", lambda b, ids, v, o, n_proc=4, **k: seen.append((b, ids, n_proc))
    )
    rb.main(
        [
            "--behaviors",
            "walking",
            "--n-proc",
            "2",
            "--annotations",
            str(TSV),
            "--out",
            str(tmp_path),
        ]
    )
    assert seen == [("walking", [720575940600000001, 720575940600000002], 2)]


def test_main_defaults_to_all_behaviors(tmp_path, monkeypatch):
    seen = []
    monkeypatch.setattr(rb, "run", lambda b, ids, v, o, n_proc=4, **k: seen.append(b))
    monkeypatch.setattr(rb, "resolve_ids", lambda *a, **k: [1])
    rb.main(["--out", str(tmp_path)])
    assert sorted(seen) == ["escape", "feeding", "grooming", "walking"]
