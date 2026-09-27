# Granisafe Smart Access

AI-Assisted Smart Access Control and Attendance Platform for PPE Compliance.

**Current milestone:** Phase 9 complete → Phase 10 (deploy & demo)

## Quick start

### Prerequisites

- Node.js 20+ (22 recommended)
- pnpm 9 (`npm install -g pnpm@9.15.0`)
- Docker Desktop (Postgres / Redis / MinIO)
- Python **3.11 or 3.12** (AI stub; optional for Phase 2)

### 1. Install

```bash
pnpm install
cp .env.example .env
```

### 2. Start infrastructure

```powershell
.\scripts\dev-infra.ps1
```

### 3. Migrate + seed

```bash
pnpm db:setup
```

> Postgres is published on **5433** by default so it does not collide with a local Windows PostgreSQL install on 5432. Ensure `DATABASE_URL` uses port `5433`.

### 4. Run apps

```bash
pnpm dev
```

| App        | URL                          |
| ---------- | ---------------------------- |
| Web        | http://localhost:5173        |
| API health | http://localhost:3000/health |
| Login API  | `POST /api/v1/auth/login`    |

### Demo users (password `Password123!`)

| Email                      | Role       | Sees                                                    |
| -------------------------- | ---------- | ------------------------------------------------------- |
| admin@granisafe.local      | ADMIN      | Full nav                                                |
| guard@granisafe.local      | GUARD      | Dashboard, Access, Employees, Attendance, Notifications |
| supervisor@granisafe.local | SUPERVISOR | Dashboard, Employees, Attendance, Reports               |
| hr@granisafe.local         | HR         | Dashboard, Employees, Attendance, Reports               |
| employee@granisafe.local   | EMPLOYEE   | Profile, Attendance, Notifications                      |

Unauthorized API calls return **403** (try Guard → `GET /api/v1/users`).

## Monorepo layout

```text
apps/web            React + Vite SPA (login + role shell)
apps/api            NestJS API (auth, users, audit)
apps/ai-service     FastAPI PPE stub
packages/shared     Shared enums / permission matrix
deploy/             Docker + Compose
docs/architecture/  Planning pack
```

## Useful scripts

```bash
pnpm typecheck
pnpm build
pnpm db:setup
pnpm db:seed
pnpm infra:up
pnpm infra:down
```

## Docs

- Architecture index: [docs/architecture/00-INDEX.md](./docs/architecture/00-INDEX.md)
- Phase 2 notes: [docs/architecture/PHASE-2-COMPLETE.md](./docs/architecture/PHASE-2-COMPLETE.md)
- Phase 3 notes: [docs/architecture/PHASE-3-COMPLETE.md](./docs/architecture/PHASE-3-COMPLETE.md)
- Phase 4 notes: [docs/architecture/PHASE-4-COMPLETE.md](./docs/architecture/PHASE-4-COMPLETE.md)
- Phase 5 notes: [docs/architecture/PHASE-5-COMPLETE.md](./docs/architecture/PHASE-5-COMPLETE.md)
- Phase 6 notes: [docs/architecture/PHASE-6-COMPLETE.md](./docs/architecture/PHASE-6-COMPLETE.md)
- Phase 7 notes: [docs/architecture/PHASE-7-COMPLETE.md](./docs/architecture/PHASE-7-COMPLETE.md)
- Phase 8 notes: [docs/architecture/PHASE-8-COMPLETE.md](./docs/architecture/PHASE-8-COMPLETE.md)
- Phase 9 UAT: [docs/architecture/PHASE-9-UAT.md](./docs/architecture/PHASE-9-UAT.md)
- Phase 9 notes: [docs/architecture/PHASE-9-COMPLETE.md](./docs/architecture/PHASE-9-COMPLETE.md)
- Roadmap: [docs/architecture/12-development-roadmap.md](./docs/architecture/12-development-roadmap.md)

## Next

Phase 10 — Deploy packaging, demo storyboard, `v1.0.0`.
