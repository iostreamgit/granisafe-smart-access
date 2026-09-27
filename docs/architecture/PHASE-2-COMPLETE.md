# Phase 2 — Authentication & RBAC

## Delivered

- Prisma models: companies, users, roles, permissions, joins, refresh_tokens, audit_logs
- Initial SQL migration `20260801120000_phase2_auth_rbac`
- Seed: 5 demo users (Admin, Guard, Supervisor, HR, Employee)
- Auth API: login, refresh, logout, change-password, bootstrap, me, admin-check
- Users API: list/create/update/assign-role + roles list (permission-gated)
- Audit API: list (Admin)
- JWT access tokens + hashed rotating refresh tokens
- Argon2id password hashing
- Web login, session hydrate/refresh, role-based nav shell, route guards

## Demo accounts (after seed)

| Email | Role |
|-------|------|
| admin@granisafe.local | ADMIN |
| guard@granisafe.local | GUARD |
| supervisor@granisafe.local | SUPERVISOR |
| hr@granisafe.local | HR |
| employee@granisafe.local | EMPLOYEE |

Password: `SEED_PASSWORD` or `Password123!`

## Setup (requires Postgres)

```bash
# Start Postgres (Docker Desktop)
pnpm infra:up

# From apps/api (or filter)
pnpm --filter @granisafe/api prisma:generate
pnpm --filter @granisafe/api prisma:deploy
pnpm --filter @granisafe/api prisma:seed
pnpm dev
```

## Exit criteria

- [x] Schema + seed for roles/permissions/users
- [x] Login / refresh / logout + JWT guards
- [x] Frontend login + role nav + route guards
- [x] Audit on login and role assignment
- [ ] Live verify 5 menus + API 403 (needs Postgres on this machine)
