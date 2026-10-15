"""Brain neuropils: fetch meshes or sample synapse points, frame, convert to glb nodes."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from pathlib import Path

import numpy as np
import pandas as pd

from flybrain_pipeline import body_mesh, glb

MeshPair = tuple[np.ndarray, np.ndarray]
Frame = tuple[np.ndarray, float]
SCENE_WIDTH = 2.0


def _default_getter(neuropil_id: str) -> MeshPair:
    # ponytail: fafbseg function name UNVERIFIED; inject `getter` if it differs.
    from fafbseg import flywire  # noqa: PLC0415

    m = flywire.get_neuropil_volumes(neuropil_id)
    return np.asarray(m.vertices), np.asarray(m.faces)


def fetch_neuropil_meshes(
    ids: list[str], out_npz: str | Path, getter: Callable[[str], MeshPair] | None = None
) -> None:
    """Save `{id}_v` / `{id}_f` arrays to an npz."""
    get = getter or _default_getter
    arrays: dict[str, np.ndarray] = {}
    for i in ids:
        verts, faces = get(i)
        verts, faces = np.asarray(verts, np.float32), np.asarray(faces, np.uint32)
        if len(verts) == 0 or len(faces) == 0 or faces.ndim != 2 or faces.shape[1] != 3:
            raise ValueError(f"neuropil {i}: empty or malformed mesh")
        arrays[f"{i}_v"], arrays[f"{i}_f"] = verts, faces
    np.savez_compressed(out_npz, **arrays)


def load_meshes(npz_path: str | Path) -> dict[str, MeshPair]:
    with np.load(npz_path) as z:
        return {k[:-2]: (z[k], z[k[:-2] + "_f"]) for k in z.files if k.endswith("_v")}


def _columns(path: str | Path) -> list[str]:
    import pyarrow.feather as pf  # noqa: PLC0415

    return pf.read_table(path, memory_map=True).schema.names


def points_from_synapses(
    feather_path: str | Path,
    columns: Mapping[str, str],
    per_neuropil: int = 2000,
    seed: int = 0,
) -> dict[str, np.ndarray]:
    """Sample up to `per_neuropil` synapse points per neuropil.

    `columns` maps neuropil/x/y/z to table column names (UNVERIFIED layout).
    """
    names = [columns[k] for k in ("neuropil", "x", "y", "z")]
    if missing := set(names) - set(_columns(feather_path)):
        raise KeyError(f"columns not in {feather_path}: {sorted(missing)}")
    df = pd.read_feather(feather_path, columns=names)
    rng = np.random.default_rng(seed)
    out = {}
    for key, grp in df.groupby(names[0], sort=True):
        xyz = grp[names[1:]].to_numpy(np.float32)
        if len(xyz) > per_neuropil:
            xyz = xyz[np.sort(rng.choice(len(xyz), per_neuropil, replace=False))]
        out[str(key)] = xyz
    return out


def brain_frame(all_points: Mapping[str, np.ndarray]) -> Frame:
    """(center, scale): `(p - center) * scale` fits the bbox in a ~2-unit cube."""
    if not all_points:
        raise ValueError("no points")
    pts = np.concatenate([np.asarray(p, np.float64).reshape(-1, 3) for p in all_points.values()])
    lo, hi = pts.min(0), pts.max(0)
    span = float((hi - lo).max())
    if span <= 0:
        raise ValueError("degenerate bounds")
    return (lo + hi) / 2, SCENE_WIDTH / span


def _apply(p: np.ndarray, frame: Frame) -> np.ndarray:
    return ((np.asarray(p, np.float64) - frame[0]) * frame[1]).astype(np.float32)


def to_nodes(
    meshes_or_points: Mapping[str, np.ndarray] | Mapping[str, MeshPair],
    frame: Frame,
    max_tris: int = 140_000,
) -> tuple[list[glb.Node], str]:
    """Mesh mode (decimated by size share) or point mode; returns (nodes, kind)."""
    if not meshes_or_points:
        raise ValueError("nothing to convert")
    if all(isinstance(v, tuple) for v in meshes_or_points.values()):
        framed = {k: (_apply(v, frame), f) for k, (v, f) in meshes_or_points.items()}
        # ponytail: share by triangle count, not surface area; fine for neuropil meshes.
        # Reserve body_mesh's 50-tri-per-mesh minimum so the total stays under max_tris.
        budget = max(0, max_tris - 50 * len(framed))
        return body_mesh.to_nodes(body_mesh.decimate_to_budget(framed, budget)), "mesh"
    nodes = []
    for name, pts in meshes_or_points.items():
        pos = _apply(pts, frame)
        idx = np.arange(len(pos), dtype=np.uint32)
        # glb has no POINTS primitive: degenerate segments (i, i) render as points.
        nodes.append(glb.Node(name=name, mesh=glb.Lines(name, pos, np.c_[idx, idx])))
    return nodes, "points"
