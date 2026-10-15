"""Tests for the asset budget checker (`flybrain_pipeline.budget`)."""

import json
import os
import struct
from pathlib import Path

import pytest

from flybrain_pipeline.budget import BUDGET, check, main

_GLTF_LINES = 1
_GLTF_TRIANGLES = 4


def _write_glb(path: Path, gltf: dict) -> Path:
    """Write a minimal glb: 12-byte header plus one JSON chunk."""
    payload = json.dumps(gltf).encode()
    payload += b" " * (-len(payload) % 4)  # pad to 4-byte alignment
    blob = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(payload))
    blob += struct.pack("<II", len(payload), 0x4E4F534A) + payload
    path.write_bytes(blob)
    return path


def _gltf(primitives: list[dict], accessor_counts: list[int]) -> dict:
    return {
        "asset": {"version": "2.0"},
        "accessors": [{"count": n} for n in accessor_counts],
        "meshes": [{"primitives": primitives}],
    }


def _make_assets(root: Path) -> Path:
    """Create a complete, in-budget asset dir under ``root``."""
    asset = root / "assets"
    (asset / "activity").mkdir(parents=True)
    (asset / "narration").mkdir(parents=True)
    (asset / "manifest.json").write_text("{}", encoding="utf-8")
    # 100 triangles via indices accessor (300 indices / 3).
    _write_glb(
        asset / "brain.glb",
        _gltf([{"attributes": {"POSITION": 0}, "indices": 1}], [9, 300]),
    )
    # 200 line segments via indices accessor (400 indices / 2).
    _write_glb(
        asset / "neurons.glb",
        _gltf(
            [{"attributes": {"POSITION": 0}, "indices": 1, "mode": _GLTF_LINES}],
            [10, 400],
        ),
    )
    # 33 triangles, no indices (99 POSITION vertices / 3).
    _write_glb(
        asset / "fly.glb",
        _gltf([{"attributes": {"POSITION": 0}, "mode": _GLTF_TRIANGLES}], [99]),
    )
    (asset / "activity" / "walk.bin").write_bytes(b"\x00" * 1024)
    (asset / "narration" / "walk.json").write_text("{}", encoding="utf-8")
    return asset


def test_budget_matches_plan_01_section_6() -> None:
    assert BUDGET["total_first_load_gzip_bytes"] == 15 * 1024**2
    assert BUDGET["js_bundle_gzip_bytes"] == 600 * 1024
    assert BUDGET["brain_glb_bytes"] == 3 * 1024**2
    assert BUDGET["brain_glb_triangles"] == 150_000
    assert BUDGET["neurons_glb_bytes"] == 5 * 1024**2
    assert BUDGET["neurons_glb_segments"] == 300_000
    assert BUDGET["fly_glb_bytes"] == 3 * 1024**2
    assert BUDGET["fly_glb_triangles"] == 100_000
    assert BUDGET["activity_bin_bytes"] == 1 * 1024**2
    assert BUDGET["narration_json_bytes"] == 20 * 1024
    assert BUDGET["file_bytes"] == 25 * 1024**2
    assert BUDGET["file_count"] == 20_000


def test_check_small_asset_dir_has_no_violations(tmp_path: Path) -> None:
    assert check(_make_assets(tmp_path)) == []


def test_check_oversized_single_file_violation(tmp_path: Path) -> None:
    asset = _make_assets(tmp_path)
    (asset / "big.bin").write_bytes(b"\x00" * (BUDGET["file_bytes"] + 1))
    violations = check(asset)
    assert any("big.bin" in v for v in violations)


def test_check_oversized_narration_json_violation(tmp_path: Path) -> None:
    asset = _make_assets(tmp_path)
    (asset / "narration" / "walk.json").write_bytes(b" " * (BUDGET["narration_json_bytes"] + 1))
    violations = check(asset)
    assert any("walk.json" in v for v in violations)


def test_check_oversized_activity_bin_violation(tmp_path: Path) -> None:
    asset = _make_assets(tmp_path)
    (asset / "activity" / "walk.bin").write_bytes(b"\x00" * (BUDGET["activity_bin_bytes"] + 1))
    violations = check(asset)
    assert any("walk.bin" in v for v in violations)


def test_check_too_many_triangles_violation(tmp_path: Path) -> None:
    asset = _make_assets(tmp_path)
    _write_glb(
        asset / "brain.glb",
        _gltf(
            [{"attributes": {"POSITION": 0}, "indices": 1}],
            [9, 3 * (BUDGET["brain_glb_triangles"] + 1)],
        ),
    )
    violations = check(asset)
    assert any("brain.glb" in v and "triangles" in v for v in violations)


def test_check_too_many_line_segments_violation(tmp_path: Path) -> None:
    asset = _make_assets(tmp_path)
    _write_glb(
        asset / "neurons.glb",
        _gltf(
            [{"attributes": {"POSITION": 0}, "indices": 1, "mode": _GLTF_LINES}],
            [10, 2 * (BUDGET["neurons_glb_segments"] + 1)],
        ),
    )
    violations = check(asset)
    assert any("neurons.glb" in v and "segments" in v for v in violations)


def test_check_file_count_violation(tmp_path: Path) -> None:
    asset = tmp_path / "crowded"
    asset.mkdir()
    for i in range(BUDGET["file_count"] + 1):
        (asset / f"f{i:05d}").touch()
    violations = check(asset)
    assert any("file count" in v for v in violations)


def test_check_malformed_glb_violation(tmp_path: Path) -> None:
    asset = _make_assets(tmp_path)
    (asset / "brain.glb").write_bytes(b"not a glb")
    violations = check(asset)
    assert any("brain.glb" in v for v in violations)


def test_check_dist_js_bundle_violation(tmp_path: Path) -> None:
    asset = _make_assets(tmp_path)
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    # Random bytes stay ~incompressible under gzip, over the 600 KB budget.
    (dist / "assets" / "app.js").write_bytes(os.urandom(BUDGET["js_bundle_gzip_bytes"] + 4096))
    violations = check(asset, dist)
    assert any("js" in v.lower() for v in violations)


def test_main_exit_zero_on_in_budget_dir(tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
    asset = _make_assets(tmp_path)
    assert main([str(asset)]) == 0
    out = capsys.readouterr().out
    assert "file count" in out  # prints the table


def test_main_exit_one_on_violation(tmp_path: Path, capsys: pytest.CaptureFixture) -> None:
    asset = _make_assets(tmp_path)
    (asset / "narration" / "walk.json").write_bytes(b" " * (BUDGET["narration_json_bytes"] + 1))
    assert main([str(asset)]) == 1
    err = capsys.readouterr().err
    assert "walk.json" in err


def test_main_exit_one_on_missing_asset_dir(tmp_path: Path) -> None:
    assert main([str(tmp_path / "absent")]) == 1


def test_main_dist_flag_in_budget(tmp_path: Path) -> None:
    asset = _make_assets(tmp_path)
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "assets" / "app.js").write_bytes(b"const x = 1;")
    (dist / "index.html").write_text("<html></html>", encoding="utf-8")
    assert main([str(asset), "--dist", str(dist)]) == 0
