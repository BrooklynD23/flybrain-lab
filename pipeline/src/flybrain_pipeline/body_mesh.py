"""Body geometry from an MJCF model: merge, decimate, convert to glb nodes."""

from __future__ import annotations

import fast_simplification
import mujoco
import numpy as np

from flybrain_pipeline import glb

MeshPair = tuple[np.ndarray, np.ndarray]
_MIN_TRIS = 50


def body_meshes(
    model: mujoco.MjModel, visual_groups: set[int] | None = None
) -> dict[str, MeshPair]:
    """Merge each body's mesh geoms into one body-local (verts, faces) pair."""
    parts: dict[str, list[MeshPair]] = {}
    for g in range(model.ngeom):
        if model.geom_type[g] != mujoco.mjtGeom.mjGEOM_MESH:
            continue
        if visual_groups is not None and int(model.geom_group[g]) not in visual_groups:
            continue
        m = model.geom_dataid[g]
        va, vn = model.mesh_vertadr[m], model.mesh_vertnum[m]
        fa, fn = model.mesh_faceadr[m], model.mesh_facenum[m]
        rot = np.zeros(9)
        mujoco.mju_quat2Mat(rot, model.geom_quat[g])
        verts = model.mesh_vert[va : va + vn] @ rot.reshape(3, 3).T + model.geom_pos[g]
        faces = model.mesh_face[fa : fa + fn]
        name = mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_BODY, model.geom_bodyid[g])
        parts.setdefault(name, []).append((verts.astype(np.float32), faces.astype(np.uint32)))
    out = {}
    for name, items in parts.items():
        offsets = np.cumsum([0] + [len(v) for v, _ in items[:-1]])
        out[name] = (
            np.concatenate([v for v, _ in items]),
            np.concatenate([f + np.uint32(o) for (_, f), o in zip(items, offsets, strict=True)]),
        )
    return out


def decimate_to_budget(meshes: dict[str, MeshPair], max_tris: int = 95_000) -> dict[str, MeshPair]:
    """Allocate triangles per body in proportion to size (min 50); return new arrays."""
    total = sum(len(f) for _, f in meshes.values())
    out = {}
    for name, (v, f) in meshes.items():
        target = max(_MIN_TRIS, int(max_tris * len(f) / total)) if total else len(f)
        if len(f) <= target:
            out[name] = (v.copy(), f.copy())
            continue
        nv, nf = fast_simplification.simplify(
            v.astype(np.float32), f.astype(np.int64), target_count=target
        )
        if len(nf) == 0:
            out[name] = (v.copy(), f.copy())
        else:
            out[name] = (nv.astype(np.float32), nf.astype(np.uint32))
    return out


def to_nodes(meshes: dict[str, MeshPair]) -> list[glb.Node]:
    """One node per body, mesh in body-local frame."""
    return [
        glb.Node(
            name=name,
            mesh=glb.Mesh(name=name, positions=v.astype(np.float32), indices=f.astype(np.uint32)),
        )
        for name, (v, f) in meshes.items()
    ]
