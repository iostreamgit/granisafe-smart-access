#!/usr/bin/env python3
"""Train YOLO classification model for vest_worn vs no_vest."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_AI_ROOT = Path(__file__).resolve().parents[1]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train vest torso classifier (YOLO classify).")
    parser.add_argument(
        "--data",
        type=Path,
        default=_AI_ROOT / "datasets" / "vest-classifier",
        help="Dataset root with train/ and val/ subfolders",
    )
    parser.add_argument(
        "--base-model",
        type=str,
        default="yolov8n-cls.pt",
        help="Ultralytics classify base checkpoint",
    )
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--imgsz", type=int, default=224)
    parser.add_argument("--batch", type=int, default=32)
    parser.add_argument("--device", type=str, default="cpu")
    parser.add_argument(
        "--out",
        type=Path,
        default=_AI_ROOT / "models" / "vest-classifier.pt",
        help="Where to copy best weights after training",
    )
    parser.add_argument("--project", type=Path, default=_AI_ROOT / "runs" / "vest-classifier")
    parser.add_argument("--name", type=str, default="train")
    return parser.parse_args()


def _validate_dataset(data_root: Path) -> None:
    for split in ("train", "val"):
        for cls in ("vest_worn", "no_vest"):
            d = data_root / split / cls
            if not d.is_dir():
                raise FileNotFoundError(f"Missing {d}")
            images = list(d.glob("*.jpg")) + list(d.glob("*.jpeg")) + list(d.glob("*.png"))
            if not images:
                print(f"Warning: no images in {d}")


def main() -> int:
    args = parse_args()
    try:
        from ultralytics import YOLO  # type: ignore
    except ImportError:
        print("Requires ultralytics: pip install -r requirements-phase6.txt", file=sys.stderr)
        return 1

    data_root = args.data.resolve()
    train_root = data_root / "train"
    try:
        _validate_dataset(data_root)
    except FileNotFoundError as exc:
        print(exc, file=sys.stderr)
        return 1

    model = YOLO(args.base_model)
    results = model.train(
        data=str(train_root),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        project=str(args.project),
        name=args.name,
        exist_ok=True,
    )

    best = Path(results.save_dir) / "weights" / "best.pt"
    if not best.is_file():
        print(f"Training finished but best.pt not found at {best}", file=sys.stderr)
        return 1

    args.out.parent.mkdir(parents=True, exist_ok=True)
    import shutil

    shutil.copy2(best, args.out)
    print(f"Copied best weights to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
