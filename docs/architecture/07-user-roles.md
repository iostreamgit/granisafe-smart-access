# 7. User Roles & Permissions Matrix

## 7.1 Role definitions

| Role | Code | Intent |
|------|------|--------|
| Administrator | `ADMIN` | Full configuration, users, audit, settings |
| Security Guard | `GUARD` | Operate kiosk, monitor live access, handle denials |
| Supervisor | `SUPERVISOR` | Oversee compliance & team attendance; limited config |
| HR | `HR` | Employees, departments, attendance, exports |
| Employee | `EMPLOYEE` | Self-service profile & own attendance |

A user may hold **one primary role in V1** (simplifies UX). Schema supports multiple roles for later.

---

## 7.2 Permission codes

| Permission | Description |
|------------|-------------|
| `dashboard.view` | View operational dashboard |
| `dashboard.live` | Receive realtime access feed |
| `employees.view` | List/view employees |
| `employees.manage` | Create/update/deactivate employees, QR |
| `departments.manage` | CRUD departments |
| `attendance.view_all` | View all attendance |
| `attendance.view_team` | View department/team attendance |
| `attendance.view_self` | View own attendance |
| `access.operate` | Run identify/inspect kiosk flows |
| `access.view_events` | View access event history |
| `ppe.policy.manage` | Configure PPE policies |
| `reports.view` | View reports |
| `reports.export` | Export PDF/Excel |
| `notifications.view` | Use notification center |
| `settings.manage` | System settings |
| `users.manage` | Manage users & roles |
| `audit.view` | View audit logs |
| `profile.view_self` | View own profile |
| `profile.edit_self` | Edit limited own fields |

---

## 7.3 Permissions matrix

| Permission | Admin | Guard | Supervisor | HR | Employee |
|------------|:-----:|:-----:|:----------:|:--:|:--------:|
| `dashboard.view` | ✓ | ✓ | ✓ | ✓ | — |
| `dashboard.live` | ✓ | ✓ | ✓ | — | — |
| `employees.view` | ✓ | ✓ | ✓ | ✓ | — |
| `employees.manage` | ✓ | — | — | ✓ | — |
| `departments.manage` | ✓ | — | — | ✓ | — |
| `attendance.view_all` | ✓ | — | ✓ | ✓ | — |
| `attendance.view_team` | ✓ | — | ✓ | ✓ | — |
| `attendance.view_self` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `access.operate` | ✓ | ✓ | — | — | — |
| `access.view_events` | ✓ | ✓ | ✓ | ✓ | — |
| `ppe.policy.manage` | ✓ | — | — | — | — |
| `reports.view` | ✓ | — | ✓ | ✓ | — |
| `reports.export` | ✓ | — | ✓ | ✓ | — |
| `notifications.view` | ✓ | ✓ | ✓ | ✓ | ✓* |
| `settings.manage` | ✓ | — | — | — | — |
| `users.manage` | ✓ | — | — | — | — |
| `audit.view` | ✓ | — | — | — | — |
| `profile.view_self` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `profile.edit_self` | ✓ | ✓ | ✓ | ✓ | ✓ |

\* Employee notifications limited to personal attendance anomalies if enabled; default minimal.

---

## 7.4 Screen access (UX mapping)

| Screen | Admin | Guard | Supervisor | HR | Employee |
|--------|-------|-------|------------|----|----------|
| Login | ✓ | ✓ | ✓ | ✓ | ✓ |
| Dashboard | ✓ | ✓ | ✓ | ✓ | — |
| Access Kiosk / Live Camera | ✓ | ✓ | read-only optional | — | — |
| Employees | ✓ | view | view | ✓ | — |
| Attendance | ✓ | self | ✓ | ✓ | self |
| Reports | ✓ | — | ✓ | ✓ | — |
| Notifications | ✓ | ✓ | ✓ | ✓ | limited |
| Settings | ✓ | — | — | — | — |
| Users & Roles | ✓ | — | — | — | — |
| Audit Logs | ✓ | — | — | — | — |
| Profile | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 7.5 Enforcement rules

1. JWT carries `sub`, `company_id`, `roles[]`.
2. Permissions resolved server-side from DB (cached in Redis with short TTL).
3. UI hides unauthorized nav items **and** API returns `403`.
4. Kiosk mode uses Guard credentials or dedicated kiosk user with `access.operate` only.

**Justification:** Defense in depth; UI never trusted for authorization.
