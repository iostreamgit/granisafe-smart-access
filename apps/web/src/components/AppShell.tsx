import { NavLink, Outlet } from 'react-router-dom';
import { APP_NAME } from '@granisafe/shared';
import { useAuthStore } from '../features/auth/auth-store';
import { NAV_ITEMS } from '../app/navigation';
import styles from './AppShell.module.css';

const ICONS: Record<string, string[]> = {
  '/app/dashboard': ['M4 11.5 12 4l8 7.5V20h-6v-6H10v6H4z'],
  '/app/access': ['M8 11V8a4 4 0 1 1 8 0v3', 'M7 11h10v9H7z'],
  '/app/employees': [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  '/app/attendance': [
    'M8 3v4',
    'M16 3v4',
    'M5 11h14',
    'M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  ],
  '/app/reports': ['M5 19V9', 'M10 19V5', 'M15 19v-7', 'M20 19V8'],
  '/app/notifications': [
    'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9',
    'M10 21a2 2 0 0 0 4 0',
  ],
  '/app/users': [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  '/app/audit': [
    'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2',
    'M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2 2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2',
    'M9 12h6',
    'M9 16h4',
  ],
  '/app/settings': ['M4 7h16', 'M4 12h16', 'M4 17h16', 'M8 5v4', 'M16 10v4', 'M10 15v4'],
  '/app/profile': [
    'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2',
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  ],
};

function NavIcon({ path }: { path: string }) {
  const parts = ICONS[path] ?? ICONS['/app/dashboard']!;
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden>
      {parts.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

function initialsFromName(name: string | undefined) {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);

  const items = NAV_ITEMS.filter((item) => !item.permissions || hasAnyPermission(item.permissions));

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brandBlock}>
          <div className={styles.logoPlate}>
            <img
              className={styles.logo}
              src="/brand/gss-logo.png"
              alt="Grani Safe Solution"
              width={160}
              height={80}
            />
          </div>
          <p className={styles.brand}>{APP_NAME}</p>
        </div>
        <nav className={styles.nav} aria-label="Main">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? `${styles.link} ${styles.linkActive}` : styles.link
              }
            >
              <NavIcon path={item.to} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={styles.userBox}>
          <div className={styles.userCard}>
            <span className={styles.avatar} aria-hidden>
              {initialsFromName(user?.fullName)}
            </span>
            <div className={styles.userMeta}>
              <strong>{user?.fullName}</strong>
              <p>{user?.roles.join(' · ')}</p>
            </div>
          </div>
          <button type="button" onClick={() => void logout()} className={styles.logout}>
            Sign out
          </button>
        </div>
      </aside>
      <section className={styles.content}>
        <Outlet />
      </section>
    </div>
  );
}
