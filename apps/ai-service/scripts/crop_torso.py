#!/usr/bin/env python3
"""Detect people with PPE YOLO and save torso crops for vest classifier labeling."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_AI_ROOT = Path(__file__).resolve().parents[1]
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))

from app.services.person_torso_cropper import extract_torso_crops  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Crop torso regions from images using YOLO person detections.")
    parser.add_argument(
        "--input",
        type=Path,
        required=True,
        help="Input image file or directory",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=_AI_ROOT / "datasets" / "vest-classifier" / "raw" / "torso_crops",
        help="Output directory for torso JPEG crops",
    )
    parser.add_argument(
        "--model",
        type=Path,
        default=_AI_ROOT / "models" / "ppe-yolo.pt",
        help="PPE YOLO detector weights",
    )
    parser.add_argument("--conf", type=float, default=0.4, help="Person detection confidence threshold")
    parser.add_argument("--device", type=str, default="cpu", help="Inference device (cpu, cuda:0, …)")
    return parser.parse_args()


def _iter_images(path: Path) -> list[Path]:
    if path.is_file():
        return [path]
    exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
    return sorted(p for p in path.rglob("*") if p.suffix.lower() in exts)


def main() -> int:
    args = parse_args()
    try:
        from PIL import Image
        from ultralytics import YOLO  # type: ignore
    except ImportError:
        print("Requires Pillow + ultralytics: pip install -r requirements-phase6.txt", file=sys.stderr)
        return 1

    if not args.model.is_file():
        print(f"Model not found: {args.model}", file=sys.stderr)
        return 1

    args.out.mkdir(parents=True, exist_ok=True)
    model = YOLO(str(args.model))
    images = _iter_images(args.input)
    saved = 0

    for img_path in images:
        image = Image.open(img_path).convert("RGB")
        crops = extract_torso_crops(image, model, device=args.device, conf_threshold=args.conf)

        for person_idx, crop in enumerate(crops):
            out_name = f"{img_path.stem}_p{person_idx}.jpg"
            crop.save(args.out / out_name, format="JPEG", quality=92)
            saved += 1

    print(f"Saved {saved} torso crops to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
