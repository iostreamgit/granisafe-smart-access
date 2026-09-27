# Phase 8 — Reports, notifications, audit UX, settings

## Delivered

### Data
- `notifications`, `report_jobs`, `system_settings` tables
- Seed defaults for settings + sample notifications for Guard

### API
- `GET` / `PUT /api/v1/settings` (`settings.manage`) — gate, cooldown, grace, retention, fail-closed, PPE thresholds
- Access cooldown enforced on identify; gate open ms from settings
- `GET /api/v1/notifications`, `POST …/read-all`, `POST …/:id/read`
- Emitters: ACCESS_DENIED, AI_UNAVAILABLE, CAMERA_OFFLINE
- Reports: `POST /reports/attendance|rejections|ppe-compliance` → BullMQ job; `GET /reports/:jobId`, `…/download` (XLSX/PDF)
- Audit list filters: `actorUserId`, `action`, `entityType`, `from`, `to`

### Web
- Reports, Notifications, Audit Logs, Settings pages (placeholders removed)

## Run

```bash
pnpm infra:up          # Postgres + Redis required for reports queue
pnpm db:setup
pnpm dev               # API + web
```

## Demo checklist

1. Admin → Settings → change cooldown / PPE thresholds → Save
2. Guard → Notifications → see seed alerts; mark read
3. HR → Reports → Attendance XLSX for current month → Download
4. Admin → Audit Logs → filter `SETTINGS_UPDATED` / `ACCESS_DENIED`

## Next

Phase 9 hardening / QR camera scan polish / bugfix pass.
