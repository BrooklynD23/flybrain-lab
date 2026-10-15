"""Tests for the flybrain CLI entry point."""

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
