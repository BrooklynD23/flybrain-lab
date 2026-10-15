import hashlib
import io
import tarfile
import tomllib
import zipfile
from pathlib import Path

import pytest

from flybrain_pipeline import fetch as F

CFG = Path(__file__).parents[1] / "config" / "sources.toml"


def opener(data: bytes):
    return lambda url: io.BytesIO(data)


def tar_bytes(members: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as t:
        for name, data in members.items():
            info = tarfile.TarInfo(name)
            info.size = len(data)
            t.addfile(info, io.BytesIO(data))
    return buf.getvalue()


def zip_bytes(members: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, data in members.items():
            z.writestr(name, data)
    return buf.getvalue()


def test_zip_extracts_h5(tmp_path):
    cfg = {"url": "http://x/1", "dest": "body/walking/", "unzip": True}
    p = F.fetch("w", cfg, tmp_path, opener(zip_bytes({"a/clip.h5": b"x"})))
    assert (p / "a" / "clip.h5").read_bytes() == b"x" and not list(tmp_path.rglob("*.part"))


def test_zip_traversal_rejected(tmp_path):
    cfg = {"url": "http://x/1", "dest": "body/walking/", "unzip": True}
    with pytest.raises(ValueError):
        F.fetch("w", cfg, tmp_path, opener(zip_bytes({"../evil": b"x"})))
    assert (
        not (tmp_path / "body" / "evil").exists() and not (tmp_path / "body" / "walking").exists()
    )
    assert not list(tmp_path.rglob("*.part"))


def test_fetch_file_ok(tmp_path):
    data = b"hello"
    cfg = {"url": "http://x/a.bin", "dest": "d/a.bin", "sha256": hashlib.sha256(data).hexdigest()}
    p = F.fetch("a", cfg, tmp_path, opener(data))
    assert p.read_bytes() == data and not list(tmp_path.rglob("*.part"))


def test_checksum_mismatch_deletes_part(tmp_path):
    cfg = {"url": "http://x/a.bin", "dest": "a.bin", "sha256": "0" * 64}
    with pytest.raises(ValueError, match="sha256"):
        F.fetch("a", cfg, tmp_path, opener(b"x"))
    assert not list(tmp_path.rglob("*.part")) and not (tmp_path / "a.bin").exists()


def test_skip_when_present(tmp_path):
    (tmp_path / "a.bin").write_bytes(b"old")

    def boom(url):
        raise AssertionError("network used")

    cfg = {"url": "http://x/a.bin", "dest": "a.bin"}
    F.fetch("a", cfg, tmp_path, boom)
    assert (tmp_path / "a.bin").read_bytes() == b"old"


def test_unset_sha_printed(tmp_path, capsys):
    F.fetch("a", {"url": "http://x/a.bin", "dest": "a.bin"}, tmp_path, opener(b"x"))
    assert hashlib.sha256(b"x").hexdigest() in capsys.readouterr().out


def test_dir_dest_uses_url_name(tmp_path):
    p = F.fetch(
        "a", {"url": "http://x/y/data.h5?dl=1", "dest": "body/walking/"}, tmp_path, opener(b"x")
    )
    assert p == tmp_path / "body/walking/data.h5"


def test_tar_strip_top_dir(tmp_path):
    data = tar_bytes({"top/a.txt": b"A", "top/sub/b.txt": b"B"})
    cfg = {"url": "http://x/t.tar.gz", "dest": "out/", "strip_top_dir": True}
    F.fetch("t", cfg, tmp_path, opener(data))
    assert (tmp_path / "out/a.txt").read_bytes() == b"A"
    assert (tmp_path / "out/sub/b.txt").read_bytes() == b"B"


def test_tar_traversal_rejected(tmp_path):
    data = tar_bytes({"top/../../evil": b"E"})
    cfg = {"url": "http://x/t.tar.gz", "dest": "out/", "strip_top_dir": True}
    with pytest.raises(tarfile.TarError):
        F.fetch("t", cfg, tmp_path / "raw", opener(data))
    assert not (tmp_path / "evil").exists()


def test_list(capsys):
    assert F.main(["--list"]) == 0
    out = capsys.readouterr().out
    for name in tomllib.loads(CFG.read_text()):
        assert name in out


def test_main_skips_optional_and_only(tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(F, "fetch", lambda name, cfg, raw, op=None: calls.append(name))
    F.main(["--raw", str(tmp_path)])
    assert "synapses" not in calls and "flybody" in calls
    calls.clear()
    F.main(["--raw", str(tmp_path), "--with-synapses"])
    assert "synapses" in calls
    calls.clear()
    F.main(["--raw", str(tmp_path), "--only", "annotations"])
    assert calls == ["annotations"]
    with pytest.raises(SystemExit):
        F.main(["--only", "nope"])


def test_sources_toml_layout():
    src = tomllib.loads(CFG.read_text())
    assert all(s.get("licence") for s in src.values())
    assert src["annotations"]["dest"] == "brain/annotations.tsv"
    assert src["shiu"]["dest"] == "pipeline/sims/shiu/vendor/"
    assert src["flybody"]["dest"] == "body/flybody/"
    assert src["walking"]["dest"] == "body/walking/" and src["flight"]["dest"] == "body/flight/"
    assert src["neuropil_counts"]["dest"] == "brain/per_neuron_neuropil_count_post_783.feather"
    assert src["proofread_ids"]["dest"] == "brain/proofread_root_ids_783.npy"
    assert src["walking"]["unzip"] and src["flight"]["unzip"]
    assert "/main" not in "".join(s["url"] for s in src.values())
    assert src["synapses"]["dest"] == "brain/flywire_synapses_783.feather"
