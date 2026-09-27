# Vest classifier dataset

Two-class YOLO classification model: `vest_worn` vs `no_vest`.

## Folder layout

```text
datasets/vest-classifier/
├── raw/
│   ├── frames/          # Full frames extracted from videos (extract_training_frames.py)
│   └── torso_crops/     # Unlabeled torso crops (crop_torso.py)
├── train/
│   ├── vest_worn/       # Torso wearing a vest
│   └── no_vest/         # No vest worn (includes held/beside/on chair/on shoulder)
├── val/
│   ├── vest_worn/
│   └── no_vest/
└── mistakes/            # Runtime false positives saved by vest_feedback.py
    ├── vest_worn/
    └── no_vest/
```

## Export kiosk evidence (false positives from DB)

If you captured false positives through the app, frames are in `apps/api/storage/evidence/`
and indexed in Postgres. Export directly into training folders:

```powershell
pip install psycopg2-binary
python scripts/export_evidence_for_training.py --mode false-positive --crop --copy-raw
```

Modes:
- `false-positive` — GRANTED + vest detected → `no_vest` (held-vest false positives)
- `vest-granted` — GRANTED + vest detected → `vest_worn` (positive examples)
- `vest-detected` — any vest detection → `no_vest`
- `all` — every evidence frame (label manually afterward)

Writes a manifest CSV under `raw/evidence_export/<mode>/`.

## Workflow

1. **Extract frames** from site videos:
   ```bash
   python scripts/extract_training_frames.py --video path/to/video.mp4 --out datasets/vest-classifier/raw/frames
   ```

2. **Crop torsos** from frames using the PPE YOLO person detector:
   ```bash
   python scripts/crop_torso.py --input datasets/vest-classifier/raw/frames --out datasets/vest-classifier/raw/torso_crops
   ```

3. **Label** crops manually — move each file into `train/` or `val/` under `vest_worn/` or `no_vest/`.
   - `no_vest`: vest held in hand, beside body, on chair, on shoulder, in front of body but not worn.
   - `vest_worn`: high-visibility vest clearly worn on the torso.

4. **Train** the classifier:
   ```bash
   python scripts/train_vest_classifier.py --data datasets/vest-classifier --epochs 50
   ```

5. **Deploy** weights to `models/vest-classifier.pt` and set `VEST_CLASSIFIER_ENABLED=true`.

6. **Retrain loop**: false positives saved at runtime land in `mistakes/` — review, relabel, merge into `train/`/`val/`, retrain.
