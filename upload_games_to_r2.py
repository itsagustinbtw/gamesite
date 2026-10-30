#!/usr/bin/env python3
"""Upload the sibling UGS Files collection to the configured R2 bucket."""

from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import argparse
import os
import shutil
import subprocess
import sys
import tempfile


SITE_ROOT = Path(__file__).resolve().parent
GAME_ROOT = SITE_ROOT.parent / "HTML games" / "UGS Files"
MAX_UPLOAD_BYTES = 250 * 1024 * 1024
COPY_BLOCK_BYTES = 8 * 1024 * 1024


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bucket", default="agu-games-html", help="R2 bucket name")
    parser.add_argument("--jobs", type=int, default=8, help="Concurrent uploads (default: 8)")
    parser.add_argument("--only", nargs="*", help="Upload only these exact game filenames")
    args = parser.parse_args()

    if not GAME_ROOT.is_dir():
        raise SystemExit(f"Game folder not found: {GAME_ROOT}")
    if shutil.which("npx") is None:
        raise SystemExit("Node.js/npm is required. Install it, then run: npx wrangler login")

    files = sorted(
        (path for path in GAME_ROOT.iterdir() if path.is_file() and path.suffix.lower() in {".html", ".htm"}),
        key=lambda path: path.name.casefold(),
    )
    if args.only is not None:
        requested = set(args.only)
        files = [path for path in files if path.name in requested]
        missing = requested - {path.name for path in files}
        if missing:
            raise SystemExit(f"Game file(s) not found: {', '.join(sorted(missing))}")
    total_bytes = sum(path.stat().st_size for path in files)
    print(f"Uploading {len(files):,} HTML games ({total_bytes / 1_000_000_000:.2f} GB) to R2 bucket {args.bucket!r}.")

    def upload(path):
        environment = os.environ.copy()
        environment["npm_config_cache"] = str(SITE_ROOT / ".wrangler" / "npm-cache")

        def put_file(object_name, file_path):
            command = [
                "npx", "--yes", "wrangler@4.156.0", "r2", "object", "put",
                f"{args.bucket}/{object_name}", "--file", str(file_path), "--remote",
                "--content-type", "text/html; charset=utf-8",
                "--content-disposition", "inline",
                "--cache-control", "public, max-age=86400",
            ]
            completed = subprocess.run(command, cwd=SITE_ROOT, env=environment, text=True, capture_output=True)
            if completed.returncode:
                detail = (completed.stderr or completed.stdout).strip()
                return detail or f"wrangler exited {completed.returncode}"
            return None

        if path.stat().st_size <= 300 * 1024 * 1024:
            error = put_file(path.name, path)
            if error:
                return path.name, error
        else:
            # Wrangler caps a single local upload at 300 MiB. Store oversized HTML
            # files in chunks; the Worker joins this game's parts in one response.
            with tempfile.TemporaryDirectory(prefix="game-parts-", dir=SITE_ROOT / ".wrangler") as temporary:
                with path.open("rb") as source:
                    part_number = 1
                    while True:
                        part_path = Path(temporary) / f"{path.name}.part{part_number}"
                        copied = 0
                        with part_path.open("wb") as part:
                            while copied < MAX_UPLOAD_BYTES:
                                block = source.read(min(COPY_BLOCK_BYTES, MAX_UPLOAD_BYTES - copied))
                                if not block:
                                    break
                                part.write(block)
                                copied += len(block)
                        if not copied:
                            part_path.unlink()
                            break
                        error = put_file(f"{path.name}.part{part_number}", part_path)
                        if error:
                            return path.name, error
                        part_number += 1
                        if copied < MAX_UPLOAD_BYTES:
                            break
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
                print(f"[{complete}/{len(files)}] FAILED {name}: {error}", file=sys.stderr, flush=True)
            elif complete % 50 == 0 or complete == len(files):
                print(f"Uploaded {complete:,}/{len(files):,}", flush=True)

    if failures:
        print(f"{len(failures)} upload(s) failed. Re-run this script to retry; uploads overwrite matching object keys.", file=sys.stderr)
        return 1
    print("All game files uploaded.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
