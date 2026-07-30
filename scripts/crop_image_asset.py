#!/usr/bin/env python3
"""Crop one image asset without changing its pixels."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("x", type=int)
    parser.add_argument("y", type=int)
    parser.add_argument("width", type=int)
    parser.add_argument("height", type=int)
    args = parser.parse_args()

    source = Image.open(args.input).convert("RGBA")
    cropped = source.crop((args.x, args.y, args.x + args.width, args.y + args.height))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    cropped.save(output)


if __name__ == "__main__":
    main()
