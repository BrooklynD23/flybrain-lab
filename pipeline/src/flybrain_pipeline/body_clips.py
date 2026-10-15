"""Behavior clips: reference replay (HDF5 qpos) and keyframed qpos -> glTF animation."""

from collections.abc import Mapping
from pathlib import Path
from typing import Any

import h5py
import mujoco
import numpy as np

from flybrain_pipeline import kinematics
from flybrain_pipeline.glb import Animation

_ROOT_QUAT = slice(3, 7)  # free-joint quaternion (wxyz) inside qpos


def _slerp(q0: np.ndarray, q1: np.ndarray, u: np.ndarray) -> np.ndarray:
    """Slerp rows of q0 -> q1 by fraction u [T]; shortest arc, unit output."""
    dot = np.sum(q0 * q1, axis=-1)
    q1 = np.where(dot[:, None] < 0, -q1, q1)
    dot = np.abs(dot)
    theta = np.arccos(np.clip(dot, -1.0, 1.0))
    sin = np.sin(theta)
    near = sin < 1e-8
    safe = np.where(near, 1.0, sin)
    a = np.where(near, 1.0 - u, np.sin((1.0 - u) * theta) / safe)
    b = np.where(near, u, np.sin(u * theta) / safe)
    out = a[:, None] * q0 + b[:, None] * q1
    return out / np.linalg.norm(out, axis=-1, keepdims=True)


def load_reference_qpos(
    h5_path: str | Path,
    dataset_key: str,
    start: int,
    n_frames: int,
    src_fps: float,
    fps: float = 30.0,
) -> np.ndarray:
    """Read ``n_frames`` rows of ``dataset_key`` from ``start`` and resample to ``fps``.

    Linear interpolation per column; qpos[3:7] (root quaternion) uses slerp.
    Dataset key and src_fps are parameters (layout UNVERIFIED).
    """
    if src_fps <= 0 or fps <= 0:
        raise ValueError(f"src_fps and fps must be positive; got {src_fps}, {fps}")
    if n_frames < 1 or start < 0:
        raise ValueError(f"need start >= 0 and n_frames >= 1; got {start}, {n_frames}")
    with h5py.File(h5_path, "r") as f:
        if dataset_key not in f:
            raise KeyError(f"dataset {dataset_key!r} not in {h5_path}")
        dset = f[dataset_key]
        if dset.ndim != 2 or start + n_frames > dset.shape[0]:
            raise ValueError(
                f"cannot read frames {start}:{start + n_frames} from dataset of shape {dset.shape}"
            )
        src = np.asarray(dset[start : start + n_frames], dtype=np.float64)

    out_count = max(1, round(n_frames * fps / src_fps))
    pos = np.minimum(np.arange(out_count) * src_fps / fps, n_frames - 1)
    i0 = np.floor(pos).astype(int)
    i1 = np.minimum(i0 + 1, n_frames - 1)
    u = pos - i0
    out = src[i0] * (1.0 - u)[:, None] + src[i1] * u[:, None]
    if src.shape[1] >= 7:
        out[:, _ROOT_QUAT] = _slerp(src[i0, _ROOT_QUAT], src[i1, _ROOT_QUAT], u)
    return out


def loop_or_clamp(qpos: np.ndarray, n_frames: int, cyclic: bool) -> np.ndarray:
    """Length-``n_frames`` clip: tile if cyclic, else hold the last frame."""
    idx = np.arange(n_frames)
    idx = idx % len(qpos) if cyclic else np.minimum(idx, len(qpos) - 1)
    return qpos[idx]


def keyframed_qpos(
    model: mujoco.MjModel, section: Mapping[str, Any], fps: float = 30.0
) -> np.ndarray:
    """qpos trajectory from a keyframes.toml section (``{"keyframes": [...]}``)."""
    return kinematics.interpolate_keyframes(model, section["keyframes"], fps)


def make_clip(
    model: mujoco.MjModel, behavior: str, qpos: np.ndarray, fps: float, scale: float
) -> Animation:
    """Animation with one track per non-world body (node names = body names)."""
    xpos, xquat = kinematics.poses_from_qpos(model, qpos)
    trans, rots = kinematics.to_gltf_frame(xpos, xquat, scale)
    tracks = {
        mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_BODY, b): (trans[:, b], rots[:, b])
        for b in range(1, model.nbody)
    }
    return Animation(name=behavior, times=np.arange(len(qpos)) / fps, tracks=tracks)
