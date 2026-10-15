"""Tests for the flybrain CLI entry point."""

import importlib

import pytest

from flybrain_pipeline import __version__
from flybrain_pipeline.cli import main


def test_main_version_prints_version_and_exits_zero(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit) as exc_info:
        main(["--version"])
    assert exc_info.value.code == 0
    assert __version__ in capsys.readouterr().out


def test_main_no_args_returns_zero() -> None:
    assert main([]) == 0


@pytest.mark.parametrize(
    ("command", "module", "func"),
    [
        ("fetch", "fetch", "main"),
        ("fetch-brain", "build", "fetch_brain_main"),
        ("build", "build", "main"),
        ("fixtures", "fixtures", "main"),
        ("validate", "validate", "main"),
        ("budget", "budget", "main"),
    ],
)
def test_subcommand_dispatches(
    monkeypatch: pytest.MonkeyPatch, command: str, module: str, func: str
) -> None:
    seen: list[list[str]] = []
    mod = importlib.import_module(f"flybrain_pipeline.{module}")
    monkeypatch.setattr(mod, func, lambda argv: seen.append(argv) or 7)
    assert main([command, "--out", "x", "-h"]) == 7
    assert seen == [["--out", "x", "-h"]]


def test_unknown_subcommand_exits_2() -> None:
    with pytest.raises(SystemExit) as exc_info:
        main(["bogus"])
    assert exc_info.value.code == 2
