"""Joint-space keyframes -> world body poses -> glTF animation frames.

Pipeline stage T02.3:

1. ``poses_from_qpos`` runs ``mujoco.mj_kinematics`` on a fresh ``MjData`` per
   call, returning per-body world positions and orientations (wxyz) for each
   ``qpos`` row.
2. ``interpolate_keyframes`` builds a ``qpos[T, nq]`` trajectory by linear
   interpolation in joint space. Joints never named in any keyframe keep
   ``model.qpos0``; before the first / after the last keyframe that names a
   joint, its value clamps to the nearest keyframe. Unknown joint names raise
   ``ValueError`` listing them.
3. ``to_gltf_frame`` converts MuJoCo's Z-up / wxyz output to glTF's Y-up /
   xyzw convention (rotate -90 deg about X, reorder, renormalize). This module
   is the ONE place quaternion-order conversion happens.
"""

from collections.abc import Mapping, Sequence
from typing import Any

import mujoco
import numpy as np

# Fixed rotation from MuJoCo Z-up to glTF Y-up: -90 deg about +X.
# Maps (x, y, z) -> (x, z, -y), i.e. +Z -> +Y and +Y -> -Z.
_ZUP_TO_YUP_MAT = np.array(
    [
        [1.0, 0.0, 0.0],
        [0.0, 0.0, 1.0],
        [0.0, -1.0, 0.0],
    ]
)
# Same rotation as a unit quaternion in wxyz order:
# (cos(theta/2), sin(theta/2) * axis) with theta = -90 deg, axis = +X.
_ZUP_TO_YUP_QUAT_WXYZ = np.array([np.sqrt(0.5), -np.sqrt(0.5), 0.0, 0.0])


def poses_from_qpos(model: mujoco.MjModel, qpos: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """World body poses for each row of ``qpos``.

    ``qpos`` must have shape ``(T, model.nq)``. Returns ``(xpos, xquat_wxyz)``
    with shapes ``(T, model.nbody, 3)`` and ``(T, model.nbody, 4)``; quaternions
    are in MuJoCo's wxyz order. Uses a fresh ``MjData`` per call.
    """
    qpos = np.asarray(qpos, dtype=np.float64)
    if qpos.ndim != 2 or qpos.shape[1] != model.nq:
        raise ValueError(f"qpos must have shape (T, nq={model.nq}); got {qpos.shape}")

    data = mujoco.MjData(model)
    xpos = np.empty((qpos.shape[0], model.nbody, 3))
    xquat = np.empty((qpos.shape[0], model.nbody, 4))
    for row_index in range(qpos.shape[0]):
        data.qpos[:] = qpos[row_index]
        mujoco.mj_kinematics(model, data)
        xpos[row_index] = data.xpos
        xquat[row_index] = data.xquat
    return xpos, xquat


def interpolate_keyframes(
    model: mujoco.MjModel,
    keyframes: Sequence[Mapping[str, Any]],
    fps: float = 30.0,
) -> np.ndarray:
    """Linear joint-space interpolation of keyframes into a qpos trajectory.

    Each keyframe is a mapping ``{"t_ms": float, "joints": {name: radians}}``.
    Returns ``qpos[T, nq]`` sampling frames at ``fps`` from ``t=0`` through the
    latest keyframe time. Joints unnamed in every keyframe keep ``qpos0``;
    per-joint values clamp outside their keyed range. Raises ``ValueError``
    listing every joint name not present in the model.
    """
    if fps <= 0:
        raise ValueError(f"fps must be positive; got {fps}")
    if not keyframes:
        return np.zeros((0, model.nq))

    # Resolve every named joint up front so the error lists all unknowns.
    qpos_adr: dict[str, int] = {}
    unknown: set[str] = set()
    for keyframe in keyframes:
        for name in keyframe["joints"]:
            if name in qpos_adr or name in unknown:
                continue
            joint_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, name)
            if joint_id < 0:
                unknown.add(name)
            elif int(model.jnt_type[joint_id]) not in (
                int(mujoco.mjtJoint.mjJNT_HINGE),
                int(mujoco.mjtJoint.mjJNT_SLIDE),
            ):
                raise ValueError(
                    f"Joint {name!r} is not a scalar hinge/slide joint; "
                    "ball and free joints cannot be keyframed by radians"
                )
            else:
                qpos_adr[name] = int(model.jnt_qposadr[joint_id])
    if unknown:
        raise ValueError(f"Unknown joint name(s): {sorted(unknown)}")

    # Per-joint linear curves, built only from keyframes that name the joint.
    points: dict[str, list[tuple[float, float]]] = {}
    for keyframe in keyframes:
        t_ms = float(keyframe["t_ms"])
        for name, radians in keyframe["joints"].items():
            points.setdefault(name, []).append((t_ms, float(radians)))
    curves = {
        name: (
            np.asarray([t for t, _ in sorted(pairs)]),
            np.asarray([v for _, v in sorted(pairs)]),
        )
        for name, pairs in points.items()
    }

    t_end_ms = max(float(keyframe["t_ms"]) for keyframe in keyframes)
    frame_count = int(round(t_end_ms * fps / 1000.0)) + 1
    frame_times_ms = np.arange(frame_count) * (1000.0 / fps)

    qpos = np.tile(model.qpos0, (frame_count, 1))
    for name, (times, values) in curves.items():
        # np.interp clamps to the endpoint values outside the keyed range.
        qpos[:, qpos_adr[name]] = np.interp(frame_times_ms, times, values)
    return qpos


def _quat_mul_wxyz(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Hamilton product of quaternions in wxyz order; broadcasts on batch axes."""
    aw, ax, ay, az = np.moveaxis(a, -1, 0)
    bw, bx, by, bz = np.moveaxis(b, -1, 0)
    return np.stack(
        [
            aw * bw - ax * bx - ay * by - az * bz,
            aw * bx + ax * bw + ay * bz - az * by,
            aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw,
        ],
        axis=-1,
    )


def to_gltf_frame(
    xpos: np.ndarray,
    xquat_wxyz: np.ndarray,
    scale: float,
) -> tuple[np.ndarray, np.ndarray]:
    """Convert MuJoCo world poses to glTF Y-up, xyzw-quaternion frames.

    ``xpos``/``xquat_wxyz`` have trailing shapes ``(..., 3)``/``(..., 4)`` and
    broadcast together. ``scale`` multiplies translations only (e.g. mm -> m).
    Returns ``(translations, rotations_xyzw)``; rotations are renormalized.
    """
    xpos = np.asarray(xpos, dtype=np.float64)
    xquat_wxyz = np.asarray(xquat_wxyz, dtype=np.float64)

    translations = (xpos @ _ZUP_TO_YUP_MAT.T) * scale
    rotated_wxyz = _quat_mul_wxyz(_ZUP_TO_YUP_QUAT_WXYZ, xquat_wxyz)
    rotations = rotated_wxyz[..., [1, 2, 3, 0]]
    norms = np.linalg.norm(rotations, axis=-1, keepdims=True)
    rotations = rotations / np.where(norms > 0.0, norms, 1.0)
    return translations, rotations
