# 5. Folder Structure

## 5.1 Monorepo root

```text
granisafe-smart-access/
├── apps/
│   ├── web/                      # React SPA (admin + kiosk)
│   ├── api/                      # NestJS modular monolith
│   └── ai-service/               # FastAPI PPE detection
├── packages/
│   ├── shared/                   # Shared Zod schemas, enums, DTO types
│   └── tsconfig/                 # Shared TS configs
├── deploy/
│   ├── docker/
│   │   ├── Dockerfile.web
│   │   ├── Dockerfile.api
│   │   └── Dockerfile.ai
│   └── compose/
│       ├── docker-compose.yml
│       ├── docker-compose.dev.yml
│       └── docker-compose.prod.yml
├── docs/
│   ├── architecture/             # This planning pack
│   ├── adr/                      # Architecture Decision Records
│   └── user-guides/              # Later
├── scripts/                      # DB seed, demo data, tooling
├── .github/workflows/            # CI/CD
├── .env.example
├── package.json                  # Workspace root
├── pnpm-workspace.yaml
└── README.md
```

**Justification:** Apps are deployable units; `packages/shared` prevents API drift; `docs/` preserves internship/commercial knowledge.

---

## 5.2 Frontend (`apps/web`)

```text
apps/web/
├── public/
├── src/
│   ├── app/                      # App shell, providers, router
│   ├── pages/                    # Route-level screens
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── employees/
│   │   ├── attendance/
│   │   ├── access-kiosk/         # Live camera + scan
│   │   ├── reports/
│   │   ├── notifications/
│   │   ├── settings/
│   │   ├── audit/
│   │   └── profile/
│   ├── features/                 # Feature-sliced UI logic
│   │   ├── auth/
│   │   ├── employees/
│   │   ├── access/
│   │   ├── attendance/
│   │   └── reports/
│   ├── components/               # Shared presentational components
│   ├── hooks/
│   ├── lib/                      # API client, socket, config
│   ├── styles/
│   └── assets/
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

**Pattern:** Feature folders for domain UI; pages compose features. Matches maintainability over “dump everything in components/”.

---

## 5.3 Backend (`apps/api`) — Clean Architecture

```text
apps/api/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── main.ts
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── organization/         # departments
│   │   ├── employees/
│   │   ├── ppe-policy/
│   │   ├── access-control/       # identify, inspect, decide, gate sim
│   │   ├── attendance/
│   │   ├── notifications/
│   │   ├── reports/
│   │   ├── audit/
│   │   ├── realtime/
│   │   └── health/
│   ├── shared/
│   │   ├── config/
│   │   ├── database/
│   │   ├── storage/
│   │   ├── security/
│   │   └── utils/
│   └── jobs/                     # BullMQ processors
├── test/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── package.json
└── tsconfig.json
```

### Per-module internal layout

```text
access-control/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── services/                 # AccessDecisionService
│   └── ports/                    # AiDetectorPort, GatePort, ...
├── application/
│   ├── use-cases/
│   ├── dto/
│   └── mappers/
├── infrastructure/
│   ├── persistence/
│   ├── ai-http.adapter.ts
│   └── gate-simulation.adapter.ts
└── interfaces/
    ├── http/                     # Controllers
    and listeners/
```

**Justification:** Ports & adapters keep YOLO/HTTP/DB out of domain decision logic—critical for tests and commercial hardware swaps.

---

## 5.4 AI service (`apps/ai-service`)

```text
apps/ai-service/
├── app/
│   ├── main.py
│   ├── api/
│   │   ├── routes_detect.py
│   │   └── routes_health.py
│   ├── core/
│   │   ├── config.py
│   │   └── security.py
│   ├── domain/
│   │   └── detection_result.py
│   ├── services/
│   │   ├── model_loader.py
│   │   ├── detector.py
│   │   └── quality_gate.py
│   └── schemas/
├── models/                       # Weights (git-lfs or downloaded in entrypoint)
├── tests/
│   ├── fixtures/images/
│   └── test_detect.py
├── requirements.txt
├── Dockerfile
└── README.md
```

---

## 5.5 Shared types (`packages/shared`)

```text
packages/shared/
├── src/
│   ├── enums/
│   │   ├── roles.ts
│   │   ├── access-decision.ts
│   │   ├── ppe-class.ts
│   │   └── attendance-type.ts
│   ├── schemas/
│   │   ├── access.ts
│   │   ├── employee.ts
│   │   └── reports.ts
│   └── index.ts
├── package.json
└── tsconfig.json
```

Python AI service duplicates only the minimal detect I/O schema in Pydantic (documented as contract twin); Core API remains the business orchestrator.

---

## 5.6 Configuration & assets

```text
config surfaces:
- apps/*/.env (local, gitignored)
- .env.example (documented keys)
- deploy/compose/*.yml (service wiring)
- docs/architecture (human decisions)

assets:
- apps/web/src/assets (brand, icons)
- apps/ai-service/models (weights, not source)
- apps/ai-service/tests/fixtures/images (PPE goldens)
```

---

## 5.7 Documentation & testing homes

| Concern | Location |
|---------|----------|
| Architecture pack | `docs/architecture/` |
| ADRs | `docs/adr/NNNN-title.md` |
| API human docs | OpenAPI UI + `docs/` excerpts |
| Unit/integration | colocated `test/` per app |
| E2E | `apps/web` Playwright + optional root `e2e/` |
| Load | `scripts/load/` (k6) |

---

## 5.8 Why this structure scales

- New hardware = new adapter under `access-control/infrastructure`.
- Multi-company = mostly data column + middleware, not rewrite.
- Mobile app later consumes same API; no UI coupling.
- AI model swap changes `ai-service` only if detect contract preserved.
