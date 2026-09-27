# Granisafe AI Service

Phase 6 FastAPI PPE detection service.

- Without YOLO weights: stub detections driven by `X-Mock-Scenario`
- With `models/ppe-yolo.pt` + `requirements-phase6.txt`: real Ultralytics inference

## Python version

Prefer **Python 3.11 or 3.12**. On **3.14** (Windows), install with:

```powershell
$env:PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1
pip install -r requirements.txt
```

## Local run

```bash
cd apps/ai-service
py -3.12 -m venv .venv
# Windows
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Or from repo root (venv active): `pnpm dev:ai`

Optional YOLO stack: `pip install -r requirements-phase6.txt`

Place weights at `models/ppe-yolo.pt` (repo copy of `best.pt`). Mapped classes:
`Hardhat`→helmet, `Safety Vest`→safety_vest, `Person`→uniform (proxy; no workwear
class in this checkpoint). `NO-*` labels are ignored (fail-closed).

## Stage-2 vest classifier

When `VEST_CLASSIFIER_ENABLED=true` and `models/vest-classifier.pt` is present,
vest compliance uses a two-stage pipeline:

1. YOLO detects person + PPE (unchanged for helmet/uniform)
2. Torso crop from person bbox → YOLO classify (`vest_worn` / `no_vest`)
3. Temporal smoothing across frames via `sessionId` (defaults to `requestId`)
4. Disagreements saved to `datasets/vest-classifier/mistakes/` for retraining

Training workflow: see `datasets/vest-classifier/README.md`.

```powershell
pip install -r requirements-scripts.txt
python scripts/export_evidence_for_training.py --mode false-positive --crop --copy-raw
```

## Tests

```bash
pip install -r requirements.txt
python -m pytest tests -q
```

## Contract

`POST /v1/detect` — headers `X-API-Key`, optional `X-Mock-Scenario`  
Body: `{ requestId, imageBase64, classes }`  
Scenarios: `ALL_OK`, `MISSING_HELMET`, `MISSING_VEST`, `MISSING_UNIFORM`, `NONE`, `AI_ERROR`
