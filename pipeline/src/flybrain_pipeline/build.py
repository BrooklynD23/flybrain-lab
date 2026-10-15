"""`flybrain build` and `flybrain fetch-brain`: raw inputs -> validated static assets.

Reads only from ``--raw`` (layout: PLAN-01 §2b) and writes ``fly.glb``, ``brain.glb``,
``neurons.glb``, ``activity/<behavior>.bin`` and ``manifest.json``. Output goes to a temp
dir next to ``--out`` and is swapped in only after validation and the budget check pass.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import tomllib
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

import h5py
import mujoco
import numpy as np
import pandas as pd

from flybrain_pipeline import (
    activity,
    body_clips,
    body_mesh,
    brain_neurons,
    brain_neuropils,
    budget,
    fixtures,
    glb,
    validate,
)

PIPELINE = Path(__file__).parents[2]
REPO_ROOT = PIPELINE.parent
DEFAULT_RAW = Path("pipeline/data/raw")
DEFAULT_OUT = Path("public/data")

BEHAVIORS = fixtures.BEHAVIOR_IDS
FPS = 30.0
N_FRAMES = fixtures.DURATION_MS * 30 // 1000 + 1  # 121 frames cover 0..4000 ms inclusive

# Reference-replay behaviors: dataset folder under raw/body and whether the clip loops.
_REFERENCE_DIR = {"walking": "walking", "escape": "flight"}
_CYCLIC = {"walking": True, "escape": False}
# UNVERIFIED against the real imitation datasets (HUMAN-05): dataset key and source fps.
_H5_KEY = "qpos"
_SRC_FPS = 200.0
# UNVERIFIED column names of the Zenodo tables (HUMAN-05).
_COUNT_COLS = {"id_col": "root_id", "neuropil_col": "neuropil", "count_col": "count"}
_SYN_COLUMNS = {"neuropil": "neuropil", "x": "x", "y": "y", "z": "z"}
_GLBS = ("fly.glb", "brain.glb", "neurons.glb")


class BuildError(Exception):
    """Build failed; ``errors`` holds one message per problem."""

    def __init__(self, errors: Sequence[str]) -> None:
        self.errors = list(errors)
        super().__init__("\n".join(self.errors))


@dataclass(frozen=True)
class BuildConfig:
    fixture_raw: bool = False
    points: bool = False
    neuron_lines: bool = True


# --- inputs -----------------------------------------------------------------------------


def _config_file(raw: Path, name: str, default: Path) -> Path:
    override = raw / "config" / name
    return override if override.is_file() else default


def _stimuli(raw: Path) -> dict:
    path = _config_file(raw, "stimuli.json", PIPELINE / "sims" / "shiu" / "stimuli.json")
    return json.loads(path.read_text(encoding="utf-8"))


def _spikes(raw: Path) -> dict[str, pd.DataFrame]:
    return {b: pd.read_parquet(raw / "spikes" / f"{b}.parquet") for b in BEHAVIORS}


def _annotations(raw: Path) -> pd.DataFrame:
    return pd.read_csv(raw / "brain" / "annotations.tsv", sep="\t")


def _counts(raw: Path) -> pd.DataFrame:
    return pd.read_feather(raw / "brain" / "per_neuron_neuropil_count_post_783.feather")


def _select(raw: Path, cap: int = 400) -> list[int]:
    """Curated root ids (sorted): every stimulus neuron, then the most active ones."""
    annotations = _annotations(raw)
    stimulus: set[int] = set()
    for s in _stimuli(raw).values():
        stimulus.update(int(i) for i in s.get("root_ids", []))
        in_types = annotations["cell_type"].isin(s.get("cell_types", []))
        stimulus.update(int(i) for i in annotations.loc[in_types, "root_id"])
    chosen = brain_neurons.select_neurons(_spikes(raw), sorted(stimulus), [], cap)
    return sorted(chosen)


def _curated(raw: Path) -> list[int]:
    saved = raw / "brain" / "selected_neurons.json"
    if saved.is_file():
        return sorted(int(i) for i in json.loads(saved.read_text(encoding="utf-8")))
    return _select(raw)


# --- body -------------------------------------------------------------------------------


def _reference_qpos(raw: Path, behavior: str) -> np.ndarray:
    folder = raw / "body" / _REFERENCE_DIR[behavior]
    files = sorted([*folder.glob("*.hdf5"), *folder.glob("*.h5")])
    if not files:
        raise BuildError([f"no *.hdf5 or *.h5 file in {folder}"])
    with h5py.File(files[0], "r") as f:
        n_frames = f[_H5_KEY].shape[0]
    qpos = body_clips.load_reference_qpos(files[0], _H5_KEY, 0, n_frames, _SRC_FPS, FPS)
    return body_clips.loop_or_clamp(qpos, N_FRAMES, cyclic=_CYCLIC[behavior])


def _body(raw: Path) -> tuple[list[glb.Node], list[glb.Animation]]:
    model = mujoco.MjModel.from_xml_path(
        str(raw / "body/flybody/flybody/fruitfly/assets/fruitfly.xml")
    )
    scale = 1.0 / float(model.stat.extent)
    meshes = {
        name: (verts * np.float32(scale), faces)
        for name, (verts, faces) in body_mesh.decimate_to_budget(
            body_mesh.body_meshes(model)
        ).items()
    }
    keyframes_path = _config_file(raw, "keyframes.toml", PIPELINE / "config" / "keyframes.toml")
    keyframes = tomllib.loads(keyframes_path.read_text(encoding="utf-8"))
    animations = []
    for behavior in BEHAVIORS:
        if behavior in _REFERENCE_DIR:
            qpos = _reference_qpos(raw, behavior)
        else:
            keyed = body_clips.keyframed_qpos(model, keyframes[behavior], FPS)
            qpos = body_clips.loop_or_clamp(keyed, N_FRAMES, cyclic=False)
        clip = body_clips.make_clip(model, behavior, qpos, FPS, scale)
        # Bodies without a visual mesh have no node; glb.write_glb rejects tracks for them.
        tracks = {k: v for k, v in clip.tracks.items() if k in meshes}
        animations.append(glb.Animation(name=behavior, times=clip.times, tracks=tracks))
    return body_mesh.to_nodes(meshes), animations


# --- brain ------------------------------------------------------------------------------


def _neuropils(raw: Path, config: BuildConfig):
    if config.points:
        data = brain_neuropils.points_from_synapses(
            raw / "brain" / "flywire_synapses_783.feather", _SYN_COLUMNS
        )
        frame = brain_neuropils.brain_frame(data)
    else:
        data = dict(sorted(brain_neuropils.load_meshes(raw / "brain" / "neuropils.npz").items()))
        frame = brain_neuropils.brain_frame({k: v for k, (v, _) in data.items()})
    nodes, kind = brain_neuropils.to_nodes(data, frame)
    return nodes, kind, frame


def _neuron_nodes(raw: Path, curated: Sequence[int], frame, config: BuildConfig) -> list[glb.Node]:
    if not config.neuron_lines:
        return []
    skeletons = brain_neurons.load_skeletons(raw / "brain" / "skeletons.npz")
    missing = [str(i) for i in curated if str(i) not in skeletons]
    if missing:
        raise BuildError([f"no skeleton for neurons: {', '.join(missing)}"])
    chosen = {str(i): skeletons[str(i)] for i in curated}
    return brain_neurons.to_nodes(brain_neurons.simplify_lines(chosen), frame)


# --- assembly ---------------------------------------------------------------------------


def _write_activity(raw: Path, tmp: Path, channels: dict[str, list[int]]) -> dict[str, dict]:
    (tmp / "activity").mkdir()
    infos = {}
    for behavior, spikes in _spikes(raw).items():
        rates = activity.bin_rates(spikes, channels, fixtures.DURATION_MS)
        data, _ = activity.quantize(rates)
        url = f"activity/{behavior}.bin"
        (tmp / url).write_bytes(data)
        infos[behavior] = activity.activity_info(url, channels, rates)
    return infos


def _manifest(
    config: BuildConfig, kind: str, neuropil_ids: list[str], infos: list[dict], act: dict, stimuli
) -> dict:
    behaviors = []
    for b in BEHAVIORS:
        stimulus = {
            **fixtures.STIMULUS[b],
            "cellTypes": list(stimuli[b].get("cell_types") or fixtures.STIMULUS[b]["cellTypes"]),
            "assumption": bool(stimuli[b]["assumption"]),
            "source": stimuli[b]["source"],
        }
        behaviors.append(
            {
                "id": b,
                "label": fixtures.BEHAVIOR_LABELS[b],
                "durationMs": fixtures.DURATION_MS,
                "clipSource": fixtures.CLIP_SOURCE[b],
                "activity": act[b],
                "narrationUrl": f"/narration/{b}.json",
                "stimulus": stimulus,
            }
        )
    return {
        "version": 1,
        "dataSource": "fixture" if config.fixture_raw else "flywire-783",
        "brain": {
            "neuropils": {"url": "brain.glb", "kind": kind, "ids": neuropil_ids},
            "neurons": {"url": "neurons.glb", "items": infos},
        },
        "body": {"url": "fly.glb"},
        "behaviors": behaviors,
        "attribution": [dict(row) for row in fixtures.ATTRIBUTION],
    }


def _gltf_transform(*args: str) -> None:
    cmd = ["npx", "--no-install", "gltf-transform", *args]
    try:
        subprocess.run(cmd, cwd=REPO_ROOT, check=True, capture_output=True, text=True)
    except (subprocess.CalledProcessError, OSError) as exc:
        detail = getattr(exc, "stderr", None) or exc
        raise BuildError([f"gltf-transform {args[0]} failed: {detail}"]) from exc


def _compress(tmp: Path) -> None:
    for name in _GLBS:
        src, opt = tmp / name, tmp / f"opt-{name}"  # gltf-transform picks format by extension
        _gltf_transform("optimize", str(src), str(opt), "--compress", "meshopt")
        opt.replace(src)
        _gltf_transform("validate", str(src))


def _assemble(raw: Path, tmp: Path, config: BuildConfig, compress: bool) -> None:
    stimuli = _stimuli(raw)
    body_nodes, animations = _body(raw)
    glb.write_glb(tmp / "fly.glb", body_nodes, animations)

    neuropil_nodes, kind, frame = _neuropils(raw, config)
    glb.write_glb(tmp / "brain.glb", neuropil_nodes, [])
    neuropil_ids = sorted(n.name for n in neuropil_nodes)

    curated = _curated(raw)
    glb.write_glb(tmp / "neurons.glb", _neuron_nodes(raw, curated, frame, config), [])
    primary = brain_neurons.primary_neuropil(_counts(raw), **_COUNT_COLS)
    channels = brain_neurons.channel_map(primary, neuropil_ids, curated)
    infos = brain_neurons.neuron_infos(curated, _annotations(raw), primary)

    act = _write_activity(raw, tmp, channels)
    if compress:
        _compress(tmp)
    manifest_path = tmp / "manifest.json"
    manifest = _manifest(config, kind, neuropil_ids, infos, act, stimuli)
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )

    errors = validate.validate_file(manifest_path, "manifest", fixtures._find_schema_dir())
    errors += budget.check(tmp)
    if errors:
        raise BuildError(errors)


def build(raw_dir: Path, out_dir: Path, config: BuildConfig, compress: bool = True) -> Path:
    """Build all assets into ``out_dir``; the old ``out_dir`` survives any failure."""
    raw, out = Path(raw_dir), Path(out_dir)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix=f".{out.name}.tmp-", dir=out.parent))
    try:
        _assemble(raw, tmp, config, compress)
        tmp.chmod(0o755)
        old = out.with_name(f"{out.name}.old")
        shutil.rmtree(old, ignore_errors=True)
        if out.exists():
            out.rename(old)
        tmp.rename(out)
        shutil.rmtree(old, ignore_errors=True)
    except BaseException:
        shutil.rmtree(tmp, ignore_errors=True)
        raise
    return out


# --- commands ---------------------------------------------------------------------------


def main(argv: Sequence[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="flybrain build", description="Build static assets.")
    p.add_argument("--raw", type=Path, default=DEFAULT_RAW)
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    p.add_argument("--fixture-raw", action="store_true", help="mark dataSource as fixture")
    p.add_argument("--points", action="store_true", help="neuropils as synapse point clouds")
    p.add_argument("--no-neuron-lines", action="store_true", help="omit skeleton lines")
    p.add_argument("--no-compress", action="store_true", help="skip gltf-transform")
    args = p.parse_args(argv)
    config = BuildConfig(args.fixture_raw, args.points, not args.no_neuron_lines)
    try:
        out = build(args.raw, args.out, config, compress=not args.no_compress)
    except (BuildError, OSError, ValueError, KeyError) as exc:
        print(f"build failed:\n{exc}", file=sys.stderr)
        return 1
    print(f"wrote assets to {out}")
    return 0


def fetch_brain_main(argv: Sequence[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        prog="flybrain fetch-brain", description="Select and fetch brain data."
    )
    p.add_argument("--raw", type=Path, default=DEFAULT_RAW)
    p.add_argument("--cap", type=int, default=400)
    p.add_argument("--skip-neuropils", action="store_true")
    p.add_argument("--skip-skeletons", action="store_true")
    args = p.parse_args(argv)
    brain = args.raw / "brain"
    try:
        ids = _select(args.raw, args.cap)
        (brain / "selected_neurons.json").write_text(
            json.dumps([str(i) for i in ids], indent=2) + "\n", encoding="utf-8"
        )
        if not args.skip_neuropils:
            neuropils = sorted(str(n) for n in _counts(args.raw)["neuropil"].unique())
            brain_neuropils.fetch_neuropil_meshes(neuropils, brain / "neuropils.npz")
        if not args.skip_skeletons:
            brain_neurons.fetch_skeletons(ids, brain / "skeletons.npz")
    except (OSError, ValueError, KeyError) as exc:
        print(f"fetch-brain failed: {exc}", file=sys.stderr)
        return 1
    print(f"selected {len(ids)} neurons")
    return 0
