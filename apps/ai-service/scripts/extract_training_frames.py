#!/usr/bin/env python3
"""Extract training frames from video files at a fixed interval."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_AI_ROOT = Path(__file__).resolve().parents[1]
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract frames from videos for vest classifier training.")
    parser.add_argument("--video", type=Path, action="append", required=True, help="Video file (repeatable)")
    parser.add_argument(
        "--out",
        type=Path,
        default=_AI_ROOT / "datasets" / "vest-classifier" / "raw" / "frames",
        help="Output directory for JPEG frames",
    )
    parser.add_argument("--every", type=int, default=15, help="Save every Nth frame")
    parser.add_argument("--max-frames", type=int, default=0, help="Max frames per video (0 = unlimited)")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        import cv2  # type: ignore
    except ImportError:
        print("opencv-python-headless required: pip install -r requirements-phase6.txt", file=sys.stderr)
        return 1

    args.out.mkdir(parents=True, exist_ok=True)
    total_saved = 0

    for video_path in args.video:
        if not video_path.is_file():
            print(f"Skip missing video: {video_path}", file=sys.stderr)
            continue

        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            print(f"Could not open: {video_path}", file=sys.stderr)
            continue

        stem = video_path.stem
        frame_idx = 0
        saved_for_video = 0

        while True:
            ok, frame = cap.read()
            if not ok:
                break

            if frame_idx % args.every == 0:
                out_name = f"{stem}_f{frame_idx:06d}.jpg"
                out_path = args.out / out_name
                cv2.imwrite(str(out_path), frame)
                total_saved += 1
                saved_for_video += 1
                if args.max_frames and saved_for_video >= args.max_frames:
                    break

            frame_idx += 1

        cap.release()
        print(f"{video_path.name}: saved {saved_for_video} frames")

    print(f"Done. {total_saved} frames in {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
