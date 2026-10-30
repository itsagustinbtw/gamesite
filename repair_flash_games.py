#!/usr/bin/env python3
"""Repair UGS Ruffle pages whose generated player.load value is the literal $1."""

from html import unescape
from pathlib import Path
import argparse
import json
import re


SITE_ROOT = Path(__file__).resolve().parent
GAME_ROOT = SITE_ROOT.parent / "HTML games" / "UGS Files"
PLACEHOLDER = re.compile(r"player\.load\(\s*([\"'])\$1\1\s*\)")
PARAM_MOVIE = re.compile(r"<param\b[^>]*\bname\s*=\s*([\"'])movie\1[^>]*\bvalue\s*=\s*([\"'])(.*?)\2", re.I | re.S)
EMBED_SRC = re.compile(r"<embed\b[^>]*\bsrc\s*=\s*([\"'])(.*?)\1", re.I | re.S)
EMPTY_EMBED_SRC = re.compile(r"(<embed\b[^>]*\bsrc\s*=\s*)([\"'])idc about this one\2", re.I)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Write repairs; default is a dry run")
    args = parser.parse_args()
    if not GAME_ROOT.is_dir():
        raise SystemExit(f"Game folder not found: {GAME_ROOT}")

    repaired = []
    unavailable = []
    for path in sorted(GAME_ROOT.glob("*"), key=lambda item: item.name.casefold()):
        if not path.is_file() or path.suffix.lower() not in {".html", ".htm"}:
            continue
        source = path.read_text(encoding="utf-8", errors="replace")
        if not PLACEHOLDER.search(source):
            continue
        param = PARAM_MOVIE.search(source)
        embed = EMBED_SRC.search(source)
        url = unescape(param.group(3) if param else embed.group(2) if embed else "").strip()
        if not url.startswith(("https://", "http://")):
            unavailable.append(path.name)
            continue
        replacement = f"player.load({json.dumps(url, ensure_ascii=False)})"
        updated, count = PLACEHOLDER.subn(replacement, source)
        if count:
            updated = EMPTY_EMBED_SRC.sub(lambda match: f"{match.group(1)}{match.group(2)}{unescape(url)}{match.group(2)}", updated)
            repaired.append(path.name)
            if args.apply:
                path.write_text(updated, encoding="utf-8")

    mode = "Repaired" if args.apply else "Would repair"
    print(f"{mode} {len(repaired)} Flash game page(s) using their existing embedded SWF URL.")
    print(f"Could not repair {len(unavailable)} page(s): their embedded URL is a placeholder, not a game file.")
    if unavailable:
        print("Unavailable source files:")
        for name in unavailable:
            print(f"  {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
