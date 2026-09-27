#!/usr/bin/env python3
"""
Export kiosk evidence frames from Postgres + local EvidenceStorageService files
into vest classifier training folders.

Typical use (false positives you captured at the kiosk):

  python scripts/export_evidence_for_training.py --mode false-positive --crop

Requires: psycopg2-binary (pip install psycopg2-binary)
Optional crop deps: pip install -r requirements-phase6.txt
"""

from __future__ import annotations

import argparse
import csv
import os
import random
import shutil
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

_AI_ROOT = Path(__file__).resolve().parents[1]
_REPO_ROOT = _AI_ROOT.parent.parent
if str(_AI_ROOT) not in sys.path:
    sys.path.insert(0, str(_AI_ROOT))

DEFAULT_EVIDENCE_ROOT = _REPO_ROOT / "apps" / "api" / "storage" / "evidence"
DEFAULT_DATASET = _AI_ROOT / "datasets" / "vest-classifier"


@dataclass(frozen=True)
class EvidenceRow:
    attempt_id: str
    evidence_key: str
    started_at: datetime
    decision: str | None
    vest_detected: bool
    vest_confidence: float


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export access attempt evidence frames for vest classifier training.",
    )
    parser.add_argument(
        "--mode",
        choices=("false-positive", "vest-granted", "vest-detected", "all"),
        default="false-positive",
        help=(
            "false-positive: GRANTED + vest detected (your held-vest false positives → no_vest); "
            "vest-granted: GRANTED + vest detected → vest_worn; "
            "vest-detected: any vest detected → no_vest; "
            "all: every attempt with evidence"
        ),
    )
    parser.add_argument(
        "--label",
        choices=("no_vest", "vest_worn", "auto"),
        default="auto",
        help="Target class folder. auto picks from --mode.",
    )
    parser.add_argument(
        "--database-url",
        default="",
        help="Postgres URL (default: DATABASE_URL from repo .env or environment)",
    )
    parser.add_argument(
        "--evidence-root",
        type=Path,
        default=DEFAULT_EVIDENCE_ROOT,
        help="EvidenceStorageService root (storage/evidence under apps/api)",
    )
    parser.add_argument(
        "--dataset",
        type=Path,
        default=DEFAULT_DATASET,
        help="Vest classifier dataset root",
    )
    parser.add_argument(
        "--crop",
        action="store_true",
        help="Crop torso with YOLO person detector instead of copying full frames",
    )
    parser.add_argument(
        "--model",
        type=Path,
        default=_AI_ROOT / "models" / "ppe-yolo.pt",
        help="PPE YOLO detector for --crop",
    )
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--conf", type=float, default=0.4)
    parser.add_argument("--val-ratio", type=float, default=0.2, help="Fraction for val/ split")
    parser.add_argument("--limit", type=int, default=0, help="Max attempts to export (0 = all)")
    parser.add_argument("--since", default="", help="ISO date — only attempts on/after this day")
    parser.add_argument(
        "--copy-raw",
        action="store_true",
        help="Also copy full frames to datasets/.../raw/evidence_export/",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def _read_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        out[key.strip()] = value.strip().strip('"').strip("'")
    return out


def resolve_database_url(cli_value: str) -> str:
    if cli_value:
        return cli_value
    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"]
    env = _read_env_file(_REPO_ROOT / ".env")
    if env.get("DATABASE_URL"):
        return env["DATABASE_URL"]
    raise SystemExit("DATABASE_URL not set. Pass --database-url or set it in repo .env")


def resolve_evidence_file(evidence_root: Path, evidence_key: str) -> Path:
    """Map DB evidence_object_key to on-disk path (EvidenceStorageService layout)."""
    key = evidence_key.lstrip("/")
    return evidence_root / Path(*key.split("/"))


def fetch_evidence_rows(database_url: str, *, since: str) -> list[EvidenceRow]:
    try:
        import psycopg2  # type: ignore
    except ImportError as exc:
        raise SystemExit(
            "psycopg2 required: pip install psycopg2-binary"
        ) from exc

    since_clause = ""
    params: list[object] = []
    if since:
        since_clause = "AND aa.started_at >= %s"
        params.append(since)

    sql = f"""
        SELECT
            aa.id::text,
            aa.evidence_object_key,
            aa.started_at,
            d.decision,
            vest.detected,
            vest.confidence::float
        FROM access_attempts aa
        LEFT JOIN access_decisions d ON d.access_attempt_id = aa.id
        LEFT JOIN access_detection_items vest
            ON vest.access_attempt_id = aa.id AND vest.ppe_class = 'SAFETY_VEST'
        WHERE aa.evidence_object_key IS NOT NULL
        {since_clause}
        ORDER BY aa.started_at DESC
    """

    rows: list[EvidenceRow] = []
    with psycopg2.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            for attempt_id, key, started_at, decision, vest_detected, vest_conf in cur.fetchall():
                rows.append(
                    EvidenceRow(
                        attempt_id=attempt_id,
                        evidence_key=key,
                        started_at=started_at,
                        decision=decision,
                        vest_detected=bool(vest_detected) if vest_detected is not None else False,
                        vest_confidence=float(vest_conf or 0.0),
                    )
                )
    return rows


def filter_rows(rows: list[EvidenceRow], mode: str) -> list[EvidenceRow]:
    if mode == "all":
        return rows

    if mode == "vest-detected":
        return [r for r in rows if r.vest_detected]

    if mode in ("false-positive", "vest-granted"):
        return [
            r
            for r in rows
            if r.decision == "GRANTED" and r.vest_detected
        ]

    return rows


def target_label(mode: str, label_arg: str) -> str:
    if label_arg != "auto":
        return label_arg
    if mode == "vest-granted":
        return "vest_worn"
    if mode in ("false-positive", "vest-detected"):
        return "no_vest"
    return "no_vest"


def safe_stem(attempt_id: str, started_at: datetime) -> str:
    ts = started_at.strftime("%Y%m%dT%H%M%S")
    short = attempt_id.replace("-", "")[:8]
    return f"{ts}_{short}"


def write_crop_or_copy(
    *,
    src: Path,
    stem: str,
    out_train: Path,
    out_val: Path,
    to_val: bool,
    crop: bool,
    model: object | None,
    device: str,
    conf: float,
    dry_run: bool,
) -> int:
    saved = 0
    dest_root = out_val if to_val else out_train

    if crop:
        try:
            from PIL import Image
        except ImportError:
            raise SystemExit("Pillow required for --crop: pip install -r requirements-phase6.txt")

        from app.services.person_torso_cropper import extract_torso_crops

        image = Image.open(src).convert("RGB")
        crops = extract_torso_crops(image, model, device=device, conf_threshold=conf)
        for idx, crop_img in enumerate(crops):
            dest = dest_root / f"{stem}_p{idx}.jpg"
            if dry_run:
                print(f"  [dry-run] crop -> {dest}")
            else:
                dest.parent.mkdir(parents=True, exist_ok=True)
                crop_img.save(dest, format="JPEG", quality=92)
            saved += 1
        return saved

    dest = dest_root / f"{stem}{src.suffix.lower()}"
    if dry_run:
        print(f"  [dry-run] copy -> {dest}")
    else:
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
    return 1


def main() -> int:
    args = parse_args()
    database_url = resolve_database_url(args.database_url)
    label = target_label(args.mode, args.label)

    all_rows = fetch_evidence_rows(database_url, since=args.since)
    rows = filter_rows(all_rows, args.mode)
    if args.limit > 0:
        rows = rows[: args.limit]

    print(f"Fetched {len(all_rows)} attempts with evidence; {len(rows)} match mode={args.mode!r}")

    if not rows:
        print("Nothing to export.")
        return 0

    model = None
    if args.crop:
        try:
            from ultralytics import YOLO  # type: ignore
        except ImportError:
            print("Requires ultralytics for --crop: pip install -r requirements-phase6.txt", file=sys.stderr)
            return 1
        if not args.model.is_file():
            print(f"Model not found: {args.model}", file=sys.stderr)
            return 1
        model = YOLO(str(args.model))

    dataset = args.dataset.resolve()
    train_dir = dataset / "train" / label
    val_dir = dataset / "val" / label
    raw_dir = dataset / "raw" / "evidence_export" / args.mode

    rng = random.Random(args.seed)
    shuffled = rows.copy()
    rng.shuffle(shuffled)
    val_count = int(len(shuffled) * args.val_ratio)
    val_ids = {r.attempt_id for r in shuffled[:val_count]}

    manifest_path = raw_dir / "manifest.csv"
    if not args.dry_run:
        raw_dir.mkdir(parents=True, exist_ok=True)

    exported = 0
    missing = 0

    manifest_file = None
    writer = None
    if not args.dry_run:
        manifest_file = manifest_path.open("w", newline="", encoding="utf-8")
        writer = csv.DictWriter(
            manifest_file,
            fieldnames=[
                "attempt_id",
                "evidence_key",
                "started_at",
                "decision",
                "vest_detected",
                "vest_confidence",
                "label",
                "split",
                "source_file",
                "status",
            ],
        )
        writer.writeheader()

    try:
        for row in rows:
            src = resolve_evidence_file(args.evidence_root.resolve(), row.evidence_key)
            stem = safe_stem(row.attempt_id, row.started_at)
            to_val = row.attempt_id in val_ids
            split = "val" if to_val else "train"

            if args.copy_raw and src.is_file() and not args.dry_run:
                raw_dest = raw_dir / f"{stem}{src.suffix.lower()}"
                shutil.copy2(src, raw_dest)

            if not src.is_file():
                missing += 1
                status = "missing_file"
                print(f"  missing: {src}")
            else:
                n = write_crop_or_copy(
                    src=src,
                    stem=stem,
                    out_train=train_dir,
                    out_val=val_dir,
                    to_val=to_val,
                    crop=args.crop,
                    model=model,
                    device=args.device,
                    conf=args.conf,
                    dry_run=args.dry_run,
                )
                exported += n
                status = f"exported_{n}"

            entry = {
                "attempt_id": row.attempt_id,
                "evidence_key": row.evidence_key,
                "started_at": row.started_at.isoformat(),
                "decision": row.decision or "",
                "vest_detected": str(row.vest_detected),
                "vest_confidence": f"{row.vest_confidence:.4f}",
                "label": label,
                "split": split,
                "source_file": str(src),
                "status": status,
            }
            if writer:
                writer.writerow(entry)
    finally:
        if manifest_file:
            manifest_file.close()

    print(f"Done. exported={exported} missing_files={missing} label={label}")
    print(f"  train -> {train_dir}")
    print(f"  val   -> {val_dir}")
    if not args.dry_run:
        print(f"  manifest -> {manifest_path}")

    if exported == 0 and missing > 0:
        print(
            "\nHint: evidence files live under apps/api/storage/evidence/ when the API runs from apps/api. "
            "If your API cwd differs, pass --evidence-root.",
            file=sys.stderr,
        )
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
