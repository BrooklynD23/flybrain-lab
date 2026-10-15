"""Check built assets against the asset budget in PLAN-01 §6.

Usage: python -m flybrain_pipeline.budget <asset_dir> [--dist dist]

``asset_dir`` holds the pipeline outputs (manifest.json, brain.glb,
neurons.glb, fly.glb, activity/*.bin, narration/*.json). ``--dist`` points at
the vite build output and adds the JS-bundle gzip budget; when given, the
file-count budget applies to the dist tree (the deployed artifact), otherwise
to ``asset_dir``. Prints a table of every measurement and exits 1 when any
budget is exceeded.
"""

import argparse
import gzip
import json
import struct
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

# PLAN-01 §6 asset budget — numbers copied verbatim; update the doc, not this table.
BUDGET = {
    "total_first_load_gzip_bytes": 15 * 1024**2,  # ≤ 15 MB gzipped
    "js_bundle_gzip_bytes": 600 * 1024,  # ≤ 600 KB gzipped
    "brain_glb_bytes": 3 * 1024**2,  # ≤ 3 MB after meshopt
    "brain_glb_triangles": 150_000,  # ≤ 150k triangles
    "neurons_glb_bytes": 5 * 1024**2,  # ≤ 5 MB after meshopt
    "neurons_glb_segments": 300_000,  # ≤ 300k line segments
    "fly_glb_bytes": 3 * 1024**2,  # ≤ 3 MB
    "fly_glb_triangles": 100_000,  # ≤ 100k triangles
    "activity_bin_bytes": 1 * 1024**2,  # ≤ 1 MB each
    "narration_json_bytes": 20 * 1024,  # ≤ 20 KB each
    "file_bytes": 25 * 1024**2,  # < 25 MiB (Cloudflare Pages limit)
    "file_count": 20_000,  # < 20,000
}

_GLB_MAGIC = 0x46546C67  # "glTF"
_CHUNK_JSON = 0x4E4F534A  # "JSON"
_MODE_LINES = 1
_MODE_TRIANGLES = 4

# glb files with per-mesh primitive budgets: name -> (counted primitive, limit).
_GLB_BUDGETS = {
    "brain.glb": ("triangles", _MODE_TRIANGLES),
    "neurons.glb": ("segments", _MODE_LINES),
    "fly.glb": ("triangles", _MODE_TRIANGLES),
}


@dataclass(frozen=True)
class _Row:
    """One measured budget line: label, actual/limit display, violation if any."""

    label: str
    actual: str
    limit: str
    violation: str | None = None


def _fmt_bytes(n: int) -> str:
    if n >= 1024**2:
        return f"{n / 1024**2:.2f} MiB"
    if n >= 1024:
        return f"{n / 1024:.1f} KiB"
    return f"{n} B"


def _le(label: str, actual: int, limit: int, *, strict: bool = False, fmt=str) -> _Row:
    """Build a row; violation when ``actual > limit`` (``>=`` when ``strict``)."""
    op = "<" if strict else "≤"
    bad = actual >= limit if strict else actual > limit
    violation = f"{label}: {actual} exceeds budget ({op} {limit})" if bad else None
    return _Row(label, fmt(actual), f"{op} {fmt(limit)}", violation)


def _gzip_size(path: Path) -> int:
    """Byte size of ``path`` after gzip (stdlib, deterministic mtime=0)."""
    return len(gzip.compress(path.read_bytes(), compresslevel=9, mtime=0))


def _glb_json(path: Path) -> dict:
    """Return the glb JSON chunk, parsed with struct+json only (no glb.py import)."""
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError("truncated glb header")
    magic, _version, length = struct.unpack_from("<III", data, 0)
    if magic != _GLB_MAGIC or length != len(data):
        raise ValueError("not a glb file")
    chunk_len, chunk_type = struct.unpack_from("<II", data, 12)
    if chunk_type != _CHUNK_JSON or 20 + chunk_len > len(data):
        raise ValueError("first chunk is not JSON")
    return json.loads(data[20 : 20 + chunk_len])


def _primitive_count(gltf: dict, mode: int) -> int:
    """Total triangles (mode 4) or line segments (mode 1) across all mesh primitives."""
    accessors = gltf.get("accessors", [])
    divisor = 3 if mode == _MODE_TRIANGLES else 2
    total = 0
    for mesh in gltf.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            if primitive.get("mode", _MODE_TRIANGLES) != mode:
                continue
            index = primitive.get("indices")
            if index is None:
                index = primitive.get("attributes", {}).get("POSITION")
            if index is None or index >= len(accessors):
                continue
            total += accessors[index].get("count", 0) // divisor
    return total


def _collect(asset_dir: Path, dist_dir: Path | None) -> list[_Row]:
    """Measure every budget line; rows carry violations."""
    if not asset_dir.is_dir():
        return [_Row("asset dir", "missing", "exists", f"asset dir not found: {asset_dir}")]
    if dist_dir is not None and not dist_dir.is_dir():
        return [_Row("dist dir", "missing", "exists", f"dist dir not found: {dist_dir}")]

    asset_files = sorted(p for p in asset_dir.rglob("*") if p.is_file())
    dist_files = (
        sorted(p for p in dist_dir.rglob("*") if p.is_file()) if dist_dir is not None else []
    )
    counted = dist_files if dist_dir is not None else asset_files
    bins = [p for p in asset_files if p.suffix == ".bin" and p.parent.name == "activity"]
    jsons = [p for p in asset_files if p.suffix == ".json" and p.parent.name == "narration"]

    rows: list[_Row] = [
        _le("file count", len(counted), BUDGET["file_count"], strict=True),
    ]

    # Per-file < 25 MiB (Cloudflare Pages limit); row only on violation.
    for p in asset_files + dist_files:
        size = p.stat().st_size
        rel = p.relative_to(asset_dir) if p.is_relative_to(asset_dir) else p.name
        row = _le(str(rel), size, BUDGET["file_bytes"], strict=True, fmt=_fmt_bytes)
        if row.violation:
            rows.append(row)

    # glb byte size + primitive counts.
    for p in asset_files:
        spec = _GLB_BUDGETS.get(p.name)
        if spec is None:
            continue
        kind, mode = spec
        rows.append(
            _le(
                f"{p.name} bytes",
                p.stat().st_size,
                BUDGET[f"{p.stem}_glb_bytes"],
                fmt=_fmt_bytes,
            )
        )
        try:
            gltf = _glb_json(p)
        except (ValueError, struct.error) as exc:
            rows.append(_Row(p.name, "unreadable", "glb", f"{p.name}: invalid glb ({exc})"))
            continue
        count = _primitive_count(gltf, mode)
        rows.append(_le(f"{p.name} {kind}", count, BUDGET[f"{p.stem}_glb_{kind}"]))

    # Per-behavior payload files.
    for p in bins:
        rows.append(
            _le(
                str(p.relative_to(asset_dir)),
                p.stat().st_size,
                BUDGET["activity_bin_bytes"],
                fmt=_fmt_bytes,
            )
        )
    for p in jsons:
        rows.append(
            _le(
                str(p.relative_to(asset_dir)),
                p.stat().st_size,
                BUDGET["narration_json_bytes"],
                fmt=_fmt_bytes,
            )
        )

    # JS bundle, gzipped (dist/assets/*.js).
    js_files = sorted(dist_dir.glob("assets/*.js")) if dist_dir is not None else []
    if dist_dir is not None:
        rows.append(
            _le(
                "js bundle gzip",
                sum(_gzip_size(p) for p in js_files),
                BUDGET["js_bundle_gzip_bytes"],
                fmt=_fmt_bytes,
            )
        )

    # Total first load, gzipped: JS + CSS + manifest + 3 glb + 1 bin + 1 json.
    first_load = [
        asset_dir / name
        for name in ("manifest.json", "brain.glb", "neurons.glb", "fly.glb")
        if (asset_dir / name).is_file()
    ]
    if bins:
        first_load.append(max(bins, key=lambda p: p.stat().st_size))
    if jsons:
        first_load.append(max(jsons, key=lambda p: p.stat().st_size))
    first_load += [p for p in dist_files if p.suffix in (".js", ".css")]
    rows.append(
        _le(
            "total first load gzip",
            sum(_gzip_size(p) for p in first_load),
            BUDGET["total_first_load_gzip_bytes"],
            fmt=_fmt_bytes,
        )
    )
    return rows


def check(asset_dir: Path, dist_dir: Path | None = None) -> list[str]:
    """Return budget violation messages for ``asset_dir`` (+ optional ``dist_dir``)."""
    rows = _collect(Path(asset_dir), Path(dist_dir) if dist_dir is not None else None)
    return [r.violation for r in rows if r.violation is not None]


def _print_table(rows: list[_Row]) -> None:
    header = ("ASSET", "ACTUAL", "BUDGET", "STATUS")
    widths = [len(h) for h in header[:3]]
    for r in rows:
        for i, cell in enumerate((r.label, r.actual, r.limit)):
            widths[i] = max(widths[i], len(cell))
    print("  ".join(h.ljust(widths[i]) for i, h in enumerate(header[:3])) + "  " + header[3])
    print("  ".join("-" * w for w in widths) + "  " + "-" * len(header[3]))
    for r in rows:
        cells = (r.label, r.actual, r.limit)
        line = "  ".join(c.ljust(widths[i]) for i, c in enumerate(cells))
        print(line + "  " + ("FAIL" if r.violation else "ok"))


def main(argv: Sequence[str] | None = None) -> int:
    """CLI entry point; exit 0 on budget, 1 on any violation."""
    parser = argparse.ArgumentParser(
        prog="python -m flybrain_pipeline.budget",
        description="Check built assets against the PLAN-01 §6 asset budget.",
    )
    parser.add_argument("asset_dir", type=Path, help="directory of pipeline outputs")
    parser.add_argument("--dist", type=Path, default=None, help="vite build output (dist/)")
    args = parser.parse_args(argv)

    rows = _collect(args.asset_dir, args.dist)
    _print_table(rows)
    violations = [r.violation for r in rows if r.violation is not None]
    for violation in violations:
        print(violation, file=sys.stderr)
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
