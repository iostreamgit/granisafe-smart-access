import { useMemo } from 'react';
import { useAuthStore } from '../../features/auth/auth-store';
import styles from './ProfilePage.module.css';

const PERMISSION_LABELS: Record<string, string> = {
  'dashboard.view': 'View dashboard',
  'dashboard.live': 'Live dashboard feed',
  'employees.view': 'View employees',
  'employees.manage': 'Manage employees',
  'departments.manage': 'Manage departments',
  'attendance.view_all': 'View all attendance',
  'attendance.view_team': 'View team attendance',
  'attendance.view_self': 'View own attendance',
  'access.operate': 'Operate access kiosk',
  'access.view_events': 'View access events',
  'ppe.policy.manage': 'Manage PPE policy',
  'reports.view': 'View reports',
  'reports.export': 'Export reports',
  'notifications.view': 'View notifications',
  'settings.manage': 'Manage settings',
  'users.manage': 'Manage users',
  'audit.view': 'View audit logs',
  'profile.view_self': 'View own profile',
  'profile.edit_self': 'Edit own profile',
};

const GROUP_ORDER = [
  'Dashboard',
  'Employees',
  'Attendance',
  'Access',
  'Reports',
  'Notifications',
  'Admin',
  'Profile',
  'Other',
] as const;

function groupForPermission(code: string): (typeof GROUP_ORDER)[number] {
  if (code.startsWith('dashboard.')) return 'Dashboard';
  if (code.startsWith('employees.') || code.startsWith('departments.')) return 'Employees';
  if (code.startsWith('attendance.')) return 'Attendance';
  if (code.startsWith('access.') || code.startsWith('ppe.')) return 'Access';
  if (code.startsWith('reports.')) return 'Reports';
  if (code.startsWith('notifications.')) return 'Notifications';
  if (code.startsWith('settings.') || code.startsWith('users.') || code.startsWith('audit.')) {
    return 'Admin';
  }
  if (code.startsWith('profile.')) return 'Profile';
  return 'Other';
}

function initialsFromName(name: string | undefined) {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

function formatRole(role: string) {
  return role
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);

  const permissionGroups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const code of user?.permissions ?? []) {
      const group = groupForPermission(code);
      const list = map.get(group) ?? [];
      list.push(code);
      map.set(group, list);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      title: g,
      items: (map.get(g) ?? []).sort(),
    }));
  }, [user?.permissions]);

  if (!user) {
    return (
      <div className={styles.page}>
        <h2>Profile</h2>
        <p className={styles.empty}>Sign in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.avatar} aria-hidden>
          {initialsFromName(user.fullName)}
        </div>
        <div className={styles.identity}>
          <p className={styles.eyebrow}>Your account</p>
          <h2>{user.fullName}</h2>
          <p className={styles.email}>{user.email}</p>
          <div className={styles.roles}>
            {user.roles.map((role) => (
              <span key={role} className={styles.roleChip}>
                {formatRole(role)}
              </span>
            ))}
          </div>
        </div>
      </header>

      <section className={styles.section} aria-labelledby="account-heading">
        <h3 id="account-heading">Account details</h3>
        <dl className={styles.details}>
          <div>
            <dt>Full name</dt>
            <dd>{user.fullName}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Roles</dt>
            <dd>{user.roles.map(formatRole).join(' · ') || '—'}</dd>
          </div>
          <div>
            <dt>Permissions</dt>
            <dd>
              {user.permissions.length} active right
              {user.permissions.length === 1 ? '' : 's'}
            </dd>
          </div>
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="permissions-heading">
        <div className={styles.sectionHead}>
          <h3 id="permissions-heading">Access rights</h3>
          <p>What this account can do in Granisafe Smart Access.</p>
        </div>

        {!permissionGroups.length ? (
          <p className={styles.empty}>No permissions assigned.</p>
        ) : (
          <div className={styles.groups}>
            {permissionGroups.map((group) => (
              <div key={group.title} className={styles.group}>
                <h4>{group.title}</h4>
                <ul>
                  {group.items.map((code) => (
                    <li key={code}>
                      <span className={styles.permLabel}>
                        {PERMISSION_LABELS[code] ?? code}
                      </span>
                      <code className={styles.permCode}>{code}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
