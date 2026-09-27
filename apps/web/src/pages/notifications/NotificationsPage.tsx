import { useCallback, useEffect, useState } from 'react';
import { ListPager } from '../../components/ListPager';
import { ApiError, apiGet, apiSend } from '../../lib/api';
import { useAuthStore } from '../../features/auth/auth-store';
import styles from '../phase8/Phase8Pages.module.css';

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  payload?: unknown;
};

type ListResponse = {
  data: NotificationRow[];
  meta: { page: number; pageSize: number; total: number; unreadCount: number };
};

const NOTIFICATION_TYPES = [
  'ACCESS_DENIED',
  'CAMERA_OFFLINE',
  'AI_UNAVAILABLE',
  'SYSTEM',
] as const;

export function NotificationsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [type, setType] = useState('');
  const [readFilter, setReadFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [type, readFilter, from, to, pageSize]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (type) params.set('type', type);
    if (readFilter) params.set('isRead', readFilter);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await apiGet<ListResponse>(
      `/api/v1/notifications?${params.toString()}`,
      accessToken,
    );
    setData(res);
  }, [accessToken, page, pageSize, type, readFilter, from, to]);

  useEffect(() => {
    void (async () => {
      try {
        setError(null);
        await load();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load notifications');
      }
    })();
  }, [load]);

  async function markOne(id: string) {
    if (!accessToken) return;
    await apiSend('POST', `/api/v1/notifications/${id}/read`, accessToken);
    await load();
  }

  async function markAll() {
    if (!accessToken) return;
    await apiSend('POST', '/api/v1/notifications/read-all', accessToken);
    await load();
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>Notifications</h2>
          <p className={styles.lede}>In-app alerts for denials, camera offline, and AI outages.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} onClick={() => void markAll()}>
            Mark all read
          </button>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.filters}>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type filter">
          <option value="">All types</option>
          {NOTIFICATION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={readFilter}
          onChange={(e) => setReadFilter(e.target.value)}
          aria-label="Read status filter"
        >
          <option value="">All statuses</option>
          <option value="false">Unread</option>
          <option value="true">Read</option>
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {data ? (
        <p className={styles.meta}>
          {data.meta.unreadCount} unread overall · {data.meta.total} matching
        </p>
      ) : null}

      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Type</th>
              <th>Message</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data?.data ?? []).map((n) => (
              <tr key={n.id} className={n.isRead ? undefined : styles.unread}>
                <td>{new Date(n.createdAt).toLocaleString()}</td>
                <td>
                  <span className={styles.badge}>{n.type}</span>
                </td>
                <td>
                  <div>{n.title}</div>
                  <div className={styles.lede}>{n.body}</div>
                </td>
                <td>
                  {!n.isRead ? (
                    <button
                      type="button"
                      className={styles.ghost}
                      onClick={() => void markOne(n.id)}
                    >
                      Mark read
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {!data?.data.length ? (
              <tr>
                <td colSpan={4}>No notifications for these filters.</td>
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
