"""Command-line interface for the flybrain pipeline."""

import argparse

from flybrain_pipeline import __version__


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="flybrain",
        description="Offline asset pipeline for FlyBrain Lab.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    return parser


def main(argv: list[str] | None = None) -> int:
    build_parser().parse_args(argv)
    return 0
