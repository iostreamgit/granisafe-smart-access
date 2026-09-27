import { useCallback, useEffect, useState } from 'react';
import { ListPager } from '../../components/ListPager';
import { ApiError, apiGet } from '../../lib/api';
import { useDebouncedValue } from '../../lib/use-debounced-value';
import { useAuthStore } from '../../features/auth/auth-store';
import styles from '../phase8/Phase8Pages.module.css';

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  actor: { id: string; email: string; fullName: string } | null;
};

type ListResponse = {
  data: AuditRow[];
  meta: { page: number; pageSize: number; total: number };
};

export function AuditPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const debouncedAction = useDebouncedValue(action);
  const debouncedEntityType = useDebouncedValue(entityType);

  useEffect(() => {
    setPage(1);
  }, [debouncedAction, debouncedEntityType, from, to, pageSize]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (debouncedAction) params.set('action', debouncedAction);
    if (debouncedEntityType) params.set('entityType', debouncedEntityType);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await apiGet<ListResponse>(`/api/v1/audit-logs?${params.toString()}`, accessToken);
    setData(res);
  }, [accessToken, page, pageSize, debouncedAction, debouncedEntityType, from, to]);

  useEffect(() => {
    void (async () => {
      try {
        setError(null);
        await load();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load audit logs');
      }
    })();
  }, [load]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>Audit Logs</h2>
          <p className={styles.lede}>Immutable security and configuration trail.</p>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.filters}>
        <input
          placeholder="Action contains…"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
        <input
          placeholder="Entity type…"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
        />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
            </tr>
          </thead>
          <tbody>
            {(data?.data ?? []).map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>{row.actor?.fullName ?? '—'}</td>
                <td>{row.action}</td>
                <td>
                  {row.entityType}
                  {row.entityId ? ` · ${row.entityId.slice(0, 8)}…` : ''}
                </td>
              </tr>
            ))}
            {!data?.data.length ? (
              <tr>
                <td colSpan={4}>No audit rows for these filters.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {data ? (
        <ListPager
          page={data.meta.page}
          pageSize={data.meta.pageSize}
          total={data.meta.total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      ) : null}
    </div>
  );
}
