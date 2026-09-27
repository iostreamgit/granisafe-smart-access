# Phase 4 — Attendance foundation

## Delivered

- Prisma: `attendance_records` (`punch_type`, `punched_at`, `is_late`, `source`, optional `access_attempt_id`)
- Shared enums: `PunchType`, `AttendanceSource`
- APIs:
  - `GET /api/v1/attendance` — filters + RBAC scope (self / team / all)
  - `GET /api/v1/attendance/current-on-site` — open ENTRY sessions
  - `GET /api/v1/attendance/:id`
- Late utility: `shiftStart` + `lateGraceMinutes` (UTC), with `node:test` unit tests
- Seed: demo punches for EMP-1001…1003 (on-site + late examples)
- Web: Attendance page — **Current on-site** and **History** tabs

## Permissions

| Scope | Permission |
|-------|------------|
| Own punches | `attendance.view_self` |
| Department team | `attendance.view_team` |
| Company-wide | `attendance.view_all` |

`RequireAnyPermissions` allows any of the three view codes; service applies the strongest scope.

## Setup

```bash
pnpm --filter @granisafe/shared build
pnpm --filter @granisafe/api prisma:deploy
pnpm --filter @granisafe/api prisma:seed
pnpm --filter @granisafe/api test
pnpm dev
```

## Next

Phase 5 — Access control orchestration with FakeAiAdapter (identify → decide → gate → ENTRY attendance).
