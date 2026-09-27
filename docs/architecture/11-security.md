# 11. Security Design

## 11.1 Threat-oriented goals

Protect: employee PII, credentials, access decisions integrity, evidence images, admin functions.  
Assume: kiosk on semi-trusted site network; internet exposure for cloud deploy later.

---

## 11.2 Authentication

| Control | Implementation |
|---------|----------------|
| Login | Email + password |
| Password hashing | **Argon2id** (preferred) or bcrypt cost ≥ 12 |
| Access token | JWT RS256 or HS256 with strong secret; **15 min** TTL |
| Refresh token | Rotating, hashed at rest, revoke on logout/password change |
| Claims | `sub`, `company_id`, `roles`, `jti` |
| Session idle | Frontend idle timer + refresh failure → login |
| Kiosk | Dedicated guard user; optional pinned device policy later |

**Justification:** Short-lived JWT + revocable refresh balances scalability and incident response.

---

## 11.3 Authorization

- RBAC permission matrix enforced via Nest guards.
- Deny by default.
- Object-level rules: Employee role can only read own attendance (`view_self`).
- AI service not reachable from public internet.

---

## 11.4 JWT specifics

- Algorithm pinned; `none` rejected.
- Validate `exp`, `iss`, `aud`.
- Do not store sensitive PII in claims beyond need.
- Key rotation procedure documented in runbook (V1.1).

---

## 11.5 Audit logs

Log at minimum:
- Login success/failure (careful with lockout noise)
- User/role changes
- Employee create/update/deactivate
- QR regenerate
- PPE policy changes
- Settings changes
- Access decisions (also in access_events)
- Report exports

No update/delete API for audit rows.

---

## 11.6 Injection & XSS

| Risk | Prevention |
|------|------------|
| SQL injection | Prisma parameterized queries only; no raw SQL unless parameterized |
| XSS | React escaping; sanitize any HTML reports; CSP headers |
| Command injection | No shelling user input; fixed model paths |
| Path traversal | Object keys generated server-side UUIDs |

---

## 11.7 CSRF

- SPA + JWT in Authorization header avoids classic cookie CSRF for API.
- If refresh cookie used: `SameSite=Strict/Lax`, `Secure`, `HttpOnly`, plus CSRF token on refresh if cross-site needed.
- Prefer same-site deployments.

---

## 11.8 Rate limiting

- Redis-backed limits on `/auth/login`, `/access/*`, report generation.
- Progressive delay / temporary lock after repeated failures.
- Return `429` with `Retry-After`.

---

## 11.9 Transport & headers

- HTTPS only outside local dev.
- HSTS in production.
- Security headers: CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Frame-Ancestors` deny for admin (kiosk may allow local fullscreen).
- CORS allowlist of known frontends.

---

## 11.10 Secure file uploads

| Rule | Value |
|------|-------|
| Allowed MIME | `image/jpeg`, `image/png` |
| Max size | 5 MB |
| Magic-byte sniff | Verify content matches MIME |
| Re-encode optional | Strip EXIF if privacy policy requires |
| Storage | Private bucket; signed URL GET with short TTL |
| Filename | Server-generated UUID key |

---

## 11.11 Secrets management

- `.env` local only; never commit.
- Compose secrets / OS env in staging/prod.
- Separate JWT secret, DB password, AI API key, object storage keys.
- Rotate demo credentials before any external demo.

---

## 11.12 OWASP-aligned checklist (V1)

| OWASP ASVS / Top 10 theme | V1 control |
|---------------------------|------------|
| Broken access control | RBAC guards + tests |
| Cryptographic failures | Argon2id, TLS, no plaintext secrets |
| Injection | ORM + validation |
| Insecure design | Fail-closed access, threat modeling in this doc |
| Security misconfiguration | Hardened Docker, security headers |
| Vulnerable components | Dependabot / npm audit / pip audit in CI |
| Auth failures | Rate limit, refresh rotation |
| Integrity failures | Audit trail, locked dependency versions |
| Logging failures | Structured security logs + audit table |
| SSRF | AI URL allowlisted internal hostname only |

---

## 11.13 Privacy notes

- Evidence images may contain faces incidentally; no face matching.
- Retention limits enforced.
- Internship report should disclose camera processing purpose (PPE compliance).

---

## 11.14 Security testing (see also §14)

- Authz negative tests per role
- Upload malware-like polyglot rejection
- ZAP baseline scan on staging
- Secret scanning in CI
