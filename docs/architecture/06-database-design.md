# 6. Database Design

**Engine:** PostgreSQL 16  
**ORM:** Prisma  
**Keys:** UUID (`uuid` / `gen_random_uuid()`) for public identifiers  
**Timestamps:** `timestamptz` UTC  
**Soft delete:** `deleted_at` where historical integrity matters  

Reserved for commercialization: nullable `company_id` on tenant-owned tables (unused in V1 UI).

---

## 6.1 ER diagram

```mermaid
erDiagram
  COMPANIES ||--o{ USERS : has
  COMPANIES ||--o{ DEPARTMENTS : has
  COMPANIES ||--o{ EMPLOYEES : has
  DEPARTMENTS ||--o{ EMPLOYEES : contains
  USERS ||--o{ USER_ROLES : has
  ROLES ||--o{ USER_ROLES : assigned
  ROLES ||--o{ ROLE_PERMISSIONS : grants
  PERMISSIONS ||--o{ ROLE_PERMISSIONS : included
  EMPLOYEES ||--o| USERS : linked_account
  EMPLOYEES ||--o{ EMPLOYEE_IDENTIFIERS : has
  EMPLOYEES ||--o{ ATTENDANCE_RECORDS : punches
  EMPLOYEES ||--o{ ACCESS_ATTEMPTS : attempts
  PPE_POLICIES ||--o{ PPE_POLICY_ITEMS : includes
  DEPARTMENTS ||--o| PPE_POLICIES : override
  ACCESS_ATTEMPTS ||--o| ACCESS_DECISIONS : results_in
  ACCESS_ATTEMPTS ||--o{ ACCESS_DETECTION_ITEMS : detections
  ACCESS_ATTEMPTS ||--o| ATTENDANCE_RECORDS : may_create
  USERS ||--o{ NOTIFICATIONS : receives
  USERS ||--o{ AUDIT_LOGS : performs
  USERS ||--o{ REFRESH_TOKENS : owns

  COMPANIES {
    uuid id PK
    string name
    string slug
    timestamptz created_at
  }

  USERS {
    uuid id PK
    uuid company_id FK
    string email
    string password_hash
    string full_name
    boolean is_active
    timestamptz last_login_at
    timestamptz created_at
    timestamptz deleted_at
  }

  ROLES {
    uuid id PK
    string code
    string name
  }

  PERMISSIONS {
    uuid id PK
    string code
    string description
  }

  USER_ROLES {
    uuid user_id FK
    uuid role_id FK
  }

  ROLE_PERMISSIONS {
    uuid role_id FK
    uuid permission_id FK
  }

  DEPARTMENTS {
    uuid id PK
    uuid company_id FK
    string name
    string code
    uuid ppe_policy_id FK
    timestamptz deleted_at
  }

  EMPLOYEES {
    uuid id PK
    uuid company_id FK
    uuid department_id FK
    uuid user_id FK
    string employee_code
    string first_name
    string last_name
    string status
    time shift_start
    int late_grace_minutes
    timestamptz deleted_at
  }

  EMPLOYEE_IDENTIFIERS {
    uuid id PK
    uuid employee_id FK
    string type
    string value_hash
    string display_hint
    boolean is_active
    timestamptz rotated_at
  }

  PPE_POLICIES {
    uuid id PK
    uuid company_id FK
    string name
    boolean is_default
    int version
  }

  PPE_POLICY_ITEMS {
    uuid id PK
    uuid policy_id FK
    string ppe_class
    boolean required
    decimal min_confidence
  }

  ACCESS_ATTEMPTS {
    uuid id PK
    uuid company_id FK
    uuid employee_id FK
    string direction
    string status
    uuid policy_id FK
    int policy_version
    string evidence_object_key
    string correlation_id
    timestamptz started_at
    timestamptz finished_at
  }

  ACCESS_DECISIONS {
    uuid id PK
    uuid access_attempt_id FK
    string decision
    jsonb reasons
    boolean gate_simulated
    int gate_open_ms
    timestamptz decided_at
  }

  ACCESS_DETECTION_ITEMS {
    uuid id PK
    uuid access_attempt_id FK
    string ppe_class
    boolean detected
    decimal confidence
    jsonb bbox
  }

  ATTENDANCE_RECORDS {
    uuid id PK
    uuid company_id FK
    uuid employee_id FK
    uuid access_attempt_id FK
    string punch_type
    timestamptz punched_at
    boolean is_late
    string source
  }

  NOTIFICATIONS {
    uuid id PK
    uuid user_id FK
    string type
    string title
    string body
    jsonb payload
    boolean is_read
    timestamptz created_at
  }

  AUDIT_LOGS {
    uuid id PK
    uuid company_id FK
    uuid actor_user_id FK
    string action
    string entity_type
    uuid entity_id
    jsonb metadata
    inet ip_address
    timestamptz created_at
  }

  REFRESH_TOKENS {
    uuid id PK
    uuid user_id FK
    string token_hash
    timestamptz expires_at
    timestamptz revoked_at
  }

  SYSTEM_SETTINGS {
    uuid id PK
    uuid company_id FK
    string key
    jsonb value
  }

  CAMERA_STATUS {
    uuid id PK
    uuid company_id FK
    string access_point_code
    string status
    timestamptz last_heartbeat_at
  }
```

---

## 6.2 Table dictionary

### `companies`
Why: Commercial multi-tenant foundation; V1 seeds one row (“Granisafe Demo”).  
PK: `id`. Unique: `slug`.

### `users`
Why: Login principals for Admin/Guard/Supervisor/HR/Employee portal users.  
Unique: `(company_id, email)`. Index: `(company_id, is_active)`.

### `roles` / `permissions` / `user_roles` / `role_permissions`
Why: Explicit RBAC instead of hardcoding only in JWT claims—auditability and future custom roles.  
Unique: `roles.code`, `permissions.code`. Composite PKs on join tables.

### `departments`
Why: Org structure + optional PPE policy override.  
Unique: `(company_id, code)`.

### `employees`
Why: Site workers subject to access/attendance—even without portal login.  
Unique: `(company_id, employee_code)`.  
`status`: `ACTIVE` | `INACTIVE`.  
FK `user_id` optional 1:1 for portal linkage.

### `employee_identifiers`
Why: Support QR and RFID without polluting employee row; enable rotation.  
`type`: `QR` | `RFID`.  
Store **hash** of secret payload (QR token); `display_hint` last4 for UI.  
Unique active value hash globally/company-scoped. Index: `(type, value_hash)` where `is_active`.

### `ppe_policies` / `ppe_policy_items`
Why: Configurable required PPE + thresholds; versioned for historical attempts.  
`ppe_class`: `HELMET` | `SAFETY_VEST` | `UNIFORM`.  
Check: `min_confidence` between 0 and 1.

### `access_attempts`
Why: System-of-record for each identify→inspect cycle.  
`direction`: `ENTRY` | `EXIT`.  
`status`: `IN_PROGRESS` | `GRANTED` | `DENIED` | `ERROR`.  
Indexes: `(employee_id, started_at DESC)`, `(status, started_at DESC)`, `(started_at)`.

### `access_decisions`
Why: Separates immutable decision payload from attempt lifecycle.  
1:1 with attempt. `reasons` JSON array of codes/messages.

### `access_detection_items`
Why: Persist per-class AI outputs for reports and disputes.  
Index: `(access_attempt_id)`.

### `attendance_records`
Why: HR attendance ledger distinct from security events.  
`punch_type`: `ENTRY` | `EXIT`.  
`source`: `ACCESS_GRANT` | `MANUAL` (manual reserved, Admin-only future).  
Indexes: `(employee_id, punched_at)`, `(punched_at)`, partial unique to support cooldown rules in app layer.  
FK to `access_attempt_id` nullable for future manual punches.

### `notifications`
Why: In-app notification center.  
Index: `(user_id, is_read, created_at DESC)`.

### `audit_logs`
Why: Who changed what—security & internship evaluation evidence.  
**Append-only** (no update/delete APIs). Index: `(entity_type, entity_id)`, `(actor_user_id, created_at)`.

### `refresh_tokens`
Why: Revocable sessions. Index: `(user_id)`, `(expires_at)`.

### `system_settings`
Why: Grace minutes, cooldown, retention days, fail-closed toggles.  
Unique: `(company_id, key)`.

### `camera_status`
Why: Dashboard camera health without hardware NMS. Updated by kiosk heartbeats.

---

## 6.3 Critical constraints

| Constraint | Detail |
|------------|--------|
| Employee active for access | Enforced in use case + optional DB check via status |
| One open ENTRY session | Enforced in application transaction (query open ENTRY without EXIT) |
| Identifier uniqueness | Unique on active QR/RFID hashes |
| Decision completeness | `GRANTED`/`DENIED` attempts must have `access_decisions` row |
| Attendance on grant ENTRY only | Application invariant + integration tests |
| Cascade rules | Soft-delete employees; hard FKs restrict deleting referenced dims |

---

## 6.4 Indexing strategy (summary)

- Equality lookups on codes/emails/hashes.
- Time-series queries on `access_attempts.started_at`, `attendance_records.punched_at`.
- Dashboard filters on `status` + time.
- Avoid over-indexing write-heavy columns without query evidence.

---

## 6.5 Retention

| Data | Default V1 |
|------|------------|
| Evidence images | 90 days (configurable) |
| Access attempts | 12 months |
| Audit logs | 12 months minimum |
| Notifications | 30 days read / 90 days unread purge job |

Job: scheduled cleanup worker in API.

---

## 6.6 Why not store video

Frames are enough for PPE proof and storage cost control. Video deferred to future analytics.
