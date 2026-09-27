/**
 * Light k6 smoke — health + login + authenticated me.
 *
 * Usage (API must be running, DB seeded):
 *   k6 run -e BASE_URL=http://localhost:3000 -e EMAIL=guard@granisafe.local -e PASSWORD=Password123! perf/k6-smoke.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 3,
  duration: '20s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

const BASE = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = __ENV.EMAIL || 'guard@granisafe.local';
const PASSWORD = __ENV.PASSWORD || 'Password123!';

export default function () {
  const health = http.get(`${BASE}/health`);
  check(health, { 'health 200': (r) => r.status === 200 });

  const login = http.post(
    `${BASE}/api/v1/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(login, { 'login 200/201': (r) => r.status === 200 || r.status === 201 });

  let token = '';
  try {
    token = login.json('accessToken') || '';
  } catch {
    token = '';
  }

  if (token) {
    const me = http.get(`${BASE}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    check(me, { 'me 200': (r) => r.status === 200 });
  }

  sleep(0.5);
}
