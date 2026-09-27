# Phase 5 — Access control orchestration (Fake AI)

## Delivered

- Prisma: `ppe_policies`, `ppe_policy_items`, `access_attempts`, `access_decisions`, `access_detection_items`
- Shared: `AccessDirection`, `AccessAttemptStatus`, `AccessIdentifyMethod`, `FakeAiScenario`
- Ports/adapters:
  - `FakeAiAdapter` (mock detection scenarios)
  - `GateSimulationAdapter` (`GATE_OPEN_MS`)
  - `EvidenceStorageService` (local key-shaped storage under `storage/evidence`)
- `AccessDecisionService` — fail-closed policy evaluation
- APIs (`access.operate` / `access.view_events`):
  - `POST /api/v1/access/identify`
  - `POST /api/v1/access/inspect` (multipart + `Idempotency-Key` + `mockScenario`)
  - `GET /api/v1/access/events`
  - `GET /api/v1/access/events/:id`
- GRANTED ENTRY/EXIT → attendance (`source: ACCESS_GRANT`) with late flag on ENTRY
- Web kiosk: `/app/access` with demo employee codes + Fake AI scenario toggle
- Seed: default PPE policy (helmet/vest/uniform thresholds)

## Demo

1. Login as `guard@granisafe.local` / `Password123!`
2. Open **Access Control**
3. Identify `EMP-1001` ENTRY
4. Inspect with **All PPE present** → GRANTED + attendance
5. Retry with **Missing helmet** → DENIED fail-closed

## Next

Phase 6 — Real AI PPE service (`HttpAiAdapter` replaces Fake AI).
