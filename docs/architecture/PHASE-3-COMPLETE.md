# Phase 3 — Employees & Organization

## Delivered

- Prisma: `departments`, `employees`, `employee_identifiers`
- Departments CRUD (soft delete)
- Employees CRUD, deactivate, soft delete
- QR generate / view / regenerate / PNG download
- Optional RFID identifier
- Seed: Welding, Logistics, Safety + 3 employees
- Web Employees page (list, filters, create, QR modal, departments tab)

## Permissions

| Action | Permission |
|--------|------------|
| List employees/departments | `employees.view` |
| Manage employees / QR | `employees.manage` |
| Manage departments | `departments.manage` |

Guard can view list; HR/Admin can create and print QR.

## Setup

```bash
pnpm --filter @granisafe/api prisma:deploy
pnpm --filter @granisafe/api prisma:seed
pnpm dev
```
