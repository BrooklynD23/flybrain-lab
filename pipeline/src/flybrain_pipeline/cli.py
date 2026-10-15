"""Command-line interface for the flybrain pipeline."""

import argparse
import importlib

from flybrain_pipeline import __version__

# subcommand -> (module, function); imported on use so `--version` stays fast.
COMMANDS = {
    "fetch": ("fetch", "main"),
    "fetch-brain": ("build", "fetch_brain_main"),
    "build": ("build", "main"),
    "fixtures": ("fixtures", "main"),
    "validate": ("validate", "main"),
    "budget": ("budget", "main"),
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="flybrain",
        description="Offline asset pipeline for FlyBrain Lab.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument("command", nargs="?", choices=list(COMMANDS), help="subcommand to run")
    parser.add_argument("args", nargs=argparse.REMAINDER, help="arguments for the subcommand")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    ns = parser.parse_args(argv)
    if ns.command is None:
        parser.print_help()
        return 0
    module, func = COMMANDS[ns.command]
    return getattr(importlib.import_module(f"flybrain_pipeline.{module}"), func)(ns.args)
