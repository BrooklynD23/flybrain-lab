"""Tests for `flybrain build` and `flybrain fetch-brain`."""

import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from flybrain_pipeline import build, glb, validate

RAW = Path(__file__).parent / "data" / "raw"
SCHEMAS = Path(__file__).parents[2] / "schemas"
BEHAVIORS = ("walking", "grooming", "feeding", "escape")
CONFIG = build.BuildConfig()


@pytest.fixture(scope="module")
def built(tmp_path_factory: pytest.TempPathFactory) -> Path:
    out = tmp_path_factory.mktemp("out") / "data"
    build.build(RAW, out, CONFIG, compress=False)
    return out


def _manifest(out: Path) -> dict:
    return json.loads((out / "manifest.json").read_text())


def test_manifest_validates(built: Path) -> None:
    assert validate.validate_file(built / "manifest.json", "manifest", SCHEMAS) == []
    assert _manifest(built)["dataSource"] == "flywire-783"


def test_all_urls_exist(built: Path) -> None:
    m = _manifest(built)
    urls = [m["body"]["url"], m["brain"]["neuropils"]["url"], m["brain"]["neurons"]["url"]]
    urls += [b["activity"]["url"] for b in m["behaviors"]]
    assert all((built / u).is_file() for u in urls)
    assert [b["narrationUrl"] for b in m["behaviors"]] == [
        f"/narration/{b}.json" for b in BEHAVIORS
    ]


def test_activity_sizes(built: Path) -> None:
    for b in _manifest(built)["behaviors"]:
        a = b["activity"]
        assert a["nBins"] == b["durationMs"] // 50
        assert (built / a["url"]).stat().st_size == a["nBins"] * len(a["channels"])
        assert len(a["maxHz"]) == len(a["channels"])


def test_animations_named_by_behavior(built: Path) -> None:
    gltf = glb.read_glb_json(built / "fly.glb")
    assert [a["name"] for a in gltf["animations"]] == list(BEHAVIORS)


def test_stimulus_and_clip_source(built: Path) -> None:
    by_id = {b["id"]: b for b in _manifest(built)["behaviors"]}
    assert by_id["walking"]["stimulus"]["assumption"] is True
    assert by_id["grooming"]["stimulus"]["assumption"] is False
    assert by_id["walking"]["clipSource"] == "reference-replay"
    assert by_id["feeding"]["clipSource"] == "keyframed"


def test_fixture_raw_sets_data_source(tmp_path: Path) -> None:
    out = build.build(RAW, tmp_path / "o", build.BuildConfig(fixture_raw=True), compress=False)
    assert _manifest(out)["dataSource"] == "fixture"


def test_points_mode(tmp_path: Path) -> None:
    raw = tmp_path / "raw"
    shutil.copytree(RAW, raw)
    (raw / "brain" / "neuropils.npz").unlink()
    rng = np.random.default_rng(0)
    syn = pd.DataFrame(
        {
            "neuropil": np.repeat(["AL_L", "GNG", "LO_R"], 10),
            "x": rng.uniform(0, 1e5, 30),
            "y": rng.uniform(0, 1e5, 30),
            "z": rng.uniform(0, 1e5, 30),
        }
    )
    syn.to_feather(raw / "brain" / "flywire_synapses_783.feather")
    out = build.build(raw, tmp_path / "o", build.BuildConfig(points=True), compress=False)
    assert _manifest(out)["brain"]["neuropils"]["kind"] == "points"


def test_no_neuron_lines_keeps_channels(tmp_path: Path) -> None:
    raw = tmp_path / "raw"
    shutil.copytree(RAW, raw)
    (raw / "brain" / "skeletons.npz").unlink()
    out = build.build(raw, tmp_path / "o", build.BuildConfig(neuron_lines=False), compress=False)
    m = _manifest(out)
    assert len(m["brain"]["neurons"]["items"]) == 5
    assert len(m["behaviors"][0]["activity"]["channels"]) == 3 + 5
    assert glb.read_glb_json(out / "neurons.glb").get("meshes", []) == []


def test_missing_skeleton_is_an_error(tmp_path: Path) -> None:
    raw = tmp_path / "raw"
    shutil.copytree(RAW, raw)
    (raw / "brain" / "selected_neurons.json").write_text(
        '["720575940621000001", "720575940621000009"]'
    )
    with pytest.raises(build.BuildError, match="720575940621000009"):
        build.build(raw, tmp_path / "o", CONFIG, compress=False)


def test_failed_validation_leaves_out_dir_untouched(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    out = tmp_path / "data"
    out.mkdir()
    (out / "keep.txt").write_text("old")
    monkeypatch.setattr(validate, "validate_file", lambda *a, **k: ["$: bad"])
    with pytest.raises(build.BuildError, match="bad"):
        build.build(RAW, out, CONFIG, compress=False)
    assert (out / "keep.txt").read_text() == "old"
    assert [p.name for p in tmp_path.iterdir()] == ["data"]


def test_budget_violation_fails(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(build.budget, "check", lambda d: ["too big"])
    with pytest.raises(build.BuildError, match="too big"):
        build.build(RAW, tmp_path / "o", CONFIG, compress=False)
    assert not (tmp_path / "o").exists()


def test_second_build_replaces_first(tmp_path: Path) -> None:
    out = tmp_path / "data"
    build.build(RAW, out, CONFIG, compress=False)
    (out / "stale.txt").write_text("x")
    build.build(RAW, out, CONFIG, compress=False)
    assert (out / "manifest.json").is_file()
    assert not (out / "stale.txt").exists()
    assert sorted(p.name for p in tmp_path.iterdir()) == ["data"]


def test_selected_neurons_json_is_used_and_fallback_matches(tmp_path: Path) -> None:
    raw = tmp_path / "raw"
    shutil.copytree(RAW, raw)
    ids = ["720575940621000001", "720575940621000003"]
    (raw / "brain" / "selected_neurons.json").write_text(json.dumps(ids))
    out = build.build(raw, tmp_path / "a", CONFIG, compress=False)
    assert [i["id"] for i in _manifest(out)["brain"]["neurons"]["items"]] == ids

    (raw / "brain" / "selected_neurons.json").unlink()
    fallback = build.build(raw, tmp_path / "b", CONFIG, compress=False)
    fb_ids = [i["id"] for i in _manifest(fallback)["brain"]["neurons"]["items"]]
    assert set(ids) <= set(fb_ids)

    assert build.fetch_brain_main(["--raw", str(raw), "--skip-neuropils", "--skip-skeletons"]) == 0
    saved = json.loads((raw / "brain" / "selected_neurons.json").read_text())
    again = build.build(raw, tmp_path / "c", CONFIG, compress=False)
    assert [i["id"] for i in _manifest(again)["brain"]["neurons"]["items"]] == saved == fb_ids


def test_fetch_brain_selection_only_never_imports_fafbseg(tmp_path: Path) -> None:
    raw = tmp_path / "raw"
    shutil.copytree(RAW, raw)
    for name in ("neuropils.npz", "skeletons.npz"):
        (raw / "brain" / name).unlink()
    assert build.fetch_brain_main(["--raw", str(raw), "--skip-neuropils", "--skip-skeletons"]) == 0
    assert "fafbseg" not in sys.modules
    assert sorted(
        p.name for p in (raw / "brain").iterdir() if p.name.endswith((".json", ".npz"))
    ) == ["selected_neurons.json"]
    saved = json.loads((raw / "brain" / "selected_neurons.json").read_text())
    assert saved == sorted(saved) and len(saved) == 5 and all(isinstance(i, str) for i in saved)


def test_fetch_brain_fetches_meshes_and_skeletons(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    raw = tmp_path / "raw"
    shutil.copytree(RAW, raw)
    calls: dict[str, list] = {}
    monkeypatch.setattr(
        build.brain_neuropils,
        "fetch_neuropil_meshes",
        lambda ids, out: calls.setdefault("meshes", [ids, out]),
    )
    monkeypatch.setattr(
        build.brain_neurons,
        "fetch_skeletons",
        lambda ids, out: calls.setdefault("skeletons", [ids, out]),
    )
    assert build.fetch_brain_main(["--raw", str(raw), "--cap", "5"]) == 0
    assert calls["meshes"][0] == ["AL_L", "GNG", "LO_R"]
    assert calls["meshes"][1] == raw / "brain" / "neuropils.npz"
    assert len(calls["skeletons"][0]) == 5
    assert calls["skeletons"][1] == raw / "brain" / "skeletons.npz"


def test_build_main_ok_and_error(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    out = tmp_path / "o"
    args = ["--raw", str(RAW), "--out", str(out), "--fixture-raw", "--no-compress"]
    assert build.main(args) == 0
    assert (out / "manifest.json").is_file()
    assert build.main(["--raw", str(tmp_path / "nope"), "--out", str(tmp_path / "x")]) == 1
    assert "nope" in capsys.readouterr().err


def _gltf_transform_ready() -> bool:
    npx = shutil.which("npx")
    if npx is None:
        return False
    try:
        r = subprocess.run(
            [npx, "--no-install", "gltf-transform", "--version"],
            cwd=build.REPO_ROOT,
            capture_output=True,
            timeout=180,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return False
    return r.returncode == 0


@pytest.mark.skipif(not _gltf_transform_ready(), reason="gltf-transform not installed")
def test_compress_runs_gltf_transform(tmp_path: Path) -> None:
    out = build.build(RAW, tmp_path / "o", CONFIG, compress=True)
    used = glb.read_glb_json(out / "fly.glb").get("extensionsUsed", [])
    assert "EXT_meshopt_compression" in used


def test_compress_failure_is_reported(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(cmd, **kw):
        raise subprocess.CalledProcessError(1, cmd, stderr=b"nope")

    monkeypatch.setattr(build.subprocess, "run", boom)
    with pytest.raises(build.BuildError, match="gltf-transform"):
        build.build(RAW, tmp_path / "o", CONFIG, compress=True)
    assert not (tmp_path / "o").exists()
