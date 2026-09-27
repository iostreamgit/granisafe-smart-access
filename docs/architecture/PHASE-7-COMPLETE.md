# Phase 7 — Live dashboard & realtime

## Delivered

- Prisma: `camera_status` (per company access point + heartbeat)
- `GET /api/v1/dashboard/summary` — on-site, entries today, denied today, AI status, cameras
- `POST /api/v1/dashboard/camera-heartbeat` — kiosk heartbeat (`access.operate`)
- Socket.IO namespace `/ws` (auth JWT + `dashboard.live`)
  - `access.event.created`
  - `system.camera.status`
- Access inspect emits realtime events via Nest EventEmitter
- Dashboard UI: metrics, status chips, live recent access feed
- Kiosk sends GATE-1 heartbeat every 20s
- Vite proxies `/socket.io` WebSocket

## Demo (exit criterion)

1. Open Dashboard as `guard@granisafe.local` (or admin) — wait for **Live connected**
2. Second browser / window: Access Kiosk → Identify + Inspect with **Missing helmet**
3. Dashboard feed shows DENIED without refresh; denied-today increments

## Next

Phase 8 — Reports, notifications, audit UX (see PHASE-8-COMPLETE.md).
