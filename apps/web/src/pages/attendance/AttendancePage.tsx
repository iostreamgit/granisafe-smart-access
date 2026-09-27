import { useCallback, useEffect, useState } from 'react';
import { PermissionCode } from '@granisafe/shared';
import { ApiError, apiGet } from '../../lib/api';
import { useAuthStore } from '../../features/auth/auth-store';
import type { AttendanceListResponse, OnSiteResponse } from '../../features/attendance/types';
import type { Department } from '../../features/employees/types';
import styles from './AttendancePage.module.css';

type Tab = 'onsite' | 'history';

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString();
}

export function AttendancePage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const canViewBroad = useAuthStore(
    (s) =>
      s.hasPermission(PermissionCode.ATTENDANCE_VIEW_ALL) ||
      s.hasPermission(PermissionCode.ATTENDANCE_VIEW_TEAM),
  );
  const canViewEmployees = useAuthStore((s) => s.hasPermission(PermissionCode.EMPLOYEES_VIEW));

  const [tab, setTab] = useState<Tab>('onsite');
  const [error, setError] = useState<string | null>(null);
  const [onSite, setOnSite] = useState<OnSiteResponse | null>(null);
  const [history, setHistory] = useState<AttendanceListResponse | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [punchType, setPunchType] = useState('');
  const [lateOnly, setLateOnly] = useState(false);

  const loadOnSite = useCallback(async () => {
    if (!accessToken) return;
    const data = await apiGet<OnSiteResponse>('/api/v1/attendance/current-on-site', accessToken);
    setOnSite(data);
  }, [accessToken]);

  const loadHistory = useCallback(async () => {
    if (!accessToken) return;
    const params = new URLSearchParams();
    if (from) params.set('from', new Date(from).toISOString());
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      params.set('to', end.toISOString());
    }
    if (departmentId) params.set('departmentId', departmentId);
    if (punchType) params.set('punchType', punchType);
    if (lateOnly) params.set('lateOnly', 'true');
    params.set('pageSize', '100');
    const qs = params.toString();
    const data = await apiGet<AttendanceListResponse>(
      `/api/v1/attendance${qs ? `?${qs}` : ''}`,
      accessToken,
    );
    setHistory(data);
  }, [accessToken, from, to, departmentId, punchType, lateOnly]);

  useEffect(() => {
    void (async () => {
      if (!accessToken || !canViewEmployees) return;
      try {
        const data = await apiGet<Department[]>('/api/v1/departments', accessToken);
        setDepartments(data);
      } catch {
        /* departments filter optional for self-only roles */
      }
    })();
  }, [accessToken, canViewEmployees]);

  useEffect(() => {
    void (async () => {
      try {
        setError(null);
        if (tab === 'onsite') await loadOnSite();
        else await loadHistory();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load attendance');
      }
    })();
  }, [tab, loadOnSite, loadHistory]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>Attendance</h2>
          <p>Current presence and punch history (Phase 4 — no AI wiring yet).</p>
        </div>
        <div className={styles.tabs}>
          <button
            type="button"
            className={tab === 'onsite' ? styles.tabActive : styles.tab}
            onClick={() => setTab('onsite')}
          >
            Current on-site
          </button>
          <button
            type="button"
            className={tab === 'history' ? styles.tabActive : styles.tab}
            onClick={() => setTab('history')}
          >
            History
          </button>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {tab === 'history' && (
        <div className={styles.filters}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          {canViewBroad && (
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          )}
          <select value={punchType} onChange={(e) => setPunchType(e.target.value)}>
            <option value="">All punches</option>
            <option value="ENTRY">ENTRY</option>
            <option value="EXIT">EXIT</option>
          </select>
          <label>
            <input
              type="checkbox"
              checked={lateOnly}
              onChange={(e) => setLateOnly(e.target.checked)}
            />{' '}
            Late only
          </label>
        </div>
      )}

      {tab === 'onsite' && (
        <>
          <p className={styles.meta}>{onSite ? `${onSite.count} on site` : 'Loading…'}</p>
          {!onSite?.items.length ? (
            <p className={styles.empty}>No one currently on site.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Last entry</th>
                    <th>Late</th>
                  </tr>
                </thead>
                <tbody>
                  {onSite.items.map((item) => (
                    <tr key={item.employeeId}>
                      <td>
                        {item.firstName} {item.lastName}
                        <div className={styles.meta}>{item.employeeCode}</div>
                      </td>
                      <td>{item.department?.code ?? '—'}</td>
                      <td>{formatWhen(item.lastEntry.punchedAt)}</td>
                      <td>
                        <span className={item.lastEntry.isLate ? styles.badgeWarn : styles.badgeOk}>
                          {item.lastEntry.isLate ? 'Late' : 'On time'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        <>
          <p className={styles.meta}>
            {history ? `${history.total} record${history.total === 1 ? '' : 's'}` : 'Loading…'}
          </p>
          {!history?.items.length ? (
            <p className={styles.empty}>No attendance records for these filters.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Punch</th>
                    <th>Late</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {history.items.map((row) => (
                    <tr key={row.id}>
                      <td>{formatWhen(row.punchedAt)}</td>
                      <td>
                        {row.employee.firstName} {row.employee.lastName}
                        <div className={styles.meta}>{row.employee.employeeCode}</div>
                      </td>
                      <td>{row.employee.department?.code ?? '—'}</td>
                      <td>
                        <span className={styles.badgeMuted}>{row.punchType}</span>
                      </td>
                      <td>
                        {row.punchType === 'ENTRY' ? (
                          <span className={row.isLate ? styles.badgeWarn : styles.badgeOk}>
                            {row.isLate ? 'Late' : 'On time'}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>{row.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
