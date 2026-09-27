# Phase 9 — UAT checklist

Hardening pass: QR scan, security upload limits, Testcontainers, Playwright, k6.

## Prerequisites

- `pnpm infra:up` && `pnpm db:setup`
- `pnpm dev` (API + web)
- `pnpm dev:ai` when testing live PPE camera
- Demo password: `Password123!`

## Automated

```bash
pnpm test                 # API unit + QR payload unit + authz matrix
pnpm --filter @granisafe/web test:e2e:install
pnpm test:e2e             # Playwright smoke (needs API + DB up; starts web via config)
```

## Manual UAT

| # | Flow | Pass |
|---|------|------|
| 1 | Guard login → Access → Type EMP-1001 → Identify → Simulate All PPE → GRANTED | ☐ |
| 2 | Employees (HR) → open QR → print/display badge | ☐ |
| 3 | Guard → Access → **Scan QR** → decode badge → auto-identify → PPE camera starts | ☐ |
| 4 | No helmet → DENIED; put helmet → **Retake** → new attempt (cooldown ≤ 5s) | ☐ |
| 5 | Guard → Notifications → unread + mark read | ☐ |
| 6 | HR → Reports → attendance XLSX → download | ☐ |
| 7 | Admin → Settings → change cooldown → Save; Audit shows SETTINGS_UPDATED | ☐ |
| 8 | Employee login cannot open `/app/settings` or `/app/access` | ☐ |

## Known demo tips

- Access cooldown defaults to 5s (seed / Settings).
- QR scan and PPE webcam hand off the camera (scan stops before PPE starts).
- Live YOLO needs `pnpm dev:ai` and `AI_TIMEOUT_MS=30000`.

## Automated extras

```bash
pnpm test:integration   # Docker / Testcontainers
pnpm test:perf          # requires k6 on PATH
```

## Next

Phase 10 — deploy packaging, demo storyboard, `v1.0.0`.
