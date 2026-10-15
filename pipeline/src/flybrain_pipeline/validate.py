"""Validate JSON files against Draft 2020-12 JSON Schemas.

Usage: python -m flybrain_pipeline.validate <file> <schema-name> [--schema-dir schemas]
Reads ``<schema-dir>/<schema-name>.schema.json`` and prints one error per line
(with a ``$`` JSON path) to stderr when the file is invalid.
"""

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError


def load_schema(name: str, schema_dir: Path) -> dict:
    """Read ``<schema_dir>/<name>.schema.json``; raise FileNotFoundError if absent."""
    schema_path = Path(schema_dir) / f"{name}.schema.json"
    if not schema_path.is_file():
        raise FileNotFoundError(f"Schema not found: {schema_path}")
    return json.loads(schema_path.read_text(encoding="utf-8"))


def _json_path(error: ValidationError) -> str:
    """Render a ValidationError's instance location as ``$.a.b[0].c``."""
    path = "$"
    for part in error.absolute_path:
        path += f"[{part}]" if isinstance(part, int) else f".{part}"
    return path


def validate_file(path: Path, name: str, schema_dir: Path) -> list[str]:
    """Return validation error messages for ``path`` (empty list = valid).

    Never raises on invalid data; raises FileNotFoundError when the schema
    file is missing.
    """
    schema = load_schema(name, schema_dir)
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    errors = sorted(
        Draft202012Validator(schema).iter_errors(data),
        key=lambda error: [str(part) for part in error.absolute_path],
    )
    return [f"{_json_path(error)}: {error.message}" for error in errors]


def main(argv: Sequence[str] | None = None) -> int:
    """CLI entry point; exit 0 when valid, 1 when invalid or unreadable."""
    parser = argparse.ArgumentParser(
        prog="python -m flybrain_pipeline.validate",
        description="Validate a JSON file against a JSON Schema (Draft 2020-12).",
    )
    parser.add_argument("file", type=Path, help="JSON file to validate")
    parser.add_argument("name", metavar="schema-name", help="schema name without extension")
    parser.add_argument(
        "--schema-dir",
        type=Path,
        default=Path("schemas"),
        help="directory containing <schema-name>.schema.json (default: schemas)",
    )
    args = parser.parse_args(argv)

    try:
        errors = validate_file(args.file, args.name, args.schema_dir)
    except FileNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    except json.JSONDecodeError as exc:
        print(f"{args.file}: invalid JSON: {exc}", file=sys.stderr)
        return 1

    for error in errors:
        print(error, file=sys.stderr)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
