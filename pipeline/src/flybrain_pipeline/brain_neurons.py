"""Curated neurons: primary neuropil, selection, skeletons, line budget, activity channels."""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from pathlib import Path

import numpy as np
import pandas as pd

from flybrain_pipeline import glb
from flybrain_pipeline.brain_neuropils import Frame, _apply

Skeleton = tuple[np.ndarray, np.ndarray]  # positions [N,3], edges [K,2]


def primary_neuropil(
    count_table: pd.DataFrame, id_col: str, neuropil_col: str, count_col: str
) -> pd.Series:
    """Neuropil with the largest count per root id; ties go to the lowest neuropil id."""
    if missing := {id_col, neuropil_col, count_col} - set(count_table.columns):
        raise KeyError(f"columns not in count table: {sorted(missing)}")
    ordered = count_table.sort_values(
        [id_col, count_col, neuropil_col], ascending=[True, False, True]
    )
    return ordered.drop_duplicates(id_col).set_index(id_col)[neuropil_col]


def select_neurons(
    spikes_by_behavior: Mapping[str, pd.DataFrame],
    stimulus_ids: Sequence[int],
    readout_ids: Sequence[int],
    cap: int = 400,
    id_col: str = "flywire_id",
) -> list[int]:
    """Stimulus + readouts, then the most active neurons per behavior, round-robin, up to `cap`."""
    chosen = list(dict.fromkeys([*stimulus_ids, *readout_ids]))
    if len(chosen) > cap:
        raise ValueError(f"{len(chosen)} required neurons exceed cap {cap}")
    ranked = []
    for df in spikes_by_behavior.values():
        counts = df[id_col].value_counts()
        order = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
        ranked.append([int(i) for i, _ in order])
    seen = set(chosen)
    for rank in range(max((len(r) for r in ranked), default=0)):
        for r in ranked:
            if len(chosen) >= cap:
                return chosen
            if rank < len(r) and r[rank] not in seen:
                seen.add(r[rank])
                chosen.append(r[rank])
    return chosen


def _default_getter(root_id: int) -> Skeleton:
    # ponytail: fafbseg name UNVERIFIED; inject `getter` (e.g. navis.skeletonize) if it differs.
    from fafbseg import flywire  # noqa: PLC0415

    sk = flywire.get_skeletons(root_id)
    return np.asarray(sk.nodes[["x", "y", "z"]]), np.asarray(sk.edges)


def fetch_skeletons(
    ids: Sequence[int],
    out_npz: str | Path,
    getter: Callable[[int], Skeleton] | None = None,
) -> None:
    """Save `{id}_v` / `{id}_e` arrays to an npz."""
    get = getter or _default_getter
    arrays: dict[str, np.ndarray] = {}
    for i in ids:
        verts, edges = get(i)
        verts, edges = np.asarray(verts, np.float32), np.asarray(edges, np.uint32)
        if (
            len(verts) == 0
            or len(edges) == 0
            or verts.ndim != 2
            or verts.shape[1] != 3
            or (edges.ndim != 2 or edges.shape[1] != 2)
        ):
            raise ValueError(f"neuron {i}: empty or malformed skeleton")
        arrays[f"{i}_v"], arrays[f"{i}_e"] = verts, edges
    np.savez_compressed(out_npz, **arrays)


def load_skeletons(npz_path: str | Path) -> dict[str, Skeleton]:
    with np.load(npz_path) as z:
        return {k[:-2]: (z[k], z[k[:-2] + "_e"]) for k in z.files if k.endswith("_v")}


def _chains(edges: np.ndarray) -> list[list[int]]:
    """Node paths between kept nodes (degree != 2)."""
    adj: dict[int, list[int]] = {}
    for a, b in edges.tolist():
        adj.setdefault(a, []).append(b)
        adj.setdefault(b, []).append(a)
    keep = {n for n, nb in adj.items() if len(nb) != 2}
    done: set[frozenset[int]] = set()
    chains = []
    # ponytail: pure cycles (no kept node) are dropped; skeletons are trees.
    for start in sorted(keep):
        for nxt in adj[start]:
            if frozenset((start, nxt)) in done:
                continue
            path, prev, cur = [start], start, nxt
            done.add(frozenset((prev, cur)))
            while cur not in keep:
                path.append(cur)
                prev, cur = cur, next(n for n in adj[cur] if n != prev)
                done.add(frozenset((prev, cur)))
            chains.append([*path, cur])
    return chains


def _thin(chains: list[list[int]], stride: int) -> list[tuple[int, int]]:
    out = []
    for c in chains:
        nodes = [c[0], *[n for j, n in enumerate(c[1:-1]) if (j + 1) % stride == 0], c[-1]]
        out.extend(zip(nodes, nodes[1:], strict=False))
    return out


def _compact(pos: np.ndarray, pairs: list[tuple[int, int]]) -> Skeleton:
    used = sorted({n for p in pairs for n in p})
    remap = {n: i for i, n in enumerate(used)}
    edges = np.array([[remap[a], remap[b]] for a, b in pairs], np.uint32)
    return np.asarray(pos, np.float32)[used], edges


def simplify_lines(
    skeletons: Mapping[str, Skeleton], max_segments: int = 290_000
) -> dict[str, Skeleton]:
    """Keep branch points and endpoints; drop intermediate nodes with a growing stride until
    the total segment count fits `max_segments`."""
    chains = {k: _chains(np.asarray(e)) for k, (_, e) in skeletons.items()}
    longest = max((len(c) for cs in chains.values() for c in cs), default=0)
    for stride in range(1, longest + 2):
        pairs = {k: _thin(cs, stride) for k, cs in chains.items()}
        if sum(len(p) for p in pairs.values()) <= max_segments:
            return {k: _compact(skeletons[k][0], p) for k, p in pairs.items()}
    raise ValueError(
        f"cannot fit skeletons in {max_segments} segments (branches/endpoints alone exceed it)"
    )


def to_nodes(skeletons: Mapping[str, Skeleton], frame: Frame) -> list[glb.Node]:
    """One Lines node per neuron, named by root id."""
    if not skeletons:
        raise ValueError("nothing to convert")
    return [
        glb.Node(name=k, mesh=glb.Lines(k, _apply(v, frame), np.asarray(e, np.uint32)))
        for k, (v, e) in skeletons.items()
    ]


def channel_map(
    primary: pd.Series, neuropil_ids: Sequence[str], curated_ids: Sequence[int]
) -> dict[str, list[int]]:
    """Neuropil channel = simulated neurons with that primary neuropil; neuron channel = itself."""
    out = {n: sorted(int(i) for i in primary.index[primary == n]) for n in neuropil_ids}
    return {**out, **{str(i): [int(i)] for i in curated_ids}}


def neuron_infos(
    ids: Sequence[int],
    annotations: pd.DataFrame,
    primary: pd.Series,
    id_col: str = "root_id",
    name_col: str = "name",
    type_col: str = "cell_type",
) -> list[dict]:
    """`NeuronInfo` dicts; raises KeyError for an id missing from annotations or primary."""
    ann = annotations.set_index(id_col)
    out = []
    for i in ids:
        row = ann.loc[i]
        ctype = row[type_col] if pd.notna(row[type_col]) and row[type_col] else "unknown"
        name = row[name_col] if pd.notna(row[name_col]) and row[name_col] else str(i)
        out.append(
            {"id": str(i), "name": str(name), "cellType": str(ctype), "neuropil": str(primary[i])}
        )
    return out
