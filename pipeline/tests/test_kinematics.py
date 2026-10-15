"""Tests for `flybrain_pipeline.kinematics` (joint keyframes -> world poses -> glTF)."""

import mujoco
import numpy as np
import pytest
from numpy.testing import assert_allclose

from flybrain_pipeline.kinematics import (
    interpolate_keyframes,
    poses_from_qpos,
    to_gltf_frame,
)

# Two bodies total including the world: `world` (index 0) + `arm` (index 1),
# with a single scalar hinge joint rotating `arm` about the +Y axis.
MJCF_TWO_BODY_ONE_HINGE = """
<mujoco>
  <worldbody>
    <body name="arm" pos="0 0 1">
      <joint name="hinge" type="hinge" axis="0 1 0"/>
      <geom type="capsule" size="0.05" fromto="0 0 0 1 0 0"/>
    </body>
  </worldbody>
</mujoco>
"""

SQRT_HALF = np.sqrt(0.5)


@pytest.fixture
def model() -> mujoco.MjModel:
    return mujoco.MjModel.from_xml_string(MJCF_TWO_BODY_ONE_HINGE)


def _arm_id(model: mujoco.MjModel) -> int:
    return mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY, "arm")


def test_poses_from_qpos_90deg_hinge_gives_expected_pose(model: mujoco.MjModel) -> None:
    qpos = np.array([[0.0], [np.pi / 2]])
    xpos, xquat = poses_from_qpos(model, qpos)

    arm = _arm_id(model)
    assert xpos.shape == (2, model.nbody, 3)
    assert xquat.shape == (2, model.nbody, 4)

    # The hinge anchor is the body origin: position is unchanged by rotation.
    assert_allclose(xpos[:, arm], [[0.0, 0.0, 1.0], [0.0, 0.0, 1.0]], atol=1e-12)
    # 90 deg about +Y in MuJoCo's wxyz order.
    assert_allclose(xquat[0, arm], [1.0, 0.0, 0.0, 0.0], atol=1e-12)
    assert_allclose(xquat[1, arm], [SQRT_HALF, 0.0, SQRT_HALF, 0.0], atol=1e-12)


def test_poses_from_qpos_rejects_wrong_width(model: mujoco.MjModel) -> None:
    with pytest.raises(ValueError, match="nq"):
        poses_from_qpos(model, np.zeros((3, model.nq + 1)))


def test_interpolate_keyframes_linear_midpoint(model: mujoco.MjModel) -> None:
    keyframes = [
        {"t_ms": 0.0, "joints": {"hinge": 0.0}},
        {"t_ms": 200.0, "joints": {"hinge": np.pi / 2}},
    ]
    qpos = interpolate_keyframes(model, keyframes, fps=10)

    # 200 ms at 10 fps -> frames at 0, 100, 200 ms.
    assert qpos.shape == (3, model.nq)
    assert_allclose(qpos[:, 0], [0.0, np.pi / 4, np.pi / 2], atol=1e-12)


def test_interpolate_keyframes_unspecified_joint_keeps_qpos0(model: mujoco.MjModel) -> None:
    keyframes = [
        {"t_ms": 0.0, "joints": {}},
        {"t_ms": 200.0, "joints": {}},
    ]
    qpos = interpolate_keyframes(model, keyframes, fps=10)
    assert_allclose(qpos, np.tile(model.qpos0, (3, 1)), atol=1e-12)


def test_interpolate_keyframes_clamps_outside_range(model: mujoco.MjModel) -> None:
    keyframes = [
        {"t_ms": 100.0, "joints": {"hinge": 0.5}},
        {"t_ms": 200.0, "joints": {"hinge": 1.0}},
    ]
    qpos = interpolate_keyframes(model, keyframes, fps=10)
    # Frames at 0, 100, 200 ms: t=0 clamps to the first keyframe value.
    assert_allclose(qpos[:, 0], [0.5, 0.5, 1.0], atol=1e-12)


def test_interpolate_keyframes_unknown_joints_raise_listing_names(
    model: mujoco.MjModel,
) -> None:
    keyframes = [
        {"t_ms": 0.0, "joints": {"hinge": 0.0, "nope": 1.0}},
        {"t_ms": 50.0, "joints": {"also_bad": 2.0}},
    ]
    with pytest.raises(ValueError) as excinfo:
        interpolate_keyframes(model, keyframes)
    message = str(excinfo.value)
    assert "nope" in message
    assert "also_bad" in message
    assert "hinge" not in message


def test_to_gltf_frame_maps_zup_to_yup() -> None:
    xpos = np.array([[[0.0, 0.0, 1.0], [1.0, 2.0, 3.0]]])
    xquat = np.array([[[1.0, 0.0, 0.0, 0.0], [1.0, 0.0, 0.0, 0.0]]])
    translations, rotations = to_gltf_frame(xpos, xquat, scale=1.0)

    # -90 deg about X: (x, y, z) -> (x, z, -y); MuJoCo +Z becomes glTF +Y.
    assert_allclose(translations[0, 0], [0.0, 1.0, 0.0], atol=1e-12)
    assert_allclose(translations[0, 1], [1.0, 3.0, -2.0], atol=1e-12)
    # Identity orientation becomes the frame-conversion rotation, in xyzw order.
    assert_allclose(rotations[0, 0], [-SQRT_HALF, 0.0, 0.0, SQRT_HALF], atol=1e-12)


def test_to_gltf_frame_applies_scale_to_translations() -> None:
    xpos = np.array([[[0.0, 0.0, 2.0]]])
    xquat = np.array([[[1.0, 0.0, 0.0, 0.0]]])
    translations, _ = to_gltf_frame(xpos, xquat, scale=0.5)
    assert_allclose(translations[0, 0], [0.0, 1.0, 0.0], atol=1e-12)


def test_to_gltf_frame_quaternions_unit_length(model: mujoco.MjModel) -> None:
    qpos = np.array([[0.0], [np.pi / 2], [np.pi / 3]])
    xpos, xquat = poses_from_qpos(model, qpos)
    _, rotations = to_gltf_frame(xpos, xquat, scale=1.0)

    assert rotations.shape == (3, model.nbody, 4)
    norms = np.linalg.norm(rotations, axis=-1)
    assert_allclose(norms, np.ones_like(norms), atol=1e-9)

    # The pose is rotated -90 deg about X: q' = r_frame * q (premultiply),
    # matching translations x' = C * x. A 90 deg hinge about MuJoCo +Y then
    # reorients the body to 120 deg about axis (-1, 1, -1)/sqrt(3) in glTF.
    arm = _arm_id(model)
    assert_allclose(rotations[1, arm], [-0.5, 0.5, -0.5, 0.5], atol=1e-12)
