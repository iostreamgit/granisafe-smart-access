# 8. API Design

## 8.1 Conventions

| Topic | Decision | Justification |
|-------|----------|---------------|
| Style | REST JSON | Simple, internship-friendly, OpenAPI tooling |
| Versioning | URL prefix `/api/v1` | Explicit, cacheable, easy gateway routing |
| Auth | Bearer JWT access token | Stateless API nodes |
| IDs | UUID path params | Opaque, merge-safe |
| Time | ISO-8601 UTC | No ambiguity |
| Errors | RFC 7807-inspired envelope | Consistent clients |
| Idempotency | `Idempotency-Key` on inspect | Safe retries |

Base URL examples:
- Local: `http://localhost:3000/api/v1`
- AI (internal): `http://ai-service:8000/v1`

---

## 8.2 Authentication strategy

1. `POST /auth/login` → `{ accessToken, expiresIn, user }` + refresh cookie/token.
2. Access token TTL **15 minutes**.
3. `POST /auth/refresh` rotates refresh token.
4. `POST /auth/logout` revokes refresh token.
5. Password change requires current password.

Service-to-service: API → AI uses `X-API-Key` or mTLS in prod; never exposed to browsers.

---

## 8.3 Standard error envelope

```json
{
  "type": "https://granisafe.local/errors/validation",
  "title": "Validation failed",
  "status": 400,
  "code": "VALIDATION_ERROR",
  "detail": "employeeCode is required",
  "correlationId": "9f2c...",
  "errors": [
    { "field": "employeeCode", "message": "Required" }
  ]
}
```

### Status codes

| Code | When |
|------|------|
| 200 | Success read/update |
| 201 | Created |
| 202 | Accepted async (report generation) |
| 204 | No content (logout/delete) |
| 400 | Validation / bad request |
| 401 | Missing/invalid auth |
| 403 | Authenticated but not permitted |
| 404 | Resource not found |
| 409 | Conflict (duplicate code, open session rule) |
| 422 | Semantic domain rule failure |
| 429 | Rate limited |
| 503 | Dependency unavailable (AI) surfaced as domain deny preferably on access flow |

Access flow prefers **200 with decision=DENIED** for business denials; HTTP 503 only if platform itself cannot process.

---

## 8.4 Endpoints

### Auth

#### `POST /api/v1/auth/login`

Request:
```json
{
  "email": "guard@granisafe.local",
  "password": "********"
}
```

Response `200`:
```json
{
  "accessToken": "eyJhbGciOi...",
  "expiresIn": 900,
  "user": {
    "id": "…",
    "email": "guard@granisafe.local",
    "fullName": "Sara Guard",
    "roles": ["GUARD"],
    "permissions": ["access.operate", "dashboard.view"]
  }
}
```

#### `POST /api/v1/auth/refresh` → new access token  
#### `POST /api/v1/auth/logout` → `204`  
#### `POST /api/v1/auth/change-password`

---

### Users & roles (Admin)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/users` | `users.manage` |
| POST | `/users` | `users.manage` |
| PATCH | `/users/{id}` | `users.manage` |
| POST | `/users/{id}/roles` | `users.manage` |
| GET | `/roles` | `users.manage` |

---

### Departments

| Method | Path | Permission |
|--------|------|------------|
| GET | `/departments` | `employees.view` |
| POST | `/departments` | `departments.manage` |
| PATCH | `/departments/{id}` | `departments.manage` |
| DELETE | `/departments/{id}` | `departments.manage` |

---

### Employees

| Method | Path | Permission |
|--------|------|------------|
| GET | `/employees` | `employees.view` |
| GET | `/employees/{id}` | `employees.view` |
| POST | `/employees` | `employees.manage` |
| PATCH | `/employees/{id}` | `employees.manage` |
| POST | `/employees/{id}/deactivate` | `employees.manage` |
| POST | `/employees/{id}/qr/regenerate` | `employees.manage` |
| GET | `/employees/{id}/qr` | `employees.manage` |

#### Create employee request
```json
{
  "employeeCode": "EMP-1042",
  "firstName": "Karim",
  "lastName": "Benali",
  "departmentId": "…",
  "shiftStart": "08:00:00",
  "lateGraceMinutes": 10,
  "rfidTag": optional
}
```

#### QR regenerate response
```json
{
  "employeeId": "…",
  "qrPayload": "GSA:v1:…",
  "qrImageDataUrl": "data:image/png;base64,…",
  "rotatedAt": "2026-08-01T10:00:00Z"
}
```

---

### PPE policies

| Method | Path | Permission |
|--------|------|------------|
| GET | `/ppe-policies` | `ppe.policy.manage` or Admin settings read |
| GET | `/ppe-policies/default` | authenticated staff |
| PUT | `/ppe-policies/{id}` | `ppe.policy.manage` |

```json
{
  "name": "Default Site PPE",
  "items": [
    { "ppeClass": "HELMET", "required": true, "minConfidence": 0.7 },
    { "ppeClass": "SAFETY_VEST", "required": true, "minConfidence": 0.7 },
    { "ppeClass": "UNIFORM", "required": true, "minConfidence": 0.65 }
  ]
}
```

---

### Access control

#### `POST /api/v1/access/identify`

Permission: `access.operate`

Request:
```json
{
  "method": "QR",
  "identifier": "GSA:v1:…",
  "direction": "ENTRY",
  "accessPointCode": "GATE-1"
}
```

Response `200`:
```json
{
  "attemptId": "…",
  "employee": {
    "id": "…",
    "fullName": "Karim Benali",
    "employeeCode": "EMP-1042",
    "departmentName": "Welding"
  },
  "requiredPpe": ["HELMET", "SAFETY_VEST", "UNIFORM"],
  "direction": "ENTRY"
}
```

Error business cases: `404` unknown identifier; `422` inactive employee.

#### `POST /api/v1/access/inspect`

`multipart/form-data`:
- `attemptId`
- `frame` (image file)
- Header `Idempotency-Key: <uuid>`

Response `200`:
```json
{
  "attemptId": "…",
  "decision": "DENIED",
  "reasons": [
    { "code": "MISSING_PPE", "ppeClass": "HELMET", "message": "Helmet not detected" }
  ],
  "detections": [
    { "ppeClass": "SAFETY_VEST", "detected": true, "confidence": 0.91 },
    { "ppeClass": "HELMET", "detected": false, "confidence": 0.22 },
    { "ppeClass": "UNIFORM", "detected": true, "confidence": 0.84 }
  ],
  "gate": { "simulated": false, "openMs": 0 },
  "attendanceRecorded": false
}
```

Granted example extras:
```json
{
  "decision": "GRANTED",
  "gate": { "simulated": true, "openMs": 3000 },
  "attendanceRecorded": true,
  "attendance": { "id": "…", "punchType": "ENTRY", "isLate": true }
}
```

#### `GET /api/v1/access/events`
Query: `from`, `to`, `status`, `employeeId`, `page`, `pageSize`  
Permission: `access.view_events`

#### `GET /api/v1/access/events/{id}`

---

### Attendance

| Method | Path | Notes |
|--------|------|-------|
| GET | `/attendance` | Filters; RBAC scopes self/team/all |
| GET | `/attendance/current-on-site` | Open sessions count/list |
| GET | `/attendance/{id}` | Detail |

---

### Dashboard

#### `GET /api/v1/dashboard/summary`
```json
{
  "onSiteCount": 128,
  "entriesToday": 340,
  "deniedToday": 27,
  "aiStatus": "UP",
  "cameraStatuses": [{ "accessPointCode": "GATE-1", "status": "ONLINE" }]
}
```

Realtime: WebSocket `/ws` events `access.event.created`, `system.ai.status`, `system.camera.status`.

---

### Reports

| Method | Path |
|--------|------|
| POST | `/reports/attendance` |
| POST | `/reports/rejections` |
| POST | `/reports/ppe-compliance` |
| GET | `/reports/{jobId}` |
| GET | `/reports/{jobId}/download` |

Request:
```json
{
  "from": "2026-07-01",
  "to": "2026-07-31",
  "departmentId": null,
  "format": "XLSX"
}
```

Response `202`: `{ "jobId": "…", "status": "QUEUED" }`

---

### Notifications

| Method | Path |
|--------|------|
| GET | `/notifications` |
| POST | `/notifications/{id}/read` |
| POST | `/notifications/read-all` |

---

### Audit & settings

| Method | Path | Permission |
|--------|------|------------|
| GET | `/audit-logs` | `audit.view` |
| GET | `/settings` | `settings.manage` |
| PUT | `/settings` | `settings.manage` |

---

### Profile

| Method | Path |
|--------|------|
| GET | `/me` |
| PATCH | `/me` |

---

### Health

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | public |
| GET | `/ready` | public |

---

## 8.5 Internal AI API (not public)

#### `POST /v1/detect`
```json
{
  "requestId": "attempt-uuid",
  "imageBase64": "…",
  "classes": ["helmet", "safety_vest", "uniform"]
}
```

Response:
```json
{
  "requestId": "attempt-uuid",
  "inferenceMs": 180,
  "detections": [
    { "class": "helmet", "confidence": 0.93, "bbox": [12, 40, 200, 180] }
  ]
}
```

#### `GET /v1/health` → model loaded flag, device (`cpu`/`cuda`)

---

## 8.6 Rate limiting (suggested)

| Endpoint group | Limit |
|----------------|-------|
| `/auth/login` | 10 / 15 min / IP |
| `/access/*` | 60 / min / user |
| `/reports/*` | 10 / hour / user |
| Global API | 300 / min / user |

---

## 8.7 Pagination

```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 20, "total": 135 }
}
```
