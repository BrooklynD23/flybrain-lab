import mujoco
import numpy as np
import pytest

from flybrain_pipeline.body_mesh import body_meshes, decimate_to_budget, to_nodes

# Unit tetrahedron; MuJoCo recenters it, geom_pos compensates.
_TET = 'vertex="0 0 0  1 0 0  0 1 0  0 0 1" face="0 2 1  0 1 3  0 3 2  1 2 3"'
_XML = f"""
<mujoco>
  <asset>
    <mesh name="t" {_TET}/>
  </asset>
  <worldbody>
    <body name="a" pos="0 0 0">
      <geom type="mesh" mesh="t" pos="5 0 0" group="1"/>
      <geom type="mesh" mesh="t" pos="0 5 0" group="2"/>
      <body name="b" pos="1 0 0">
        <geom type="mesh" mesh="t" group="1"/>
      </body>
      <body name="empty" pos="0 1 0">
        <geom type="sphere" size="0.1"/>
      </body>
    </body>
  </worldbody>
</mujoco>
"""


@pytest.fixture
def model():
    return mujoco.MjModel.from_xml_string(_XML)


def test_two_bodies_skip_non_mesh(model):
    m = body_meshes(model)
    assert set(m) == {"a", "b"}
    assert len(m["a"][1]) == 8  # two geoms x 4 faces
    assert len(m["b"][1]) == 4


def test_geom_offset_applied(model):
    verts, faces = body_meshes(model, {1})["a"]
    assert len(faces) == 4
    # centroid of tetra (0.25 each) shifted by geom_pos (5,0,0)
    np.testing.assert_allclose(verts.mean(axis=0), [5.25, 0.25, 0.25], atol=1e-5)


def test_group_filter(model):
    only2 = body_meshes(model, {2})
    assert set(only2) == {"a"}
    np.testing.assert_allclose(only2["a"][0].mean(axis=0), [0.25, 5.25, 0.25], atol=1e-5)


def _grid(n):
    xs, ys = np.meshgrid(np.arange(n), np.arange(n))
    v = np.c_[xs.ravel(), ys.ravel(), np.sin(xs.ravel() * 0.3)].astype(np.float32)
    f = []
    for i in range(n - 1):
        for j in range(n - 1):
            k = i * n + j
            f += [[k, k + 1, k + n], [k + 1, k + n + 1, k + n]]
    return v, np.array(f, dtype=np.uint32)


def test_decimation_budget_and_min_faces():
    big, small = _grid(60), _grid(3)
    meshes = {"big": big, "small": small}
    out = decimate_to_budget(meshes, max_tris=1000)
    total = sum(len(f) for _, f in out.values())
    assert total <= 1100
    assert len(out["small"][1]) > 0
    assert 0 < len(out["big"][1]) < len(big[1])


def test_decimation_under_budget_unchanged():
    meshes = {"s": _grid(4)}
    out = decimate_to_budget(meshes, max_tris=1000)
    assert len(out["s"][1]) == len(meshes["s"][1])


def test_inputs_not_mutated():
    v, f = _grid(30)
    v0, f0 = v.copy(), f.copy()
    decimate_to_budget({"x": (v, f)}, max_tris=100)
    np.testing.assert_array_equal(v, v0)
    np.testing.assert_array_equal(f, f0)


def test_to_nodes(model):
    nodes = to_nodes(body_meshes(model))
    assert [n.name for n in nodes] == ["a", "b"]
    assert nodes[0].mesh.positions.dtype == np.float32
    assert nodes[0].mesh.indices.dtype == np.uint32
