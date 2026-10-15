import numpy as np
import pandas as pd
import pytest

from flybrain_pipeline import brain_neuropils as bn
from flybrain_pipeline import glb


def _grid(n=20, size=1000.0, off=0.0):
    xs, ys = np.meshgrid(np.arange(n), np.arange(n))
    v = np.c_[xs.ravel(), ys.ravel(), np.sin(xs.ravel() / 3)] * size / n + off
    f = []
    for i in range(n - 1):
        for j in range(n - 1):
            a = i * n + j
            f += [[a, a + 1, a + n], [a + 1, a + n + 1, a + n]]
    return v.astype(np.float32), np.array(f, dtype=np.uint32)


def test_fetch_roundtrip(tmp_path):
    calls = []

    def getter(i):
        calls.append(i)
        return _grid(5, off=len(calls))

    out = tmp_path / "m.npz"
    bn.fetch_neuropil_meshes(["AL_L", "MB_R"], out, getter=getter)
    assert calls == ["AL_L", "MB_R"]
    got = bn.load_meshes(out)
    assert set(got) == {"AL_L", "MB_R"}
    assert got["MB_R"][1].shape[1] == 3


def test_fetch_empty_mesh_rejected(tmp_path):
    with pytest.raises(ValueError, match="AL"):
        bn.fetch_neuropil_meshes(
            ["AL"], tmp_path / "m.npz", getter=lambda i: (np.zeros((0, 3)), np.zeros((0, 3)))
        )


def _feather(tmp_path):
    rng = np.random.default_rng(1)
    df = pd.DataFrame(
        {
            "np": ["A"] * 5000 + ["B"] * 10,
            "x": rng.random(5010) * 1e5,
            "y": rng.random(5010) * 1e5,
            "z": rng.random(5010) * 1e5,
        }
    )
    p = tmp_path / "s.feather"
    df.to_feather(p)
    return p


def test_points_cap_and_determinism(tmp_path):
    p = _feather(tmp_path)
    cols = {"neuropil": "np", "x": "x", "y": "y", "z": "z"}
    a = bn.points_from_synapses(p, cols, per_neuropil=2000, seed=0)
    b = bn.points_from_synapses(p, cols, per_neuropil=2000, seed=0)
    c = bn.points_from_synapses(p, cols, per_neuropil=2000, seed=1)
    assert a["A"].shape == (2000, 3) and a["B"].shape == (10, 3)
    np.testing.assert_array_equal(a["A"], b["A"])
    assert not np.array_equal(a["A"], c["A"])


def test_points_missing_column(tmp_path):
    with pytest.raises(KeyError):
        bn.points_from_synapses(
            _feather(tmp_path), {"neuropil": "np", "x": "x", "y": "y", "z": "nope"}
        )


def test_frame_bounds():
    pts = {"a": np.array([[0, 0, 0], [4e5, 1e5, 2e5]], float), "b": np.array([[1e5, 5e4, 1e5]])}
    c, s = bn.brain_frame(pts)
    allp = np.concatenate(list(pts.values()))
    m = (allp - c) * s
    assert m.min() >= -1 - 1e-9 and m.max() <= 1 + 1e-9
    assert np.isclose(np.abs(m).max(), 1.0)
    with pytest.raises(ValueError):
        bn.brain_frame({})


def test_nodes_mesh_budget():
    meshes = {"big": _grid(40), "small": _grid(10)}
    before = {k: v[0].copy() for k, v in meshes.items()}
    nodes, kind = bn.to_nodes(meshes, (np.zeros(3), 0.001), max_tris=800)
    assert kind == "mesh"
    assert {n.name for n in nodes} == {"big", "small"}
    assert sum(len(n.mesh.indices) for n in nodes) <= 800
    assert all(len(n.mesh.indices) > 0 for n in nodes)
    np.testing.assert_array_equal(meshes["big"][0], before["big"])


def test_nodes_points():
    pts = {"A": np.random.default_rng(0).random((30, 3)) * 1e5}
    nodes, kind = bn.to_nodes(pts, (np.zeros(3), 1e-5))
    assert kind == "points"
    assert isinstance(nodes[0].mesh, glb.Lines)
    assert nodes[0].mesh.positions.max() <= 1.0
    assert nodes[0].mesh.indices.shape == (30, 2)


def test_nodes_empty():
    with pytest.raises(ValueError):
        bn.to_nodes({}, (np.zeros(3), 1.0))
