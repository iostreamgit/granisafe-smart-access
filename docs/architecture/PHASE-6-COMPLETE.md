# Phase 6 — AI PPE service

## Delivered

### AI service (`apps/ai-service`)
- Quality gate (decode / size / luminance; accepts Nest stub frame)
- Label adapter (`helmet`/`hardhat`, `vest`/`safety_vest`, `uniform`)
- Detector: scenario stub by default; YOLO load when `MODEL_PATH` weights exist
- `POST /v1/detect` with `X-API-Key` + optional `X-Mock-Scenario`
- `/health`, `/ready`, `/v1/health`
- Tests: label adapter + detect scenarios

### Core API
- `HttpAiAdapter` calling `AI_BASE_URL/v1/detect`
- `AI_ADAPTER=fake|http` factory on `AI_DETECTOR` port
- Fail-closed mapping: timeout / unreachable / 5xx / kill switch
- `AI_DOWN` audit when AI returns failure
- `GET /api/v1/access/ai-status`

### Web
- Access kiosk shows live vs fake adapter status

## Run

```bash
# Terminal A — AI service
cd apps/ai-service
py -3.12 -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
pnpm --filter @granisafe/ai-service start
# or: uvicorn app.main:app --reload --port 8000

# Terminal B — apps
# .env: AI_ADAPTER=http
pnpm dev
```

Optional real weights: `pip install -r requirements-phase6.txt` and place `models/ppe-yolo.pt`.

## Demo

1. Guard login → Access Control (adapter should read `http`)
2. Identify EMP-1001 → Inspect **All PPE present** → GRANTED
3. Inspect **Missing helmet** → DENIED
4. Set `AI_KILL_SWITCH=true` (restart API) → DENIED `AI_UNAVAILABLE` + audit `AI_DOWN`

## Next

Phase 7 — Live dashboard & realtime WebSocket feed.
