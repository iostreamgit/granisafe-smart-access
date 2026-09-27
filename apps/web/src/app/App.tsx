import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PermissionCode } from '@granisafe/shared';
import { AppShell } from '../components/AppShell';
import { RequireAuth } from '../features/auth/RequireAuth';
import { RequirePermission } from '../features/auth/RequirePermission';
import { useAuthStore } from '../features/auth/auth-store';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { LoginPage } from '../pages/login/LoginPage';
import { ProfilePage } from '../pages/profile/ProfilePage';
import { UsersPage } from '../pages/users/UsersPage';
import { AccessKioskPage } from '../pages/access/AccessKioskPage';
import { AttendancePage } from '../pages/attendance/AttendancePage';
import { EmployeesPage } from '../pages/employees/EmployeesPage';
import { AuditPage } from '../pages/audit/AuditPage';
import { NotificationsPage } from '../pages/notifications/NotificationsPage';
import { ReportsPage } from '../pages/reports/ReportsPage';
import { SettingsPage } from '../pages/settings/SettingsPage';

function HomeRedirect() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  if (hasPermission(PermissionCode.DASHBOARD_VIEW)) {
    return <Navigate to="/app/dashboard" replace />;
  }
  return <Navigate to="/app/profile" replace />;
}

export function App() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app" element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<HomeRedirect />} />
            <Route
              path="dashboard"
              element={
                <RequirePermission permission={PermissionCode.DASHBOARD_VIEW}>
                  <DashboardPage />
                </RequirePermission>
              }
            />
            <Route
              path="access"
              element={
                <RequirePermission permission={PermissionCode.ACCESS_OPERATE}>
                  <AccessKioskPage />
                </RequirePermission>
              }
            />
            <Route
              path="employees"
              element={
                <RequirePermission permission={PermissionCode.EMPLOYEES_VIEW}>
                  <EmployeesPage />
                </RequirePermission>
              }
            />
            <Route
              path="attendance"
              element={
                <RequirePermission
                  anyOf={[
                    PermissionCode.ATTENDANCE_VIEW_SELF,
                    PermissionCode.ATTENDANCE_VIEW_TEAM,
                    PermissionCode.ATTENDANCE_VIEW_ALL,
                  ]}
                >
                  <AttendancePage />
                </RequirePermission>
              }
            />
            <Route
              path="reports"
              element={
                <RequirePermission permission={PermissionCode.REPORTS_VIEW}>
                  <ReportsPage />
                </RequirePermission>
              }
            />
            <Route
              path="notifications"
              element={
                <RequirePermission permission={PermissionCode.NOTIFICATIONS_VIEW}>
                  <NotificationsPage />
                </RequirePermission>
              }
            />
            <Route
              path="users"
              element={
                <RequirePermission permission={PermissionCode.USERS_MANAGE}>
                  <UsersPage />
                </RequirePermission>
              }
            />
            <Route
              path="audit"
              element={
                <RequirePermission permission={PermissionCode.AUDIT_VIEW}>
                  <AuditPage />
                </RequirePermission>
              }
            />
            <Route
              path="settings"
              element={
                <RequirePermission permission={PermissionCode.SETTINGS_MANAGE}>
                  <SettingsPage />
                </RequirePermission>
              }
            />
            <Route
              path="profile"
              element={
                <RequirePermission permission={PermissionCode.PROFILE_VIEW_SELF}>
                  <ProfilePage />
                </RequirePermission>
              }
            />
          </Route>
        </Route>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
