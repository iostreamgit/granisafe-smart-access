import { useCallback, useEffect, useState } from 'react';
import { PermissionCode } from '@granisafe/shared';
import { ApiError, apiDownload, apiGet, apiSend } from '../../lib/api';
import { useAuthStore } from '../../features/auth/auth-store';
import type { Department } from '../../features/employees/types';
import styles from '../phase8/Phase8Pages.module.css';

type ReportKind = 'attendance' | 'rejections' | 'ppe-compliance';
type JobStatus = {
  jobId: string;
  type: string;
  format: string;
  status: string;
  error: string | null;
  downloadReady: boolean;
};

export function ReportsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const canExport = useAuthStore((s) => s.hasPermission(PermissionCode.REPORTS_EXPORT));
  const canViewEmployees = useAuthStore((s) => s.hasPermission(PermissionCode.EMPLOYEES_VIEW));

  const [kind, setKind] = useState<ReportKind>('attendance');
  const [format, setFormat] = useState<'XLSX' | 'PDF'>('XLSX');
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!accessToken || !canViewEmployees) return;
      try {
        setDepartments(await apiGet<Department[]>('/api/v1/departments', accessToken));
      } catch {
        /* optional */
      }
    })();
  }, [accessToken, canViewEmployees]);

  const poll = useCallback(
    async (jobId: string) => {
      if (!accessToken) return;
      for (let i = 0; i < 40; i += 1) {
        const status = await apiGet<JobStatus>(`/api/v1/reports/${jobId}`, accessToken);
        setJob(status);
        if (status.status === 'SUCCEEDED' || status.status === 'FAILED') return status;
        await new Promise((r) => setTimeout(r, 750));
      }
      return null;
    },
    [accessToken],
  );

  async function onGenerate() {
    if (!accessToken || !canExport) return;
    setBusy(true);
    setError(null);
    setJob(null);
    try {
      const created = await apiSend<{ jobId: string; status: string }>(
        'POST',
        `/api/v1/reports/${kind}`,
        accessToken,
        {
          from,
          to,
          format,
          ...(departmentId ? { departmentId } : {}),
        },
      );
      if (!created) throw new Error('No job returned');
      await poll(created.jobId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate report');
    } finally {
      setBusy(false);
    }
  }

  async function onDownload() {
    if (!accessToken || !job?.downloadReady) return;
    const ext = job.format === 'PDF' ? 'pdf' : 'xlsx';
    try {
      await apiDownload(
        `/api/v1/reports/${job.jobId}/download`,
        accessToken,
        `${job.type.toLowerCase()}.${ext}`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Download failed');
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>Reports</h2>
          <p className={styles.lede}>
            Export attendance, rejections, and PPE compliance (async XLSX / PDF).
          </p>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.filters}>
        <select value={kind} onChange={(e) => setKind(e.target.value as ReportKind)}>
          <option value="attendance">Attendance</option>
          <option value="rejections">Rejections</option>
          <option value="ppe-compliance">PPE compliance</option>
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select value={format} onChange={(e) => setFormat(e.target.value as 'XLSX' | 'PDF')}>
          <option value="XLSX">Excel (XLSX)</option>
          <option value="PDF">PDF</option>
        </select>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={!canExport || busy}
          onClick={() => void onGenerate()}
        >
          {busy ? 'Generating…' : 'Generate'}
        </button>
        {job?.downloadReady ? (
          <button type="button" className={styles.ghost} onClick={() => void onDownload()}>
            Download
          </button>
        ) : null}
      </div>

      {job ? (
        <p className={styles.meta}>
          Job {job.jobId.slice(0, 8)}… — <strong>{job.status}</strong>
          {job.error ? ` — ${job.error}` : ''}
        </p>
      ) : null}
    </div>
  );
}
