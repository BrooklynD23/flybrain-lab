"""Download raw sources listed in config/sources.toml, checksummed and traversal-safe."""

import argparse
import hashlib
import shutil
import tarfile
import tomllib
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath
from urllib.parse import urlparse

SOURCES = Path(__file__).parents[2] / "config" / "sources.toml"
REPO_ROOT = Path(__file__).parents[3]
CHUNK = 1 << 20


def _target(cfg: dict, raw: Path) -> Path:
    base = REPO_ROOT if cfg["dest"].startswith("pipeline/") else raw
    dest = base / cfg["dest"]
    if cfg["dest"].endswith("/") and not (cfg.get("strip_top_dir") or cfg.get("unzip")):
        dest = dest / PurePosixPath(urlparse(cfg["url"]).path).name
    return dest


def _present(dest: Path, tarball: bool) -> bool:
    return any(dest.iterdir()) if tarball and dest.is_dir() else dest.is_file()


def _unzip(part: Path, dest: Path) -> None:
    root = dest.resolve()
    with zipfile.ZipFile(part) as z:
        for name in z.namelist():
            if not (root / name).resolve().is_relative_to(root):
                raise ValueError(f"unsafe zip member: {name}")
        z.extractall(dest)


def _extract(part: Path, dest: Path) -> None:
    with tarfile.open(part) as tar:
        members = []
        for m in tar.getmembers():
            parts = PurePosixPath(m.name).parts[1:]
            if parts:
                m.name = str(PurePosixPath(*parts))
                members.append(m)
        tar.extractall(dest, members=members, filter="data")


def fetch(name: str, cfg: dict, raw: Path, opener=urllib.request.urlopen) -> Path:
    tarball = bool(cfg.get("strip_top_dir") or cfg.get("unzip"))
    dest = _target(cfg, raw)
    if _present(dest, tarball):
        print(f"{name}: present, skipping")
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_name(dest.name + ".part") if not tarball else dest.parent / f".{name}.part"
    digest = hashlib.sha256()
    try:
        with opener(cfg["url"]) as resp, part.open("wb") as out:
            while chunk := resp.read(CHUNK):
                digest.update(chunk)
                out.write(chunk)
        got, want = digest.hexdigest(), cfg.get("sha256")
        if want and got != want:
            raise ValueError(f"{name}: sha256 mismatch (got {got}, want {want})")
        if not want:
            print(f"{name}: sha256 {got} (unpinned; pin in sources.toml)")
        if tarball:
            dest.mkdir(parents=True, exist_ok=True)
            (_unzip if cfg.get("unzip") else _extract)(part, dest)
            part.unlink()
        else:
            part.replace(dest)
    except BaseException:
        part.unlink(missing_ok=True)
        if tarball:
            shutil.rmtree(dest, ignore_errors=True)
        raise
    return dest


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="flybrain fetch")
    p.add_argument("--raw", type=Path, default=Path("pipeline/data/raw"))
    p.add_argument("--only")
    p.add_argument("--with-synapses", action="store_true")
    p.add_argument("--list", action="store_true")
    args = p.parse_args(argv)
    sources = tomllib.loads(SOURCES.read_text())
    if args.only and args.only not in sources:
        p.error(f"unknown source {args.only!r}; choose from {', '.join(sources)}")
    if args.list:
        for name, cfg in sources.items():
            print(f"{name}\t{cfg['dest']}\t{cfg['licence']}\t{cfg['url']}")
        return 0
    for name, cfg in sources.items():
        if args.only and name != args.only:
            continue
        if cfg.get("optional") and not (args.with_synapses or args.only == name):
            continue
        fetch(name, cfg, args.raw)
    return 0
