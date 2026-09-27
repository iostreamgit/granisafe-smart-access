import { PermissionCode } from '@granisafe/shared';

export type NavItem = {
  to: string;
  label: string;
  permissions?: string[];
};

export const NAV_ITEMS: NavItem[] = [
  { to: '/app/dashboard', label: 'Dashboard', permissions: [PermissionCode.DASHBOARD_VIEW] },
  { to: '/app/access', label: 'Access Control', permissions: [PermissionCode.ACCESS_OPERATE] },
  { to: '/app/employees', label: 'Employees', permissions: [PermissionCode.EMPLOYEES_VIEW] },
  {
    to: '/app/attendance',
    label: 'Attendance',
    permissions: [
      PermissionCode.ATTENDANCE_VIEW_SELF,
      PermissionCode.ATTENDANCE_VIEW_TEAM,
      PermissionCode.ATTENDANCE_VIEW_ALL,
    ],
  },
  { to: '/app/reports', label: 'Reports', permissions: [PermissionCode.REPORTS_VIEW] },
  {
    to: '/app/notifications',
    label: 'Notifications',
    permissions: [PermissionCode.NOTIFICATIONS_VIEW],
  },
  { to: '/app/users', label: 'Users & Roles', permissions: [PermissionCode.USERS_MANAGE] },
  { to: '/app/audit', label: 'Audit Logs', permissions: [PermissionCode.AUDIT_VIEW] },
  { to: '/app/settings', label: 'Settings', permissions: [PermissionCode.SETTINGS_MANAGE] },
  { to: '/app/profile', label: 'Profile', permissions: [PermissionCode.PROFILE_VIEW_SELF] },
];
