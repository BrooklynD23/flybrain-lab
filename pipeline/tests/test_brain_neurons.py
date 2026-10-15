import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from jsonschema import Draft202012Validator

from flybrain_pipeline import brain_neurons as bn
from flybrain_pipeline import glb

SCHEMA = Path(__file__).resolve().parents[2] / "schemas" / "manifest.schema.json"
MN9 = 720575940660219265


def test_primary_neuropil_argmax_and_tie():
    df = pd.DataFrame(
        {
            "root_id": [1, 1, 2, 2, 3],
            "neuropil": ["B", "A", "C", "D", "A"],
            "count": [5, 5, 1, 9, 2],
        }
    )
    p = bn.primary_neuropil(df, "root_id", "neuropil", "count")
    assert p.to_dict() == {1: "A", 2: "D", 3: "A"}


def test_primary_neuropil_missing_column():
    with pytest.raises(KeyError):
        bn.primary_neuropil(pd.DataFrame({"a": [1]}), "root_id", "neuropil", "count")


def _spikes(counts):
    return pd.DataFrame({"flywire_id": [i for i, n in counts.items() for _ in range(n)]})


def test_select_neurons_cap_order_required():
    spikes = {
        "walking": _spikes({10: 5, 11: 4, 12: 3}),
        "feeding": _spikes({20: 5, 21: 4, 22: 3}),
    }
    out = bn.select_neurons(spikes, [1, 2], [MN9], cap=7)
    assert out == [1, 2, MN9, 10, 20, 11, 21]
    assert len(set(out)) == len(out)


def test_select_neurons_required_exceed_cap_and_dedupe():
    out = bn.select_neurons({"a": _spikes({1: 3, 5: 2})}, [1], [MN9], cap=10)
    assert out == [1, MN9, 5]
    with pytest.raises(ValueError):
        bn.select_neurons({}, [1, 2], [3], cap=2)


def _skel():
    # branch point at 2 (degree 3), chain 0-1-2, 2-3-4-5-6-7 (endpoint 7), 2-8 (endpoint)
    pos = np.arange(9 * 3, dtype=np.float32).reshape(9, 3)
    edges = np.array([[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [2, 8]], np.uint32)
    return {"1": (pos, edges)}


def test_simplify_keeps_topology_and_budget():
    out = bn.simplify_lines(_skel(), max_segments=5)
    pos, edges = out["1"]
    assert len(edges) <= 5
    deg = np.bincount(edges.ravel(), minlength=len(pos))
    used = deg > 0
    # branch point, endpoints survive: 0, 2, 7, 8
    for p in _skel()["1"][0][[0, 2, 7, 8]]:
        assert any(np.array_equal(p, q) for q in pos[used])
    # still one connected tree
    assert used.sum() == len(edges) + 1


def test_simplify_noop_when_under_budget():
    out = bn.simplify_lines(_skel(), max_segments=100)
    assert len(out["1"][1]) == 8


def test_simplify_impossible_budget():
    with pytest.raises(ValueError):
        bn.simplify_lines(_skel(), max_segments=1)


def test_to_nodes_named_and_framed():
    nodes = bn.to_nodes(_skel(), (np.zeros(3), 0.5))
    assert [n.name for n in nodes] == ["1"]
    assert isinstance(nodes[0].mesh, glb.Lines)
    assert nodes[0].mesh.positions.dtype == np.float32
    assert np.allclose(nodes[0].mesh.positions[1], [1.5, 2, 2.5])


def test_fetch_skeletons_roundtrip(tmp_path):
    seen = []

    def getter(i):
        seen.append(i)
        return _skel()["1"]

    out = tmp_path / "s.npz"
    bn.fetch_skeletons([5, 6], out, getter=getter)
    assert seen == [5, 6]
    got = bn.load_skeletons(out)
    assert set(got) == {"5", "6"}
    assert got["5"][1].shape == (8, 2)


def test_fetch_skeletons_rejects_empty(tmp_path):
    with pytest.raises(ValueError):
        bn.fetch_skeletons(
            [1], tmp_path / "s.npz", getter=lambda i: (np.zeros((0, 3)), np.zeros((0, 2)))
        )


def test_channel_map():
    primary = pd.Series({1: "AL_L", 2: "AL_L", 3: "MB_R", 4: "AL_L"})
    ch = bn.channel_map(primary, ["AL_L", "MB_R", "LH_L"], [4, 3])
    assert ch == {"AL_L": [1, 2, 4], "MB_R": [3], "LH_L": [], "4": [4], "3": [3]}


def test_neuron_infos_validate_against_schema():
    ann = pd.DataFrame({"root_id": [7, 8], "cell_type": ["P9", None], "name": ["P9_left", "x"]})
    primary = pd.Series({7: "GNG", 8: "AL_L"})
    infos = bn.neuron_infos([7, 8], ann, primary)
    schema = json.loads(SCHEMA.read_text())
    item = schema["properties"]["brain"]["properties"]["neurons"]["properties"]["items"]["items"]
    v = Draft202012Validator(item)
    for i in infos:
        assert not list(v.iter_errors(i))
    assert infos[0] == {"id": "7", "name": "P9_left", "cellType": "P9", "neuropil": "GNG"}
    assert infos[1]["cellType"] == "unknown"


def test_neuron_infos_unknown_id():
    with pytest.raises(KeyError):
        bn.neuron_infos(
            [9],
            pd.DataFrame({"root_id": [7], "cell_type": ["a"], "name": ["b"]}),
            pd.Series({9: "X"}),
        )
