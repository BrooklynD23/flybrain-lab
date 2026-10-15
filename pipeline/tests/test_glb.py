"""Tests for the minimal glTF 2.0 binary writer (`flybrain_pipeline.glb`)."""

import json
import shutil
import struct
import subprocess
from pathlib import Path

import numpy as np
import pytest

from flybrain_pipeline.glb import (
    Animation,
    Lines,
    Mesh,
    Node,
    read_glb_json,
    write_glb,
)

REPO_ROOT = Path(__file__).resolve().parents[2]


def _triangle() -> Mesh:
    return Mesh(
        name="tri",
        positions=np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0]], dtype=np.float32),
        indices=np.array([[0, 1, 2]], dtype=np.uint32),
    )


def _segment() -> Lines:
    return Lines(
        name="seg",
        positions=np.array([[0, 0, 0], [1, 1, 1]], dtype=np.float32),
        indices=np.array([[0, 1]], dtype=np.uint32),
    )


def _sample_nodes() -> list[Node]:
    mesh_node = Node(name="mesh_node", mesh=_triangle(), translation=(1.0, 2.0, 3.0))
    line_node = Node(name="line_node", mesh=_segment())
    return [mesh_node, line_node]


def _sample_animation() -> Animation:
    return Animation(
        name="move",
        times=np.array([0.0, 1.0], dtype=np.float32),
        tracks={
            "mesh_node": (
                np.array([[0, 0, 0], [1, 0, 0]], dtype=np.float32),
                np.array([[0, 0, 0, 1], [0, 0, 0, 1]], dtype=np.float32),
            )
        },
    )


def _write_sample(path: Path) -> Path:
    write_glb(path, _sample_nodes(), [_sample_animation()], extras={"key": "value"})
    return path


def _read_chunks(path: Path) -> tuple[dict, bytes, bytes]:
    data = path.read_bytes()
    json_len, json_type = struct.unpack_from("<II", data, 12)
    assert json_type == 0x4E4F534A  # "JSON"
    gltf = json.loads(data[20 : 20 + json_len])
    offset = 20 + json_len
    bin_len, bin_type = struct.unpack_from("<II", data, offset)
    assert bin_type == 0x004E4942  # "BIN\0"
    return gltf, data[offset + 8 : offset + 8 + bin_len], data


def test_header_magic_version_length(tmp_path: Path) -> None:
    path = _write_sample(tmp_path / "test.glb")
    data = path.read_bytes()
    magic, version, total = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67  # "glTF"
    assert version == 2
    assert total == len(data)


def test_round_trip_nodes_meshes_accessors(tmp_path: Path) -> None:
    path = _write_sample(tmp_path / "test.glb")
    gltf = read_glb_json(path)

    assert gltf["asset"]["version"] == "2.0"
    assert [n["name"] for n in gltf["nodes"]] == ["mesh_node", "line_node"]
    assert gltf["scenes"][gltf["scene"]]["nodes"] == [0, 1]
    assert gltf["nodes"][0]["translation"] == [1.0, 2.0, 3.0]
    assert gltf["nodes"][0]["rotation"] == [0.0, 0.0, 0.0, 1.0]
    assert gltf["nodes"][0]["scale"] == [1.0, 1.0, 1.0]
    assert gltf["extras"] == {"key": "value"}

    assert len(gltf["meshes"]) == 2
    tri_prim = gltf["meshes"][0]["primitives"][0]
    seg_prim = gltf["meshes"][1]["primitives"][0]
    assert tri_prim["mode"] == 4  # TRIANGLES
    assert seg_prim["mode"] == 1  # LINES

    pos_acc = gltf["accessors"][tri_prim["attributes"]["POSITION"]]
    assert pos_acc["componentType"] == 5126
    assert pos_acc["type"] == "VEC3"
    assert pos_acc["count"] == 3
    assert pos_acc["min"] == [0.0, 0.0, 0.0]
    assert pos_acc["max"] == [1.0, 1.0, 0.0]

    idx_acc = gltf["accessors"][tri_prim["indices"]]
    assert idx_acc["componentType"] == 5125
    assert idx_acc["type"] == "SCALAR"
    assert idx_acc["count"] == 3

    seg_idx_acc = gltf["accessors"][seg_prim["indices"]]
    assert seg_idx_acc["count"] == 2


def test_round_trip_animation_channels_and_times(tmp_path: Path) -> None:
    path = _write_sample(tmp_path / "test.glb")
    gltf = read_glb_json(path)

    (anim,) = gltf["animations"]
    assert anim["name"] == "move"
    assert len(anim["samplers"]) == 2
    assert len(anim["channels"]) == 2

    paths = {c["target"]["path"] for c in anim["channels"]}
    assert paths == {"translation", "rotation"}
    for channel in anim["channels"]:
        assert channel["target"]["node"] == 0  # mesh_node

    input_idx = anim["samplers"][0]["input"]
    times_acc = gltf["accessors"][input_idx]
    assert times_acc["type"] == "SCALAR"
    assert times_acc["count"] == 2
    assert times_acc["min"] == [0.0]
    assert times_acc["max"] == [1.0]
    assert anim["samplers"][1]["input"] == input_idx  # shared input accessor

    rot_acc = gltf["accessors"][anim["samplers"][1]["output"]]
    assert rot_acc["type"] == "VEC4"
    assert rot_acc["count"] == 2


def test_buffer_views_aligned_and_within_bounds(tmp_path: Path) -> None:
    path = _write_sample(tmp_path / "test.glb")
    gltf, bin_chunk, _ = _read_chunks(path)

    assert gltf["buffers"][0]["byteLength"] == len(bin_chunk)
    assert len(bin_chunk) % 4 == 0
    for view in gltf["bufferViews"]:
        assert view["buffer"] == 0
        assert view["byteOffset"] % 4 == 0
        assert view["byteOffset"] + view["byteLength"] <= len(bin_chunk)


def test_nested_children_indices(tmp_path: Path) -> None:
    child = Node(name="child", mesh=_triangle())
    parent = Node(name="parent", children=(child,))
    write_glb(tmp_path / "nested.glb", [parent], [], extras=None)
    gltf = read_glb_json(tmp_path / "nested.glb")
    assert gltf["nodes"][0]["children"] == [1]
    assert gltf["scenes"][0]["nodes"] == [0]


def test_shared_geometry_deduped(tmp_path: Path) -> None:
    shared = _triangle()
    nodes = [Node(name="a", mesh=shared), Node(name="b", mesh=shared)]
    write_glb(tmp_path / "shared.glb", nodes, [], extras=None)
    gltf = read_glb_json(tmp_path / "shared.glb")
    assert len(gltf["meshes"]) == 1
    assert gltf["nodes"][0]["mesh"] == 0
    assert gltf["nodes"][1]["mesh"] == 0


def test_nan_positions_raises(tmp_path: Path) -> None:
    mesh = Mesh(
        name="bad",
        positions=np.array([[0, 0, 0], [np.nan, 0, 0], [0, 1, 0]], dtype=np.float32),
        indices=np.array([[0, 1, 2]], dtype=np.uint32),
    )
    with pytest.raises(ValueError, match="non-finite"):
        write_glb(tmp_path / "bad.glb", [Node(name="n", mesh=mesh)], [], extras=None)


def test_nan_translation_raises(tmp_path: Path) -> None:
    node = Node(name="n", translation=(0.0, float("nan"), 0.0))
    with pytest.raises(ValueError, match="non-finite"):
        write_glb(tmp_path / "bad.glb", [node], [], extras=None)


def test_wrong_positions_shape_raises(tmp_path: Path) -> None:
    mesh = Mesh(
        name="bad",
        positions=np.array([[0, 0], [1, 0], [0, 1]], dtype=np.float32),
        indices=np.array([[0, 1, 2]], dtype=np.uint32),
    )
    with pytest.raises(ValueError, match="positions"):
        write_glb(tmp_path / "bad.glb", [Node(name="n", mesh=mesh)], [], extras=None)


def test_wrong_indices_shape_raises(tmp_path: Path) -> None:
    mesh = Mesh(
        name="bad",
        positions=np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0]], dtype=np.float32),
        indices=np.array([[0, 1]], dtype=np.uint32),  # triangles need 3 columns
    )
    with pytest.raises(ValueError, match="indices"):
        write_glb(tmp_path / "bad.glb", [Node(name="n", mesh=mesh)], [], extras=None)


def test_index_out_of_range_raises(tmp_path: Path) -> None:
    mesh = Mesh(
        name="bad",
        positions=np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0]], dtype=np.float32),
        indices=np.array([[0, 1, 7]], dtype=np.uint32),
    )
    with pytest.raises(ValueError, match="out of range"):
        write_glb(tmp_path / "bad.glb", [Node(name="n", mesh=mesh)], [], extras=None)


def test_animation_length_mismatch_raises(tmp_path: Path) -> None:
    anim = Animation(
        name="bad",
        times=np.array([0.0, 1.0], dtype=np.float32),
        tracks={
            "mesh_node": (
                np.array([[0, 0, 0]], dtype=np.float32),  # 1 row, times has 2
                np.array([[0, 0, 0, 1], [0, 0, 0, 1]], dtype=np.float32),
            )
        },
    )
    with pytest.raises(ValueError, match="translations"):
        write_glb(tmp_path / "bad.glb", _sample_nodes(), [anim], extras=None)


def test_non_unit_node_quaternion_raises(tmp_path: Path) -> None:
    node = Node(name="n", rotation_xyzw=(0.0, 0.0, 0.0, 2.0))
    with pytest.raises(ValueError, match="unit quaternion"):
        write_glb(tmp_path / "bad.glb", [node], [], extras=None)


def test_quaternion_within_tolerance_accepted(tmp_path: Path) -> None:
    node = Node(name="n", rotation_xyzw=(0.0, 0.0, 0.0, 1.0005))
    write_glb(tmp_path / "ok.glb", [node], [], extras=None)
    gltf = read_glb_json(tmp_path / "ok.glb")
    assert gltf["nodes"][0]["rotation"][3] == pytest.approx(1.0005)


def test_non_unit_animation_quaternion_raises(tmp_path: Path) -> None:
    anim = Animation(
        name="bad",
        times=np.array([0.0, 1.0], dtype=np.float32),
        tracks={
            "mesh_node": (
                np.array([[0, 0, 0], [1, 0, 0]], dtype=np.float32),
                np.array([[0, 0, 0, 1], [0, 0, 0, 5]], dtype=np.float32),
            )
        },
    )
    with pytest.raises(ValueError, match="unit quaternion"):
        write_glb(tmp_path / "bad.glb", _sample_nodes(), [anim], extras=None)


def test_duplicate_node_names_raises(tmp_path: Path) -> None:
    child = Node(name="dup")
    nodes = [Node(name="dup"), Node(name="parent", children=(child,))]
    with pytest.raises(ValueError, match="duplicate"):
        write_glb(tmp_path / "bad.glb", nodes, [], extras=None)


def test_animation_unknown_target_raises(tmp_path: Path) -> None:
    anim = Animation(
        name="bad",
        times=np.array([0.0, 1.0], dtype=np.float32),
        tracks={
            "ghost": (
                np.array([[0, 0, 0], [1, 0, 0]], dtype=np.float32),
                np.array([[0, 0, 0, 1], [0, 0, 0, 1]], dtype=np.float32),
            )
        },
    )
    with pytest.raises(ValueError, match="unknown"):
        write_glb(tmp_path / "bad.glb", _sample_nodes(), [anim], extras=None)


def test_extras_omitted_when_none(tmp_path: Path) -> None:
    write_glb(tmp_path / "noextras.glb", _sample_nodes(), [], extras=None)
    gltf = read_glb_json(tmp_path / "noextras.glb")
    assert "extras" not in gltf
    assert "animations" not in gltf


def test_read_glb_json_rejects_non_glb(tmp_path: Path) -> None:
    bad = tmp_path / "bad.glb"
    bad.write_bytes(b"not a glb file at all")
    with pytest.raises(ValueError, match="magic"):
        read_glb_json(bad)


@pytest.mark.skipif(shutil.which("npx") is None, reason="npx not on PATH")
def test_gltf_transform_validate_clean(tmp_path: Path) -> None:
    path = _write_sample(tmp_path / "valid.glb")
    result = subprocess.run(
        ["npx", "--no-install", "gltf-transform", "validate", str(path)],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        timeout=180,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "no errors found" in result.stdout.lower()
