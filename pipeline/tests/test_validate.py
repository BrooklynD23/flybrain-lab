"""Tests for the JSON Schema validator (`flybrain_pipeline.validate`)."""

import json
from pathlib import Path

import pytest

from flybrain_pipeline.validate import load_schema, main, validate_file

SCHEMA_DIR = Path(__file__).parent / "data" / "schemas"


def _write(tmp_path: Path, data: object) -> Path:
    path = tmp_path / "data.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


def test_validate_file_valid_returns_empty_list(tmp_path: Path) -> None:
    data_path = _write(tmp_path, {"name": "ok", "count": 3, "items": [{"id": "a"}]})
    assert validate_file(data_path, "tiny", SCHEMA_DIR) == []


def test_validate_file_invalid_returns_errors_with_json_path(tmp_path: Path) -> None:
    data_path = _write(tmp_path, {"name": "ok", "count": -1})
    errors = validate_file(data_path, "tiny", SCHEMA_DIR)
    assert len(errors) >= 1
    assert any("$.count" in error for error in errors)


def test_validate_file_invalid_nested_path_and_never_raises(tmp_path: Path) -> None:
    data_path = _write(tmp_path, {"name": "ok", "count": 1, "items": [{"id": 7}]})
    errors = validate_file(data_path, "tiny", SCHEMA_DIR)
    assert any("$.items[0].id" in error for error in errors)


def test_validate_file_missing_required_reports_root_path(tmp_path: Path) -> None:
    data_path = _write(tmp_path, {"name": "ok"})
    errors = validate_file(data_path, "tiny", SCHEMA_DIR)
    assert any("'count' is a required property" in error for error in errors)


def test_load_schema_missing_raises_file_not_found() -> None:
    with pytest.raises(FileNotFoundError, match="missing"):
        load_schema("missing", SCHEMA_DIR)


def test_validate_file_missing_schema_raises(tmp_path: Path) -> None:
    data_path = _write(tmp_path, {"name": "ok", "count": 1})
    with pytest.raises(FileNotFoundError, match="missing"):
        validate_file(data_path, "missing", SCHEMA_DIR)


def test_main_valid_exits_zero(tmp_path: Path) -> None:
    data_path = _write(tmp_path, {"name": "ok", "count": 0})
    assert main([str(data_path), "tiny", "--schema-dir", str(SCHEMA_DIR)]) == 0


def test_main_invalid_exits_one_and_prints_errors(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    data_path = _write(tmp_path, {"name": "ok", "count": "nope"})
    assert main([str(data_path), "tiny", "--schema-dir", str(SCHEMA_DIR)]) == 1
    assert "$.count" in capsys.readouterr().err


def test_main_missing_schema_exits_one(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    data_path = _write(tmp_path, {"name": "ok", "count": 0})
    assert main([str(data_path), "missing", "--schema-dir", str(SCHEMA_DIR)]) == 1
    assert "missing" in capsys.readouterr().err
