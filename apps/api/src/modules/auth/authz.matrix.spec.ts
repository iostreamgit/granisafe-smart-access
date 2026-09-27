import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PermissionCode, ROLE_PERMISSIONS, RoleCode } from '@granisafe/shared';

describe('RBAC matrix smoke (Phase 9)', () => {
  it('admin has settings, audit, and reports export', () => {
    const admin = ROLE_PERMISSIONS[RoleCode.ADMIN] ?? [];
    assert.ok(admin.includes(PermissionCode.SETTINGS_MANAGE));
    assert.ok(admin.includes(PermissionCode.AUDIT_VIEW));
    assert.ok(admin.includes(PermissionCode.REPORTS_EXPORT));
  });

  it('guard can operate access and view notifications but not settings', () => {
    const guard = ROLE_PERMISSIONS[RoleCode.GUARD] ?? [];
    assert.ok(guard.includes(PermissionCode.ACCESS_OPERATE));
    assert.ok(guard.includes(PermissionCode.NOTIFICATIONS_VIEW));
    assert.ok(!guard.includes(PermissionCode.SETTINGS_MANAGE));
    assert.ok(!guard.includes(PermissionCode.AUDIT_VIEW));
    assert.ok(!guard.includes(PermissionCode.REPORTS_EXPORT));
  });

  it('hr can export reports but not manage settings', () => {
    const hr = ROLE_PERMISSIONS[RoleCode.HR] ?? [];
    assert.ok(hr.includes(PermissionCode.REPORTS_VIEW));
    assert.ok(hr.includes(PermissionCode.REPORTS_EXPORT));
    assert.ok(!hr.includes(PermissionCode.SETTINGS_MANAGE));
  });

  it('employee cannot operate access or view audit', () => {
    const employee = ROLE_PERMISSIONS[RoleCode.EMPLOYEE] ?? [];
    assert.ok(!employee.includes(PermissionCode.ACCESS_OPERATE));
    assert.ok(!employee.includes(PermissionCode.AUDIT_VIEW));
    assert.ok(employee.includes(PermissionCode.ATTENDANCE_VIEW_SELF));
  });
});
