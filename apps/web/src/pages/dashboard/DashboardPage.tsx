import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { PermissionCode } from '@granisafe/shared';
import { LiveClock } from '../../components/LiveClock';
import { ApiError, apiGet } from '../../lib/api';
import { useAuthStore } from '../../features/auth/auth-store';
import type { DashboardSummary, LiveAccessEvent } from '../../features/dashboard/types';
import styles from './DashboardPage.module.css';

type EventsResponse = {
  items: Array<{
    id: string;
    direction: string;
    status: string;
    accessPointCode?: string;
    startedAt: string;
    finishedAt: string | null;
    employee: { id: string; employeeCode: string; fullName: string };
    decision: {
      decision: string;
      reasons: Array<{ code: string; message: string; ppeClass?: string }>;
    } | null;
  }>;
};

function mapEvent(item: EventsResponse['items'][number]): LiveAccessEvent {
  return {
    id: item.id,
    direction: item.direction,
    status: item.status,
    decision: item.decision?.decision ?? null,
    startedAt: item.startedAt,
    finishedAt: item.finishedAt,
    accessPointCode: item.accessPointCode ?? 'GATE-1',
    employee: item.employee,
    reasons: item.decision?.reasons,
  };
}

function aiChipClass(status: string) {
  if (status === 'UP') return styles.chipOk;
  if (status === 'DOWN') return styles.chipDown;
  return styles.chipWarn;
}

export function DashboardPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canLive = hasPermission(PermissionCode.DASHBOARD_LIVE);
  const canOperate = hasPermission(PermissionCode.ACCESS_OPERATE);
  const canViewEvents = hasPermission(PermissionCode.ACCESS_VIEW_EVENTS);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [events, setEvents] = useState<LiveAccessEvent[]>([]);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!accessToken) return;
    const data = await apiGet<DashboardSummary>('/api/v1/dashboard/summary', accessToken);
    setSummary(data);
  }, [accessToken]);

  const loadEvents = useCallback(async () => {
    if (!accessToken || !canViewEvents) return;
    const data = await apiGet<EventsResponse>('/api/v1/access/events?pageSize=25', accessToken);
    setEvents(data.items.map(mapEvent));
  }, [accessToken, canViewEvents]);

  useEffect(() => {
    void (async () => {
      try {
        setError(null);
        await Promise.all([loadSummary(), loadEvents()]);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load dashboard');
      }
    })();
  }, [loadSummary, loadEvents]);

  useEffect(() => {
    if (!accessToken || !canLive) return;

    const socket: Socket = io('/ws', {
      path: '/socket.io',
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => setLive(true));
    socket.on('disconnect', () => setLive(false));
    socket.on('access.event.created', (event: LiveAccessEvent) => {
      setEvents((prev) => [event, ...prev.filter((e) => e.id !== event.id)].slice(0, 40));
      void loadSummary();
    });
    socket.on('system.camera.status', () => {
      void loadSummary();
    });

    return () => {
      socket.disconnect();
      setLive(false);
    };
  }, [accessToken, canLive, loadSummary]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2>Dashboard</h2>
          <p className={styles.lede}>
            Operations overview for {user?.fullName}.
            {canLive ? ' Live feed enabled.' : ' Live feed requires dashboard.live.'}
          </p>
        </div>
        <div className={styles.headerAside}>
          <LiveClock variant="light" className={styles.headerClock} />
          {canOperate && (
            <Link className={styles.linkBtn} to="/app/access">
              Open Access Kiosk
            </Link>
          )}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.metrics}>
        <div className={styles.metric}>
          <label>On site</label>
          <strong>{summary?.onSiteCount ?? '—'}</strong>
        </div>
        <div className={styles.metric}>
          <label>Entries today</label>
          <strong>{summary?.entriesToday ?? '—'}</strong>
        </div>
        <div className={styles.metric}>
          <label>Denied today</label>
          <strong>{summary?.deniedToday ?? '—'}</strong>
        </div>
      </div>

      <div className={styles.statusRow}>
        <span className={aiChipClass(summary?.aiStatus ?? '')}>AI: {summary?.aiStatus ?? '…'}</span>
        {(summary?.cameraStatuses?.length
          ? summary.cameraStatuses
          : [{ accessPointCode: 'GATE-1', status: 'UNKNOWN' }]
        ).map((cam) => (
          <span
            key={cam.accessPointCode}
            className={
              cam.status === 'ONLINE'
                ? styles.chipOk
                : cam.status === 'OFFLINE' || cam.status === 'UNKNOWN'
                  ? styles.chipDown
                  : styles.chipWarn
            }
          >
            {cam.accessPointCode}: {cam.status}
          </span>
        ))}
        {canLive && (
          <span className={live ? styles.chipLive : styles.chipMuted}>
            {live ? 'Live connected' : 'Live connecting…'}
          </span>
        )}
      </div>

      <section className={styles.panel}>
        <h3>Recent access</h3>
        {!events.length ? (
          <p className={styles.empty}>
            {canViewEvents
              ? 'No access events yet. Run a kiosk inspect to populate the feed.'
              : 'You do not have permission to view access events.'}
          </p>
        ) : (
          <ul className={styles.feed}>
            {events.map((event) => {
              const denied = event.decision === 'DENIED' || event.status === 'DENIED';
              return (
                <li key={event.id} className={styles.feedItem}>
                  <span className={denied ? styles.badgeDenied : styles.badgeOk}>
                    {event.decision ?? event.status}
                  </span>
                  <div>
                    <div>
                      {event.employee.fullName}{' '}
                      <span className={styles.meta}>({event.employee.employeeCode})</span>
                    </div>
                    <div className={styles.meta}>
                      {event.direction} · {event.accessPointCode} ·{' '}
                      {new Date(event.finishedAt ?? event.startedAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className={styles.meta}>{event.status}</div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
