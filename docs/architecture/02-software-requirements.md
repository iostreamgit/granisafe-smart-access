# 2. Software Requirements Specification (SRS)

## 2.1 Product purpose

Granisafe Smart Access is an enterprise web platform that:

1. Identifies employees (QR; optional RFID simulation).
2. Verifies required PPE via an AI detection module.
3. Grants or denies site access (gate simulated).
4. Records attendance and operational events.
5. Provides dashboards, reports, notifications, RBAC, and auditability.

AI is a **bounded capability**, not the product center of gravity.

---

## 2.2 Functional requirements

### FR-AUTH — Authentication & session

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AUTH-01 | Users authenticate with email/username + password | P0 |
| FR-AUTH-02 | System issues JWT access token + refresh token | P0 |
| FR-AUTH-03 | Users can log out (refresh token revoked/rotated) | P0 |
| FR-AUTH-04 | Password reset via secure tokenized flow (email stub OK in V1) | P1 |
| FR-AUTH-05 | Idle timeout configurable (default 30 min; kiosk longer) | P1 |

### FR-RBAC — Roles & permissions

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-RBAC-01 | System supports roles: Admin, Guard, Supervisor, HR, Employee | P0 |
| FR-RBAC-02 | Permissions enforced on every API call | P0 |
| FR-RBAC-03 | Admin can assign/revoke roles | P0 |
| FR-RBAC-04 | Custom roles deferred; V1 uses fixed role set with permission matrix | P2 |

### FR-ORG — Organization

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-ORG-01 | CRUD departments | P0 |
| FR-ORG-02 | Employees belong to zero or one department (V1) | P0 |
| FR-ORG-03 | Soft-delete preserves history | P0 |

### FR-EMP — Employees

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-EMP-01 | CRUD employee profile (name, ID, dept, status, contact) | P0 |
| FR-EMP-02 | Generate unique QR payload per employee | P0 |
| FR-EMP-03 | Regenerate QR invalidates previous code | P0 |
| FR-EMP-04 | Optional RFID tag identifier field | P1 |
| FR-EMP-05 | Activate/deactivate employee | P0 |
| FR-EMP-06 | Link employee to system user account (optional) | P1 |

### FR-PPE — PPE policy

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-PPE-01 | Configure required classes: helmet, safety_vest, uniform | P0 |
| FR-PPE-02 | Configure confidence threshold per class | P0 |
| FR-PPE-03 | Department-level override of global policy | P1 |
| FR-PPE-04 | Store policy version used on each access attempt | P0 |

### FR-ACC — Access control

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-ACC-01 | Accept QR scan payload and resolve employee | P0 |
| FR-ACC-02 | Accept RFID identifier (manual/simulated) | P1 |
| FR-ACC-03 | Trigger camera capture after successful identity | P0 |
| FR-ACC-04 | Call AI service and obtain structured detections | P0 |
| FR-ACC-05 | Compute grant/deny from policy + detections | P0 |
| FR-ACC-06 | Display decision and reasons on kiosk/guard UI | P0 |
| FR-ACC-07 | Simulate gate open for configurable duration | P0 |
| FR-ACC-08 | Persist access events with evidence reference | P0 |
| FR-ACC-09 | Support ENTRY and EXIT modes | P0 |
| FR-ACC-10 | Fail-closed when AI/camera unavailable | P0 |
| FR-ACC-11 | Duplicate-scan cooldown | P1 |

### FR-ATT — Attendance

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-ATT-01 | Create ENTRY on granted entry access | P0 |
| FR-ATT-02 | Create EXIT on exit flow | P0 |
| FR-ATT-03 | Compute late flag from shift/grace rules | P1 |
| FR-ATT-04 | Query attendance by employee, dept, date range | P0 |
| FR-ATT-05 | Prevent orphaned silent corrections; anomalies logged | P1 |

### FR-AI — AI module interface

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AI-01 | Detect only helmet, safety_vest, uniform | P0 |
| FR-AI-02 | Return labels, confidences, optional bounding boxes | P0 |
| FR-AI-03 | Health endpoint for readiness | P0 |
| FR-AI-04 | Configurable timeout and retry (max 2) | P0 |
| FR-AI-05 | No face recognition or other classes in V1 | P0 |

### FR-DASH — Live dashboard

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-DASH-01 | Show recent grants/denials | P0 |
| FR-DASH-02 | Show current on-site count (open sessions) | P0 |
| FR-DASH-03 | Show camera status | P1 |
| FR-DASH-04 | Show AI service status | P0 |
| FR-DASH-05 | Near-real-time updates via WebSocket/SSE | P1 |

### FR-RPT — Reports

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-RPT-01 | Attendance report with filters | P1 |
| FR-RPT-02 | Rejected access report | P1 |
| FR-RPT-03 | PPE compliance statistics | P1 |
| FR-RPT-04 | Export PDF | P1 |
| FR-RPT-05 | Export Excel | P1 |

### FR-NTF — Notifications

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-NTF-01 | Notify on rejected entries | P1 |
| FR-NTF-02 | Notify on camera offline | P1 |
| FR-NTF-03 | Notify on AI unavailable | P0 |
| FR-NTF-04 | In-app notification center | P1 |

### FR-AUD — Audit

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AUD-01 | Log authentication, CRUD, policy, role, access overrides | P0 |
| FR-AUD-02 | Audit records immutable via app layer | P0 |
| FR-AUD-03 | Admin can search/filter audit logs | P1 |

### FR-SET — Settings & profile

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-SET-01 | Admin configures thresholds, grace, cooldown, retention | P1 |
| FR-SET-02 | Users view/edit own profile (limited fields) | P1 |
| FR-SET-03 | Users change own password | P1 |

---

## 2.3 Non-functional requirements

### Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-PERF-01 | Access decision latency (identity resolved → decision), excluding human positioning | p95 ≤ **3.0 s** on reference GPU/CPU profile |
| NFR-PERF-02 | API CRUD endpoints | p95 ≤ **300 ms** under nominal load |
| NFR-PERF-03 | Dashboard initial load | ≤ **2.5 s** on broadband |
| NFR-PERF-04 | Concurrent kiosks supported in V1 | ≥ **5** access points |
| NFR-PERF-05 | AI single-frame inference | p95 ≤ **1.5 s** (GPU) / ≤ **3.0 s** (CPU demo) |

**Justification:** Industrial gate UX must feel interactive; 3s decision budget is acceptable for internship demo while leaving headroom for model work.

### Security

| ID | Requirement |
|----|-------------|
| NFR-SEC-01 | All traffic HTTPS in staging/production |
| NFR-SEC-02 | Passwords hashed with Argon2id (or bcrypt cost ≥ 12) |
| NFR-SEC-03 | JWT short-lived access (15m) + rotating refresh |
| NFR-SEC-04 | RBAC on every mutating/sensitive read |
| NFR-SEC-05 | OWASP ASVS L2-oriented controls for V1 |
| NFR-SEC-06 | Secrets only via environment / secret manager |
| NFR-SEC-07 | Evidence images access-controlled; not public URLs |
| NFR-SEC-08 | Rate limiting on auth and access endpoints |

### Availability

| ID | Requirement |
|----|-------------|
| NFR-AVL-01 | Target V1 demo availability: best-effort; production target **99.5%** monthly for API |
| NFR-AVL-02 | AI outage must not crash platform; degrade fail-closed |
| NFR-AVL-03 | Health probes for API, DB, AI, storage |

### Scalability

| ID | Requirement |
|----|-------------|
| NFR-SCL-01 | Stateless API instances horizontally scalable |
| NFR-SCL-02 | AI service independently scalable |
| NFR-SCL-03 | DB schema supports growth to multi-site / multi-company later (nullable `company_id` reserved) |
| NFR-SCL-04 | V1 sizing: ≤ 2,000 employees, ≤ 5,000 access attempts/day |

### Maintainability

| ID | Requirement |
|----|-------------|
| NFR-MNT-01 | Clean Architecture layering; domain independent of Nest/React |
| NFR-MNT-02 | Module boundaries per bounded context |
| NFR-MNT-03 | OpenAPI-generated contracts where practical |
| NFR-MNT-04 | Lint + typed codebase; CI required to pass |
| NFR-MNT-05 | Architecture Decision Records (ADRs) for major choices |

### Usability

| ID | Requirement |
|----|-------------|
| NFR-USB-01 | Guard kiosk usable at ~1.5–2m viewing distance (large decision states) |
| NFR-USB-02 | Denial reasons in plain language |
| NFR-USB-03 | WCAG 2.1 AA as target for admin screens; kiosk high-contrast states |
| NFR-USB-04 | French/English i18n-ready keys (V1 language: project choice, default FR or EN) |

### Reliability

| ID | Requirement |
|----|-------------|
| NFR-REL-01 | Access attempt state machine prevents double grant side-effects |
| NFR-REL-02 | DB transactions around decision + attendance write |
| NFR-REL-03 | Retry only safe/idempotent AI calls with attempt id |
| NFR-REL-04 | Automated backups for PostgreSQL (prod) |
| NFR-REL-05 | Structured logging with correlation id per access attempt |

---

## 2.4 Constraints

- No physical hardware integration in V1.
- No face recognition.
- Browser-based camera via `getUserMedia` for kiosk.
- Internship timeline favors modular monolith + separate AI service.
- Must be demonstrable on a single workstation/Docker Compose stack.

---

## 2.5 Assumptions

- Site provides adequate lighting for PPE visibility.
- One primary camera per access point in V1.
- Employees wear visually distinguishable helmet/vest/uniform classes supported by chosen model dataset.
- Single company tenant in V1 (schema prepared for multi-company).
