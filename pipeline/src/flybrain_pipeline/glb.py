"""Minimal glTF 2.0 binary (.glb) writer.

Writes triangle meshes (mode 4), line segments (mode 1) and node TRS
animations into a single binary buffer. Uses only numpy + ``json`` +
``struct``; no glTF libraries.

All accessors live in one buffer; every bufferView starts at a 4-byte
aligned offset. ``min``/``max`` are emitted on POSITION accessors and on
animation input (times) accessors as required by the glTF 2.0 spec.
"""

from __future__ import annotations

import json
import struct
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

import numpy as np

_GLB_MAGIC = 0x46546C67  # "glTF"
_GLTF_VERSION = 2
_CHUNK_JSON = 0x4E4F534A  # "JSON"
_CHUNK_BIN = 0x004E4942  # "BIN\0"

_COMPONENT_FLOAT32 = 5126
_COMPONENT_UINT32 = 5125
_TARGET_ARRAY_BUFFER = 34962
_TARGET_ELEMENT_ARRAY_BUFFER = 34963

_QUAT_TOL = 1e-3


@dataclass(frozen=True)
class Mesh:
    """Triangle mesh: float32 positions ``[N,3]``, uint32 indices ``[M,3]``."""

    name: str
    positions: np.ndarray
    indices: np.ndarray


@dataclass(frozen=True)
class Lines:
    """Line segments: float32 positions ``[N,3]``, uint32 indices ``[K,2]``."""

    name: str
    positions: np.ndarray
    indices: np.ndarray


@dataclass(frozen=True)
class Node:
    """Scene node with local TRS and optional geometry; children by value."""

    name: str
    mesh: Mesh | Lines | None = None
    translation: tuple[float, float, float] = (0.0, 0.0, 0.0)
    rotation_xyzw: tuple[float, float, float, float] = (0.0, 0.0, 0.0, 1.0)
    scale: tuple[float, float, float] = (1.0, 1.0, 1.0)
    children: tuple[Node, ...] = ()


@dataclass(frozen=True)
class Animation:
    """One clip: float32 ``times [T]`` plus per-node ``tracks`` mapping a node
    name to ``(translations [T,3], rotations_xyzw [T,4])``."""

    name: str
    times: np.ndarray
    tracks: dict[str, tuple[np.ndarray, np.ndarray]]


def _flatten_nodes(
    nodes: Sequence[Node],
) -> tuple[list[Node], list[list[int]], list[int], dict[str, int]]:
    """Depth-first flatten; returns nodes, per-node child indices, root
    indices, and a name -> index map. Raises on duplicate names."""
    flat: list[Node] = []
    child_lists: list[list[int]] = []
    index_by_name: dict[str, int] = {}

    def visit(node: Node) -> int:
        if node.name in index_by_name:
            raise ValueError(f"duplicate node name {node.name!r}")
        index = len(flat)
        index_by_name[node.name] = index
        flat.append(node)
        child_lists.append([])  # placeholder so children land at later indices
        child_lists[index] = [visit(child) for child in node.children]
        return index

    roots = [visit(node) for node in nodes]
    return flat, child_lists, roots, index_by_name


def _node_trs(node: Node) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Validate one node's TRS; returns float64 (t, r_xyzw, s)."""
    t = np.asarray(node.translation, dtype=np.float64)
    r = np.asarray(node.rotation_xyzw, dtype=np.float64)
    s = np.asarray(node.scale, dtype=np.float64)
    if t.shape != (3,):
        raise ValueError(f"node {node.name!r}: translation must have 3 elements, got {t.shape}")
    if r.shape != (4,):
        raise ValueError(f"node {node.name!r}: rotation_xyzw must have 4 elements, got {r.shape}")
    if s.shape != (3,):
        raise ValueError(f"node {node.name!r}: scale must have 3 elements, got {s.shape}")
    for label, values in (("translation", t), ("rotation_xyzw", r), ("scale", s)):
        if not np.isfinite(values).all():
            raise ValueError(f"node {node.name!r}: {label} has non-finite values")
    norm = float(np.linalg.norm(r))
    if abs(norm - 1.0) > _QUAT_TOL:
        raise ValueError(
            f"node {node.name!r}: rotation_xyzw is not a unit quaternion (norm {norm:.6f})"
        )
    return t, r, s


def _check_geometry(geom: Mesh | Lines, index_cols: int) -> tuple[np.ndarray, np.ndarray]:
    """Validate geometry arrays; returns (positions float32, indices uint32)."""
    kind = type(geom).__name__
    positions = np.asarray(geom.positions, dtype=np.float32)
    indices = np.asarray(geom.indices, dtype=np.uint32)
    if positions.ndim != 2 or positions.shape[1] != 3:
        raise ValueError(
            f"{kind} {geom.name!r}: positions must have shape [N,3], got {positions.shape}"
        )
    if indices.ndim != 2 or indices.shape[1] != index_cols:
        raise ValueError(
            f"{kind} {geom.name!r}: indices must have shape [K,{index_cols}], got {indices.shape}"
        )
    if positions.shape[0] == 0 or indices.shape[0] == 0:
        raise ValueError(f"{kind} {geom.name!r}: empty geometry")
    if not np.isfinite(positions).all():
        raise ValueError(f"{kind} {geom.name!r}: non-finite positions")
    if int(indices.max()) >= positions.shape[0]:
        raise ValueError(
            f"{kind} {geom.name!r}: indices out of range for {positions.shape[0]} vertices"
        )
    return positions, indices


def _check_animation(
    anim: Animation, index_by_name: dict[str, int]
) -> tuple[np.ndarray, dict[str, tuple[np.ndarray, np.ndarray]]]:
    """Validate one clip; returns (times float32, checked tracks)."""
    times = np.asarray(anim.times, dtype=np.float32)
    if times.ndim != 1 or times.size == 0:
        raise ValueError(f"animation {anim.name!r}: times must be a non-empty 1-D array")
    if not np.isfinite(times).all():
        raise ValueError(f"animation {anim.name!r}: non-finite times")
    if times.size > 1 and bool(np.any(np.diff(times.astype(np.float64)) <= 0)):
        raise ValueError(f"animation {anim.name!r}: times must be strictly increasing")
    if not anim.tracks:
        raise ValueError(f"animation {anim.name!r}: no tracks")

    checked: dict[str, tuple[np.ndarray, np.ndarray]] = {}
    for target, pair in anim.tracks.items():
        if target not in index_by_name:
            raise ValueError(f"animation {anim.name!r}: unknown target node {target!r}")
        translations = np.asarray(pair[0], dtype=np.float32)
        rotations = np.asarray(pair[1], dtype=np.float32)
        if translations.shape != (times.size, 3):
            raise ValueError(
                f"animation {anim.name!r} track {target!r}: translations must have shape "
                f"[{times.size},3], got {translations.shape}"
            )
        if rotations.shape != (times.size, 4):
            raise ValueError(
                f"animation {anim.name!r} track {target!r}: rotations_xyzw must have shape "
                f"[{times.size},4], got {rotations.shape}"
            )
        if not np.isfinite(translations).all() or not np.isfinite(rotations).all():
            raise ValueError(f"animation {anim.name!r} track {target!r}: non-finite values")
        norms = np.linalg.norm(rotations.astype(np.float64), axis=1)
        if bool(np.any(np.abs(norms - 1.0) > _QUAT_TOL)):
            raise ValueError(
                f"animation {anim.name!r} track {target!r}: rotations_xyzw are not unit quaternions"
            )
        checked[target] = (translations, rotations)
    return times, checked


class _BufferBuilder:
    """Accumulates one binary blob plus bufferView/accessor tables."""

    def __init__(self) -> None:
        self.blob = bytearray()
        self.views: list[dict] = []
        self.accessors: list[dict] = []

    def add_accessor(
        self,
        array: np.ndarray,
        component_type: int,
        accessor_type: str,
        target: int | None = None,
        minmax: bool = False,
    ) -> int:
        data = np.ascontiguousarray(array)
        self.blob.extend(b"\x00" * (-len(self.blob) % 4))
        view: dict = {
            "buffer": 0,
            "byteOffset": len(self.blob),
            "byteLength": data.nbytes,
        }
        if target is not None:
            view["target"] = target
        self.blob.extend(data.tobytes())
        self.views.append(view)

        accessor: dict = {
            "bufferView": len(self.views) - 1,
            "componentType": component_type,
            "count": int(data.shape[0]),
            "type": accessor_type,
        }
        if minmax:
            rows = data.reshape(data.shape[0], -1)
            accessor["min"] = [float(v) for v in rows.min(axis=0)]
            accessor["max"] = [float(v) for v in rows.max(axis=0)]
        self.accessors.append(accessor)
        return len(self.accessors) - 1


def write_glb(
    path: str | Path,
    nodes: Sequence[Node],
    animations: Sequence[Animation],
    extras: dict | None = None,
) -> None:
    """Write ``nodes`` and ``animations`` to ``path`` as a glTF 2.0 .glb.

    ``nodes`` are the scene roots (children nested inside them). ``extras``,
    when given, is stored verbatim as the document-level ``extras`` object.

    Raises ValueError on non-finite values, mismatched lengths/shapes,
    non-unit quaternions (tolerance 1e-3), duplicate node names, animation
    tracks targeting unknown nodes, and out-of-range indices.
    """
    flat, child_lists, roots, index_by_name = _flatten_nodes(nodes)
    trs = [_node_trs(node) for node in flat]

    builder = _BufferBuilder()
    gltf_meshes: list[dict] = []
    mesh_index_by_obj: dict[int, int] = {}

    def mesh_index_for(geom: Mesh | Lines) -> int:
        key = id(geom)
        if key in mesh_index_by_obj:
            return mesh_index_by_obj[key]
        if isinstance(geom, Mesh):
            index_cols, mode = 3, 4
        elif isinstance(geom, Lines):
            index_cols, mode = 2, 1
        else:
            raise ValueError(f"node mesh must be Mesh or Lines, got {type(geom).__name__}")
        positions, indices = _check_geometry(geom, index_cols)
        position_acc = builder.add_accessor(
            positions, _COMPONENT_FLOAT32, "VEC3", _TARGET_ARRAY_BUFFER, minmax=True
        )
        index_acc = builder.add_accessor(
            indices.reshape(-1),
            _COMPONENT_UINT32,
            "SCALAR",
            _TARGET_ELEMENT_ARRAY_BUFFER,
        )
        primitive = {
            "attributes": {"POSITION": position_acc},
            "indices": index_acc,
            "mode": mode,
            "material": 0,
        }
        gltf_meshes.append({"name": geom.name, "primitives": [primitive]})
        mesh_index_by_obj[key] = len(gltf_meshes) - 1
        return mesh_index_by_obj[key]

    gltf_nodes: list[dict] = []
    for index, node in enumerate(flat):
        t, r, s = trs[index]
        obj: dict = {
            "name": node.name,
            "translation": [float(v) for v in t],
            "rotation": [float(v) for v in r],
            "scale": [float(v) for v in s],
        }
        if child_lists[index]:
            obj["children"] = child_lists[index]
        if node.mesh is not None:
            obj["mesh"] = mesh_index_for(node.mesh)
        gltf_nodes.append(obj)

    gltf_animations: list[dict] = []
    for anim in animations:
        times, tracks = _check_animation(anim, index_by_name)
        input_acc = builder.add_accessor(times, _COMPONENT_FLOAT32, "SCALAR", minmax=True)
        samplers: list[dict] = []
        channels: list[dict] = []
        for target, (translations, rotations) in tracks.items():
            for channel_path, data, accessor_type in (
                ("translation", translations, "VEC3"),
                ("rotation", rotations, "VEC4"),
            ):
                output_acc = builder.add_accessor(data, _COMPONENT_FLOAT32, accessor_type)
                samplers.append(
                    {"input": input_acc, "output": output_acc, "interpolation": "LINEAR"}
                )
                channels.append(
                    {
                        "sampler": len(samplers) - 1,
                        "target": {"node": index_by_name[target], "path": channel_path},
                    }
                )
        gltf_animations.append({"name": anim.name, "samplers": samplers, "channels": channels})

    blob = bytes(builder.blob) + b"\x00" * (-len(builder.blob) % 4)

    gltf: dict = {
        "asset": {"version": "2.0", "generator": "flybrain-pipeline glb.py"},
        "scene": 0,
        "scenes": [{"nodes": roots}],
        "nodes": gltf_nodes,
    }
    if gltf_meshes:
        gltf["meshes"] = gltf_meshes
        gltf["materials"] = [
            {
                "name": "default",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [1.0, 1.0, 1.0, 1.0],
                    "metallicFactor": 0.0,
                    "roughnessFactor": 1.0,
                },
            }
        ]
    if gltf_animations:
        gltf["animations"] = gltf_animations
    if builder.accessors:
        gltf["accessors"] = builder.accessors
        gltf["bufferViews"] = builder.views
        gltf["buffers"] = [{"byteLength": len(blob)}]
    if extras is not None:
        gltf["extras"] = extras

    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * (-len(json_bytes) % 4)  # JSON chunk pads with spaces

    body = struct.pack("<II", len(json_bytes), _CHUNK_JSON) + json_bytes
    if builder.accessors:
        body += struct.pack("<II", len(blob), _CHUNK_BIN) + blob
    header = struct.pack("<III", _GLB_MAGIC, _GLTF_VERSION, 12 + len(body))
    Path(path).write_bytes(header + body)


def read_glb_json(path: str | Path) -> dict:
    """Parse a .glb file and return its glTF JSON chunk as a dict."""
    data = Path(path).read_bytes()
    if len(data) < 20:
        raise ValueError(f"{path}: too short to be a .glb file")
    magic, version, _total = struct.unpack_from("<III", data, 0)
    if magic != _GLB_MAGIC:
        raise ValueError(f"{path}: bad .glb magic 0x{magic:08x}")
    if version != _GLTF_VERSION:
        raise ValueError(f"{path}: unsupported glTF version {version}")
    json_len, json_type = struct.unpack_from("<II", data, 12)
    if json_type != _CHUNK_JSON:
        raise ValueError(f"{path}: first chunk is not JSON")
    return json.loads(data[20 : 20 + json_len].decode("utf-8"))
