#!/usr/bin/env python3
"""Upload the sibling UGS Files collection to the configured R2 bucket."""

from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import argparse
import os
import shutil
import subprocess
import sys


SITE_ROOT = Path(__file__).resolve().parent
GAME_ROOT = SITE_ROOT.parent / "HTML games" / "UGS Files"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bucket", default="agu-games-html", help="R2 bucket name")
    parser.add_argument("--jobs", type=int, default=4, help="Concurrent uploads (default: 4)")
    args = parser.parse_args()

    if not GAME_ROOT.is_dir():
        raise SystemExit(f"Game folder not found: {GAME_ROOT}")
    if shutil.which("npx") is None:
        raise SystemExit("Node.js/npm is required. Install it, then run: npx wrangler login")

    files = sorted(
        (path for path in GAME_ROOT.iterdir() if path.is_file() and path.suffix.lower() in {".html", ".htm"}),
        key=lambda path: path.name.casefold(),
    )
    total_bytes = sum(path.stat().st_size for path in files)
    print(f"Uploading {len(files):,} HTML games ({total_bytes / 1_000_000_000:.2f} GB) to R2 bucket {args.bucket!r}.")

    def upload(path):
        command = [
            "npx", "--yes", "wrangler@4.156.0", "r2", "object", "put",
            f"{args.bucket}/{path.name}", "--file", str(path), "--remote",
            "--content-type", "text/html; charset=utf-8",
            "--content-disposition", "inline",
            "--cache-control", "public, max-age=86400",
        ]
        environment = os.environ.copy()
        environment["npm_config_cache"] = str(SITE_ROOT / ".wrangler" / "npm-cache")
        completed = subprocess.run(command, cwd=SITE_ROOT, env=environment, text=True, capture_output=True)
        if completed.returncode:
            detail = (completed.stderr or completed.stdout).strip()
            return path.name, detail or f"wrangler exited {completed.returncode}"
        return path.name, None

    failures = []
    complete = 0
    with ThreadPoolExecutor(max_workers=max(1, min(args.jobs, 8))) as pool:
        futures = [pool.submit(upload, path) for path in files]
        for future in as_completed(futures):
            name, error = future.result()
            complete += 1
            if error:
                failures.append((name, error))
                print(f"[{complete}/{len(files)}] FAILED {name}: {error}", file=sys.stderr)
            elif complete % 50 == 0 or complete == len(files):
                print(f"Uploaded {complete:,}/{len(files):,}")

    if failures:
        print(f"{len(failures)} upload(s) failed. Re-run this script to retry; uploads overwrite matching object keys.", file=sys.stderr)
        return 1
    print("All game files uploaded.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
