"""Tests for `flybrain_pipeline.body_clips`."""

import tomllib
from pathlib import Path

import h5py
import mujoco
import numpy as np
import pytest
from numpy.testing import assert_allclose

from flybrain_pipeline.body_clips import (
    keyframed_qpos,
    load_reference_qpos,
    loop_or_clamp,
    make_clip,
)

MJCF = """
<mujoco>
  <worldbody>
    <body name="arm" pos="0 0 1">
      <joint name="hinge" type="hinge" axis="0 1 0"/>
      <geom type="capsule" size="0.05" fromto="0 0 0 1 0 0"/>
    </body>
  </worldbody>
</mujoco>
"""
KEYFRAMES = Path(__file__).parent.parent / "config" / "keyframes.toml"


@pytest.fixture
def model() -> mujoco.MjModel:
    return mujoco.MjModel.from_xml_string(MJCF)


def _write_h5(path: Path, data: np.ndarray, key: str = "walk/qpos") -> None:
    with h5py.File(path, "w") as f:
        f.create_dataset(key, data=data)


def test_resample_50_to_30_fps_linear(tmp_path: Path) -> None:
    src = np.arange(51, dtype=float)[:, None] * np.array([[1.0, 2.0]])  # 1 s at 50 fps
    h5 = tmp_path / "ref.h5"
    _write_h5(h5, src)
    out = load_reference_qpos(h5, "walk/qpos", start=0, n_frames=50, src_fps=50, fps=30)
    assert out.shape == (30, 2)
    assert_allclose(out[:, 0], np.arange(30) * 50 / 30, atol=1e-9)
    assert_allclose(out[:, 1], 2 * out[:, 0], atol=1e-9)


def test_resample_slerps_root_quaternion(tmp_path: Path) -> None:
    n = 2
    qpos = np.zeros((n, 8))
    qpos[:, 3] = 1.0  # root quat wxyz = identity
    angle = np.pi / 2
    qpos[-1, 3:7] = [np.cos(angle / 2), 0, 0, np.sin(angle / 2)]  # 90 deg about z
    h5 = tmp_path / "ref.h5"
    _write_h5(h5, qpos)
    out = load_reference_qpos(h5, "walk/qpos", start=0, n_frames=n, src_fps=1, fps=2)
    mid = out[1, 3:7]  # t = 0.5 s -> half way: 45 deg about z
    assert_allclose(np.linalg.norm(out[:, 3:7], axis=1), 1.0, atol=1e-9)
    assert_allclose(mid, [np.cos(np.pi / 8), 0, 0, np.sin(np.pi / 8)], atol=1e-9)


def test_load_rejects_bad_inputs(tmp_path: Path) -> None:
    h5 = tmp_path / "ref.h5"
    _write_h5(h5, np.zeros((10, 8)))
    with pytest.raises(KeyError):
        load_reference_qpos(h5, "nope", 0, 5, 50)
    with pytest.raises(ValueError):
        load_reference_qpos(h5, "walk/qpos", 8, 5, 50)
    with pytest.raises(ValueError):
        load_reference_qpos(h5, "walk/qpos", 0, 5, 0)


def test_loop_vs_clamp() -> None:
    qpos = np.arange(3, dtype=float)[:, None]
    assert loop_or_clamp(qpos, 7, cyclic=True)[:, 0].tolist() == [0, 1, 2, 0, 1, 2, 0]
    assert loop_or_clamp(qpos, 5, cyclic=False)[:, 0].tolist() == [0, 1, 2, 2, 2]
    assert loop_or_clamp(qpos, 2, cyclic=True)[:, 0].tolist() == [0, 1]


def test_make_clip_one_track_per_body_120_frames(model: mujoco.MjModel) -> None:
    qpos = keyframed_qpos(
        model,
        {
            "keyframes": [
                {"t_ms": 0, "joints": {"hinge": 0.0}},
                {"t_ms": 3967, "joints": {"hinge": 1.0}},
            ]
        },
    )
    qpos = loop_or_clamp(qpos, 120, cyclic=False)
    clip = make_clip(model, "grooming", qpos, fps=30, scale=1.0)
    assert clip.name == "grooming"
    assert clip.times.shape == (120,)
    assert set(clip.tracks) == {"arm"}  # world body excluded
    t, r = clip.tracks["arm"]
    assert t.shape == (120, 3) and r.shape == (120, 4)


def test_keyframes_toml_valid() -> None:
    cfg = tomllib.loads(KEYFRAMES.read_text())
    assert {"grooming", "feeding", "walking_fallback"} <= set(cfg)
    for name, section in cfg.items():
        times = [k["t_ms"] for k in section["keyframes"]]
        assert times == sorted(times) and len(set(times)) == len(times), name
        assert 0 <= times[0] and times[-1] <= 4000, name
