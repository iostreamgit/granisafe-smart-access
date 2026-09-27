# Phase 9 — Testing & hardening

**Status:** complete (automated exit criteria met; manual UAT in [PHASE-9-UAT.md](./PHASE-9-UAT.md)).

## Delivered

### Product (earlier slice)
- Kiosk QR camera scan (`html5-qrcode`) with auto-identify + PPE camera handoff
- UAT checklist — [PHASE-9-UAT.md](./PHASE-9-UAT.md)

### Security
- Inspect upload limits: **3 MiB**, MIME allow-list JPEG/PNG/WebP (`upload.limits.ts`)
- Basic security response headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`)
- Authz matrix unit smoke (`authz.matrix.spec.ts`)

### Tests
- Unit: decision, late util, HttpAiAdapter, upload limits, QR payload, RBAC matrix
- Integration: Postgres via Testcontainers (`pnpm test:integration`; Docker required)
- Playwright: access smoke + RBAC UI (`pnpm test:e2e`)
- Perf: k6 light smoke (`perf/k6-smoke.js` → `pnpm test:perf`; skips cleanly if k6 not installed)

### CI
- Quality job: format, typecheck, unit tests, build
- Integration job: Testcontainers Postgres
- E2E job: Playwright against Postgres + Redis services
- AI syntax import check

## Commands

```bash
pnpm test
pnpm test:integration          # Docker required
pnpm --filter @granisafe/web test:e2e:install
pnpm test:e2e                  # API + DB (+ web) required
pnpm test:perf                 # optional; needs k6 on PATH
```

## Next

Phase 10 — deploy packaging, demo storyboard, `v1.0.0`.
