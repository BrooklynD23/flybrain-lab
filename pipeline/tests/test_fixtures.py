"""Tests for the synthetic fixture assets (`flybrain_pipeline.fixtures`).

Fixtures are tiny, deterministic stand-ins for the real FlyWire/flybody
assets: they let the web app run with no real data. The manifest must
validate against ``schemas/manifest.schema.json`` and every asset URL it
lists must exist in the output directory.
"""

import json
from pathlib import Path

import numpy as np
import pytest

from flybrain_pipeline import fixtures
from flybrain_pipeline.glb import read_glb_json
from flybrain_pipeline.validate import validate_file

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_DIR = REPO_ROOT / "schemas"

NEUROPIL_IDS = ["AL_L", "AL_R", "AMMC_L", "GNG", "PRW", "LO_R"]
BEHAVIORS = ["walking", "grooming", "feeding", "escape"]
CLIP_SOURCE = {
    "walking": "reference-replay",
    "escape": "reference-replay",
    "grooming": "keyframed",
    "feeding": "keyframed",
}
DURATION_MS = 4000
BIN_MS = 50
N_BINS = DURATION_MS // BIN_MS  # 80
N_CHANNELS = 11  # 6 neuropils + 5 neurons
FPS = 30
N_FRAMES = int(DURATION_MS * FPS / 1000) + 1  # 121


@pytest.fixture()
def built(tmp_path: Path) -> Path:
    out = tmp_path / "fixtures"
    fixtures.build_fixtures(out)
    return out


def _manifest(out: Path) -> dict:
    return json.loads((out / "manifest.json").read_text(encoding="utf-8"))


def _behavior(manifest: dict, behavior_id: str) -> dict:
    return next(b for b in manifest["behaviors"] if b["id"] == behavior_id)


def _asset_files(out: Path) -> dict[str, bytes]:
    return {str(p.relative_to(out)): p.read_bytes() for p in sorted(out.rglob("*")) if p.is_file()}


def test_manifest_validates_against_schema(built: Path) -> None:
    errors = validate_file(built / "manifest.json", "manifest", SCHEMA_DIR)
    assert errors == []


def test_manifest_datasource_and_narration_urls(built: Path) -> None:
    manifest = _manifest(built)
    assert manifest["dataSource"] == "fixture"
    assert {b["id"] for b in manifest["behaviors"]} == set(BEHAVIORS)
    for behavior in manifest["behaviors"]:
        assert behavior["narrationUrl"] == f"/narration/{behavior['id']}.json"


def test_every_manifest_asset_url_exists(built: Path) -> None:
    manifest = _manifest(built)
    urls = [
        manifest["brain"]["neuropils"]["url"],
        manifest["brain"]["neurons"]["url"],
        manifest["body"]["url"],
    ]
    urls += [b["activity"]["url"] for b in manifest["behaviors"]]
    # narrationUrl is served from public/narration (T03.4), not this dir.
    for url in urls:
        assert (built / url).is_file(), url


def test_clip_source_per_behavior(built: Path) -> None:
    manifest = _manifest(built)
    for behavior_id, expected in CLIP_SOURCE.items():
        assert _behavior(manifest, behavior_id)["clipSource"] == expected


def test_stimulus_assumption_true_only_walking_and_escape(built: Path) -> None:
    manifest = _manifest(built)
    assumed = {b["id"] for b in manifest["behaviors"] if b["stimulus"]["assumption"]}
    assert assumed == {"walking", "escape"}
    for behavior in manifest["behaviors"]:
        stimulus = behavior["stimulus"]
        assert stimulus["description"]
        assert stimulus["cellTypes"]
        assert stimulus["source"]


def test_brain_neuropil_ids_match_manifest(built: Path) -> None:
    manifest = _manifest(built)
    assert manifest["brain"]["neuropils"]["ids"] == NEUROPIL_IDS
    assert manifest["brain"]["neuropils"]["kind"] == "mesh"


def test_brain_glb_neuropil_nodes_under_2k_triangles(built: Path) -> None:
    doc = read_glb_json(built / "brain.glb")
    mesh_nodes = [n["name"] for n in doc["nodes"] if "mesh" in n]
    assert sorted(mesh_nodes) == sorted(NEUROPIL_IDS)
    triangles = (
        sum(
            doc["accessors"][primitive["indices"]]["count"]
            for mesh in doc["meshes"]
            for primitive in mesh["primitives"]
        )
        // 3
    )
    assert 0 < triangles < 2000


def test_neurons_glb_five_polylines_named_by_fake_root_ids(built: Path) -> None:
    manifest = _manifest(built)
    items = manifest["brain"]["neurons"]["items"]
    assert len(items) == 5
    for item in items:
        assert item["id"].isdigit() and len(item["id"]) == 18
        assert item["neuropil"] in NEUROPIL_IDS

    doc = read_glb_json(built / "neurons.glb")
    mesh_nodes = [n["name"] for n in doc["nodes"] if "mesh" in n]
    assert sorted(mesh_nodes) == sorted(item["id"] for item in items)
    modes = {primitive["mode"] for mesh in doc["meshes"] for primitive in mesh["primitives"]}
    assert modes == {1}  # line segments


def test_fly_glb_bodies_and_behavior_clips(built: Path) -> None:
    doc = read_glb_json(built / "fly.glb")
    mesh_nodes = [n["name"] for n in doc["nodes"] if "mesh" in n]
    for body in ("thorax", "head", "wing_left", "wing_right"):
        assert body in mesh_nodes

    animations = {a["name"]: a for a in doc["animations"]}
    assert set(animations) == set(BEHAVIORS)
    for animation in animations.values():
        input_acc = doc["accessors"][animation["samplers"][0]["input"]]
        assert input_acc["count"] == N_FRAMES
        assert abs(input_acc["max"][0] - DURATION_MS / 1000.0) < 1e-4
        # every clip drives every body node (translation + rotation channels)
        targets = {doc["nodes"][c["target"]["node"]]["name"] for c in animation["channels"]}
        assert {"thorax", "head", "wing_left", "wing_right"} <= targets


def test_activity_byte_length_and_binning(built: Path) -> None:
    manifest = _manifest(built)
    for behavior in manifest["behaviors"]:
        info = behavior["activity"]
        data = (built / info["url"]).read_bytes()
        assert info["nBins"] == N_BINS
        assert len(info["channels"]) == N_CHANNELS
        assert len(data) == info["nBins"] * len(info["channels"])
        assert info["nBins"] * info["binMs"] == behavior["durationMs"]
        assert len(info["maxHz"]) == len(info["channels"])
        # channels are neuropil ids first, then neuron root ids
        assert info["channels"][: len(NEUROPIL_IDS)] == NEUROPIL_IDS


def test_each_behavior_peaks_in_a_different_neuropil(built: Path) -> None:
    manifest = _manifest(built)
    peaks: dict[str, str] = {}
    for behavior in manifest["behaviors"]:
        info = behavior["activity"]
        raw = np.frombuffer((built / info["url"]).read_bytes(), dtype=np.uint8)
        rates = raw.reshape(info["nBins"], len(info["channels"])).astype(np.float64)
        rates *= np.asarray(info["maxHz"]) / 255.0
        peak_channel = info["channels"][int(rates.mean(axis=0).argmax())]
        assert peak_channel in NEUROPIL_IDS
        peaks[behavior["id"]] = peak_channel
    assert len(set(peaks.values())) == len(BEHAVIORS)


def test_output_is_byte_identical_across_runs(tmp_path: Path) -> None:
    out_a, out_b = tmp_path / "a", tmp_path / "b"
    fixtures.build_fixtures(out_a)
    fixtures.build_fixtures(out_b)
    files_a, files_b = _asset_files(out_a), _asset_files(out_b)
    assert files_a.keys() == files_b.keys()
    for name in files_a:
        assert files_a[name] == files_b[name], name


def test_total_size_under_200_kb(built: Path) -> None:
    total = sum(len(data) for data in _asset_files(built).values())
    assert total < 200 * 1024


def test_main_cli_writes_fixtures(tmp_path: Path) -> None:
    out = tmp_path / "fx"
    assert fixtures.main(["--out", str(out)]) == 0
    assert (out / "manifest.json").is_file()
    assert (out / "brain.glb").is_file()


def test_build_raises_when_manifest_fails_validation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(fixtures.validate, "validate_file", lambda *a, **k: ["$.version: bad"])
    with pytest.raises(ValueError, match="manifest"):
        fixtures.build_fixtures(tmp_path / "fx")
