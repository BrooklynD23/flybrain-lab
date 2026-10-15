"""Synthetic fixture assets for the web app's fallback data set.

``build_fixtures`` writes tiny, deterministic stand-ins for the real
FlyWire/flybody assets into ``public/fixtures/``:

- ``brain.glb`` — 6 box meshes named with real FlyWire neuropil ids.
- ``neurons.glb`` — 5 polylines named by fake 18-digit root ids.
- ``fly.glb`` — 4 box bodies plus one procedural sine animation per behavior
  (4000 ms at 30 fps).
- ``activity/<behavior>.bin`` — 80 bins x 11 channels (6 neuropil ids, then
  5 neuron ids) of seeded synthetic rates; each behavior peaks in a
  different neuropil.
- ``manifest.json`` — contract-conformant manifest, ``dataSource:
  "fixture"``, validated against ``schemas/manifest.schema.json``.

Output is byte-identical across runs: fixed seeds, no timestamps, fixed
JSON formatting. Stimulus defaults are copied from RESEARCH-01 §4 and
attribution rows from RESEARCH-03 §1.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

import numpy as np

from flybrain_pipeline import activity, glb, validate

DURATION_MS = 4000
FPS = 30.0
N_BINS = DURATION_MS // activity.BIN_MS  # 80 bins of 50 ms

NEUROPIL_IDS: tuple[str, ...] = ("AL_L", "AL_R", "AMMC_L", "GNG", "PRW", "LO_R")

# Rough, synthetic neuropil positions (glTF Y-up, arbitrary units).
_NEUROPIL_POS: dict[str, tuple[float, float, float]] = {
    "AL_L": (-0.9, 0.3, 0.1),
    "AL_R": (0.9, 0.3, 0.1),
    "AMMC_L": (-0.7, -0.1, 0.5),
    "GNG": (0.0, -0.5, 0.3),
    "PRW": (0.0, 0.1, -0.5),
    "LO_R": (0.8, 0.0, -0.2),
}

BEHAVIOR_IDS: tuple[str, ...] = ("walking", "grooming", "feeding", "escape")

BEHAVIOR_LABELS: dict[str, str] = {
    "walking": "Walking",
    "grooming": "Grooming",
    "feeding": "Feeding",
    "escape": "Escape response",
}

# RESEARCH-01 §3: walking/escape replay recorded kinematics; grooming and
# feeding are keyframed.
CLIP_SOURCE: dict[str, str] = {
    "walking": "reference-replay",
    "escape": "reference-replay",
    "grooming": "keyframed",
    "feeding": "keyframed",
}

# Each behavior's synthetic activity peaks in a different neuropil:
# escape -> lobula (visual looming), grooming -> AMMC (antennal JO afferents),
# feeding -> gnathal ganglia (taste), walking -> prow.
PEAK_NEUROPIL: dict[str, str] = {
    "walking": "PRW",
    "grooming": "AMMC_L",
    "feeding": "GNG",
    "escape": "LO_R",
}

# Stimulus defaults copied from RESEARCH-01 §4 (sources: RESEARCH-03 §3).
STIMULUS: dict[str, dict] = {
    "walking": {
        "description": (
            "P9 descending neurons activated. Assumed stimulus: this is not "
            "one of the Shiu et al. model's own experiments."
        ),
        "cellTypes": ["P9"],
        "assumption": True,
        "source": "Bidaye et al. 2020, Neuron",
    },
    "grooming": {
        "description": (
            "Johnston's organ JO-C/JO-E mechanosensory neurons activated (antennal grooming)."
        ),
        "cellTypes": ["JO-C", "JO-E"],
        "assumption": False,
        "source": "Shiu et al. 2024, https://www.nature.com/articles/s41586-024-07763-9",
    },
    "feeding": {
        "description": (
            "neu_sugar sugar gustatory receptor neurons activated; MN9 motor "
            "neuron readout (the model's own example experiment)."
        ),
        "cellTypes": ["sugar GRN", "MN9"],
        "assumption": False,
        "source": (
            "Shiu et al. 2024 example.ipynb, https://github.com/philshiu/Drosophila_brain_model"
        ),
    },
    "escape": {
        "description": (
            "LC4 and LPLC2 looming detectors activated, upstream of the giant "
            "fiber. Assumed stimulus: this is not one of the Shiu et al. "
            "model's own experiments."
        ),
        "cellTypes": ["LC4", "LPLC2"],
        "assumption": True,
        "source": "von Reyn et al. 2014; Ache et al. 2019",
    },
}

# Attribution rows copied from RESEARCH-03 §1 (the data sources these
# fixtures stand in for).
ATTRIBUTION: list[dict] = [
    {
        "name": "FlyWire data (meshes, annotations, Codex)",
        "licence": "CC BY-NC 4.0",
        "url": "https://flywire.ai",
        "citation": (
            "Dorkenwald et al. (2024) Neuronal wiring diagram of an adult "
            "brain. Nature. doi:10.1038/s41586-024-07558-y; Schlegel et al. "
            "(2024) Whole-brain annotation and multi-connectome cell typing "
            "of Drosophila. Nature"
        ),
    },
    {
        "name": "FlyWire connectivity release (Zenodo 10676866, v783)",
        "licence": "CC BY 4.0",
        "url": "https://zenodo.org/records/10676866",
        "citation": "Dorkenwald et al. 2024 and Zenodo record 10676866",
    },
    {
        "name": "Shiu et al. Drosophila brain model",
        "licence": "MIT",
        "url": "https://github.com/philshiu/Drosophila_brain_model",
        "citation": (
            "Shiu et al. (2024) A Drosophila computational brain model "
            "reveals sensorimotor processing. Nature. "
            "https://www.nature.com/articles/s41586-024-07763-9"
        ),
    },
    {
        "name": "flybody model, meshes, datasets",
        "licence": "Apache-2.0",
        "url": "https://github.com/TuragaLab/flybody",
        "citation": (
            "Vaxenburg et al. (2025) Whole-body physics simulation of fruit "
            "fly locomotion. Nature 643. doi:10.1038/s41586-025-09029-4"
        ),
    },
    {
        "name": "MuJoCo",
        "licence": "Apache-2.0",
        "url": "https://github.com/google-deepmind/mujoco",
        "citation": (
            "Todorov, Erez, Tassa (2012) MuJoCo: A physics engine for "
            "model-based control. IROS. doi:10.1109/IROS.2012.6386109"
        ),
    },
]

# Fake 18-digit FlyWire-style root ids (not real neurons). Each fixture
# neuron sits in the neuropil its cell type drives for its behavior.
_NEURONS: tuple[dict, ...] = (
    {
        "id": "720575940621000001",
        "name": "fixture P9-like descending neuron",
        "cellType": "P9",
        "neuropil": "PRW",
    },
    {
        "id": "720575940621000002",
        "name": "fixture JO-C mechanosensory neuron",
        "cellType": "JO-C",
        "neuropil": "AMMC_L",
    },
    {
        "id": "720575940621000003",
        "name": "fixture sugar gustatory receptor neuron",
        "cellType": "sugar GRN",
        "neuropil": "GNG",
    },
    {
        "id": "720575940621000004",
        "name": "fixture MN9-like motor neuron",
        "cellType": "MN9",
        "neuropil": "GNG",
    },
    {
        "id": "720575940621000005",
        "name": "fixture LC4 looming detector",
        "cellType": "LC4",
        "neuropil": "LO_R",
    },
)

CHANNELS: tuple[str, ...] = NEUROPIL_IDS + tuple(n["id"] for n in _NEURONS)

# Procedural clip parameters: sine amplitudes (rad / units) and rates (Hz).
_CLIP_PARAMS: dict[str, dict[str, float]] = {
    "walking": {
        "wing_amp": 0.12,
        "wing_hz": 3.0,
        "yaw_amp": 0.05,
        "yaw_hz": 1.0,
        "bob": 0.015,
        "bob_hz": 6.0,
        "roll": 0.03,
    },
    "grooming": {
        "wing_amp": 0.04,
        "wing_hz": 0.5,
        "yaw_amp": 0.5,
        "yaw_hz": 2.5,
        "bob": 0.008,
        "bob_hz": 1.0,
        "roll": 0.02,
    },
    "feeding": {
        "wing_amp": 0.03,
        "wing_hz": 0.3,
        "yaw_amp": 0.15,
        "yaw_hz": 1.2,
        "bob": 0.010,
        "bob_hz": 2.0,
        "roll": 0.01,
    },
    "escape": {
        "wing_amp": 0.70,
        "wing_hz": 9.0,
        "yaw_amp": 0.10,
        "yaw_hz": 5.0,
        "bob": 0.060,
        "bob_hz": 4.5,
        "roll": 0.10,
    },
}

_BODY_POS: dict[str, tuple[float, float, float]] = {
    "thorax": (0.0, 0.0, 0.0),
    "head": (0.35, 0.08, 0.0),
    "wing_left": (0.05, 0.10, -0.20),
    "wing_right": (0.05, 0.10, 0.20),
}

_BODY_SIZE: dict[str, tuple[float, float, float]] = {
    "thorax": (0.50, 0.25, 0.30),
    "head": (0.18, 0.18, 0.18),
    "wing_left": (0.45, 0.02, 0.28),
    "wing_right": (0.45, 0.02, 0.28),
}

# Fixed per-behavior seeds keep the synthetic activity byte-identical.
_BEHAVIOR_SEED: dict[str, int] = {
    behavior: 20261014 + index for index, behavior in enumerate(BEHAVIOR_IDS)
}

_BOX_POSITIONS = np.array(
    [
        (-1.0, -1.0, -1.0),
        (1.0, -1.0, -1.0),
        (1.0, 1.0, -1.0),
        (-1.0, 1.0, -1.0),
        (-1.0, -1.0, 1.0),
        (1.0, -1.0, 1.0),
        (1.0, 1.0, 1.0),
        (-1.0, 1.0, 1.0),
    ],
    dtype=np.float64,
)

_BOX_INDICES = np.array(
    [
        (0, 2, 1),
        (0, 3, 2),  # z- face
        (4, 5, 6),
        (4, 6, 7),  # z+ face
        (0, 1, 5),
        (0, 5, 4),  # y- face
        (3, 7, 6),
        (3, 6, 2),  # y+ face
        (0, 4, 7),
        (0, 7, 3),  # x- face
        (1, 2, 6),
        (1, 6, 5),  # x+ face
    ],
    dtype=np.uint32,
)


def _box_mesh(name: str, size: tuple[float, float, float]) -> glb.Mesh:
    """Axis-aligned box: 8 vertices, 12 triangles, scaled by ``size``."""
    half = np.asarray(size, dtype=np.float64) / 2.0
    positions = (_BOX_POSITIONS * half).astype(np.float32)
    return glb.Mesh(name=name, positions=positions, indices=_BOX_INDICES.copy())


def _polyline(name: str, points: np.ndarray) -> glb.Lines:
    """glTF line segments (mode 1) for an N-point polyline."""
    positions = np.asarray(points, dtype=np.float32)
    count = positions.shape[0]
    indices = np.stack([np.arange(count - 1), np.arange(1, count)], axis=1).astype(np.uint32)
    return glb.Lines(name=name, positions=positions, indices=indices)


def _build_brain(out: Path) -> None:
    """6 box meshes named by neuropil id, under one root node."""
    nodes = [
        glb.Node(
            name=nid,
            mesh=_box_mesh(nid, (0.30, 0.30, 0.30)),
            translation=_NEUROPIL_POS[nid],
        )
        for nid in NEUROPIL_IDS
    ]
    glb.write_glb(out / "brain.glb", [glb.Node(name="brain", children=nodes)], [])


def _build_neurons(out: Path) -> None:
    """5 wiggly polylines, each named by a fake 18-digit root id."""
    nodes = []
    for k, neuron in enumerate(_NEURONS):
        center = np.asarray(_NEUROPIL_POS[neuron["neuropil"]], dtype=np.float64)
        i = np.arange(8, dtype=np.float64)
        points = center + np.column_stack(
            [
                i * 0.07 - 0.25,
                0.05 * np.sin(i * 1.7 + k),
                0.06 * np.cos(i * 1.3 + k * 2.0),
            ]
        )
        nodes.append(glb.Node(name=neuron["id"], mesh=_polyline(neuron["id"], points)))
    glb.write_glb(out / "neurons.glb", [glb.Node(name="neurons", children=nodes)], [])


def _axis_angle_xyzw(axis: np.ndarray, theta: np.ndarray) -> np.ndarray:
    """Batch axis-angle -> unit quaternions in xyzw order. ``theta``: [T]."""
    half = theta / 2.0
    s = np.sin(half)[:, None]
    c = np.cos(half)[:, None]
    return np.concatenate([axis * s, c], axis=1)


def _clip(name: str, times: np.ndarray, params: dict[str, float]) -> glb.Animation:
    """One behavior clip: procedural sine TRS tracks for all 4 body nodes."""
    t = times.astype(np.float64)
    base = np.asarray(list(_BODY_POS.values()), dtype=np.float64)  # [4,3]
    translations = np.broadcast_to(base, (t.size, 4, 3)).copy()
    rotations = np.zeros((t.size, 4, 4), dtype=np.float64)

    wing_theta = params["wing_amp"] * np.sin(2.0 * np.pi * params["wing_hz"] * t)
    yaw_theta = params["yaw_amp"] * np.sin(2.0 * np.pi * params["yaw_hz"] * t)
    roll_theta = params["roll"] * np.sin(2.0 * np.pi * params["bob_hz"] * t + 0.7)

    # thorax bobs along +Y and rolls about +X
    translations[:, 0, 1] += params["bob"] * np.sin(2.0 * np.pi * params["bob_hz"] * t)
    rotations[:, 0] = _axis_angle_xyzw(np.array([1.0, 0.0, 0.0]), roll_theta)
    # head yaws about +Y
    rotations[:, 1] = _axis_angle_xyzw(np.array([0.0, 1.0, 0.0]), yaw_theta)
    # wings flap about +X, mirrored
    rotations[:, 2] = _axis_angle_xyzw(np.array([1.0, 0.0, 0.0]), wing_theta)
    rotations[:, 3] = _axis_angle_xyzw(np.array([1.0, 0.0, 0.0]), -wing_theta)

    tracks = {node: (translations[:, i, :], rotations[:, i, :]) for i, node in enumerate(_BODY_POS)}
    return glb.Animation(name=name, times=times, tracks=tracks)


def _build_fly(out: Path) -> None:
    """4 box bodies + 4 clips, each 4000 ms at 30 fps (121 frames)."""
    nodes = [
        glb.Node(name=name, mesh=_box_mesh(name, _BODY_SIZE[name]), translation=pos)
        for name, pos in _BODY_POS.items()
    ]
    n_frames = int(round(DURATION_MS * FPS / 1000.0)) + 1
    times = np.arange(n_frames, dtype=np.float64) / FPS  # glTF seconds: 0..4.0
    animations = [_clip(behavior, times, _CLIP_PARAMS[behavior]) for behavior in BEHAVIOR_IDS]
    glb.write_glb(out / "fly.glb", [glb.Node(name="fly", children=nodes)], animations)


def _synthetic_rates(behavior: str) -> np.ndarray:
    """Deterministic [80, 11] Hz rates; peaks in this behavior's neuropil."""
    rng = np.random.default_rng(_BEHAVIOR_SEED[behavior])
    t = (np.arange(N_BINS) + 0.5) * (activity.BIN_MS / 1000.0)  # bin centres, s
    rates = np.zeros((N_BINS, len(CHANNELS)), dtype=np.float64)

    # Neuropil channels: low baselines with a slow wobble.
    for c, _nid in enumerate(NEUROPIL_IDS):
        base = rng.uniform(4.0, 9.0)
        wobble = rng.uniform(0.5, 2.0)
        phase = rng.uniform(0.0, 2.0 * np.pi)
        rates[:, c] = base + wobble * np.sin(2.0 * np.pi * t / 4.0 + phase)

    # The peak neuropil dominates: 28 +/- 20 Hz sinusoid, frequency per behavior.
    frequency = {"walking": 0.5, "grooming": 0.25, "feeding": 0.375, "escape": 0.75}[behavior]
    peak_col = NEUROPIL_IDS.index(PEAK_NEUROPIL[behavior])
    rates[:, peak_col] = 28.0 + 20.0 * np.sin(2.0 * np.pi * frequency * t)

    # Neuron channels: baseline everywhere; the behavior's own stimulus cell
    # types run warmer but stay under the neuropil peak.
    related = {
        "walking": {"P9"},
        "grooming": {"JO-C", "JO-E"},
        "feeding": {"sugar GRN", "MN9"},
        "escape": {"LC4", "LPLC2"},
    }[behavior]
    for j, neuron in enumerate(_NEURONS):
        col = len(NEUROPIL_IDS) + j
        if neuron["cellType"] in related:
            phase = rng.uniform(0.0, 2.0 * np.pi)
            rates[:, col] = 15.0 + 8.0 * np.sin(2.0 * np.pi * t / 4.0 + phase)
        else:
            rates[:, col] = rng.uniform(3.0, 8.0)
    return rates.astype(np.float32)


def _build_activity(out: Path) -> dict[str, dict]:
    """Write activity/<behavior>.bin; return behavior id -> ActivityInfo."""
    channel_map = {name: [] for name in CHANNELS}  # only keys are used here
    infos: dict[str, dict] = {}
    for behavior in BEHAVIOR_IDS:
        rates = _synthetic_rates(behavior)
        data, _max_hz = activity.quantize(rates)
        url = f"activity/{behavior}.bin"
        (out / url).write_bytes(data)
        infos[behavior] = activity.activity_info(url, channel_map, rates)
    return infos


def _manifest(activity_infos: dict[str, dict]) -> dict:
    return {
        "version": 1,
        "dataSource": "fixture",
        "brain": {
            "neuropils": {
                "url": "brain.glb",
                "kind": "mesh",
                "ids": list(NEUROPIL_IDS),
            },
            "neurons": {
                "url": "neurons.glb",
                "items": [dict(item) for item in _NEURONS],
            },
        },
        "body": {"url": "fly.glb"},
        "behaviors": [
            {
                "id": behavior,
                "label": BEHAVIOR_LABELS[behavior],
                "durationMs": DURATION_MS,
                "clipSource": CLIP_SOURCE[behavior],
                "activity": activity_infos[behavior],
                "narrationUrl": f"/narration/{behavior}.json",
                "stimulus": dict(STIMULUS[behavior]),
            }
            for behavior in BEHAVIOR_IDS
        ],
        "attribution": [dict(entry) for entry in ATTRIBUTION],
    }


def _find_schema_dir() -> Path:
    """Locate the repo ``schemas/`` dir from this file or the cwd."""
    for base in (Path(__file__).resolve(), Path.cwd().resolve()):
        for parent in (base, *base.parents):
            candidate = parent / "schemas" / "manifest.schema.json"
            if candidate.is_file():
                return candidate.parent
    return Path("schemas")


def build_fixtures(out: Path, schema_dir: Path | None = None) -> None:
    """Write every fixture asset under ``out`` and validate the manifest.

    Raises ``ValueError`` listing schema errors when the emitted
    ``manifest.json`` fails ``schemas/manifest.schema.json``.
    """
    out = Path(out)
    (out / "activity").mkdir(parents=True, exist_ok=True)

    _build_brain(out)
    _build_neurons(out)
    _build_fly(out)
    activity_infos = _build_activity(out)

    manifest_path = out / "manifest.json"
    manifest_path.write_text(
        json.dumps(_manifest(activity_infos), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    schema_dir = schema_dir if schema_dir is not None else _find_schema_dir()
    errors = validate.validate_file(manifest_path, "manifest", schema_dir)
    if errors:
        raise ValueError("manifest.json failed schema validation:\n" + "\n".join(errors))


def main(argv: Sequence[str] | None = None) -> int:
    """CLI entry point: ``python -m flybrain_pipeline.fixtures --out DIR``."""
    parser = argparse.ArgumentParser(
        prog="python -m flybrain_pipeline.fixtures",
        description="Write tiny deterministic synthetic fixture assets.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("public/fixtures"),
        help="output directory (default: public/fixtures)",
    )
    parser.add_argument(
        "--schema-dir",
        type=Path,
        default=None,
        help="directory holding manifest.schema.json (default: auto-detect)",
    )
    args = parser.parse_args(argv)
    build_fixtures(args.out, args.schema_dir)
    print(f"wrote fixture assets to {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
