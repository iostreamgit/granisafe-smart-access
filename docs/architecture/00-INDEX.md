# Granisafe Smart Access — Architecture & Planning Pack

**Product:** AI-Assisted Smart Access Control and Attendance Platform for PPE Compliance  
**Organization:** Granisafe Solution  
**Document status:** Architecture validation (no application code yet)  
**Audience:** Internship mentors, technical leads, future commercial product team

---

## How to read this pack

Validate sections **1 → 16** in order. Development must not start until stakeholders approve:

1. Business process and roles (Sections 1–2, 7)
2. Architecture and stack (Sections 3–5)
3. Data and API contracts (Sections 6, 8)
4. AI boundaries (Section 9)
5. UX and security (Sections 10–11)
6. Delivery plan (Sections 12–16)

---

## Document map

| # | Document | Purpose |
|---|----------|---------|
| 1 | [01-functional-analysis.md](./01-functional-analysis.md) | Actors, use cases, stories, rules, edge cases |
| 2 | [02-software-requirements.md](./02-software-requirements.md) | Functional & non-functional requirements |
| 3 | [03-system-architecture.md](./03-system-architecture.md) | Architecture style, diagrams, rationale |
| 4 | [04-technology-stack.md](./04-technology-stack.md) | Stack choices with justifications |
| 5 | [05-folder-structure.md](./05-folder-structure.md) | Monorepo layout |
| 6 | [06-database-design.md](./06-database-design.md) | Schema, indexes, ER diagram |
| 7 | [07-user-roles.md](./07-user-roles.md) | RBAC permissions matrix |
| 8 | [08-api-design.md](./08-api-design.md) | REST contracts, auth, errors |
| 9 | [09-ai-module-design.md](./09-ai-module-design.md) | PPE detection pipeline |
| 10 | [10-ui-ux-design.md](./10-ui-ux-design.md) | Pages, navigation, wireframes |
| 11 | [11-security.md](./11-security.md) | Threat model & controls |
| 12 | [12-development-roadmap.md](./12-development-roadmap.md) | Phased delivery plan |
| 13 | [13-git-strategy.md](./13-git-strategy.md) | Branching, commits, versioning |
| 14 | [14-testing-strategy.md](./14-testing-strategy.md) | Test pyramid & UAT |
| 15 | [15-deployment.md](./15-deployment.md) | Environments, Docker, ops |
| 16 | [16-future-improvements.md](./16-future-improvements.md) | Post-V1 roadmap |

---

## Guiding principles

| Principle | Application |
|-----------|-------------|
| AI is a module, not the product | Detection is an isolated service behind a stable contract |
| Clean Architecture | Domain rules independent of frameworks and UI |
| Modular monolith first | One deployable API with clear bounded contexts; extract later |
| Commercial readiness | Multi-tenant hooks, auditability, RBAC, observability from day one |
| Internship realism | No hardware, no face recognition, simulated gate |
| Minimal refactor path | Contracts and modules designed so later phases plug in |

---

## Out of scope (V1)

Face recognition, LPR, fire/smoke detection, physical gate/turnstile hardware, fingerprint, payroll, ERP, inventory, accounting.
