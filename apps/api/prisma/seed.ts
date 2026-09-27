import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  AttendanceSource,
  EmployeeStatus,
  IdentifierType,
  PermissionCode,
  PpeClass,
  PunchType,
  ROLE_PERMISSIONS,
  RoleCode,
} from '@granisafe/shared';
import { createHash, randomBytes } from 'node:crypto';
import { computeIsLate } from '../src/modules/attendance/late.util';
import { DEFAULT_SETTINGS } from '../src/modules/settings/settings.keys';

const prisma = new PrismaClient();

function hashIdentifier(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function displayHint(value: string): string {
  return value.slice(-4);
}

function createQrPayload(): string {
  return `GSA:v1:${randomBytes(24).toString('base64url')}`;
}

const ROLE_NAMES: Record<string, string> = {
  [RoleCode.ADMIN]: 'Administrator',
  [RoleCode.GUARD]: 'Security Guard',
  [RoleCode.SUPERVISOR]: 'Supervisor',
  [RoleCode.HR]: 'HR',
  [RoleCode.EMPLOYEE]: 'Employee',
};

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  [PermissionCode.DASHBOARD_VIEW]: 'View operational dashboard',
  [PermissionCode.DASHBOARD_LIVE]: 'Receive realtime access feed',
  [PermissionCode.EMPLOYEES_VIEW]: 'List and view employees',
  [PermissionCode.EMPLOYEES_MANAGE]: 'Create, update, deactivate employees and QR',
  [PermissionCode.DEPARTMENTS_MANAGE]: 'Manage departments',
  [PermissionCode.ATTENDANCE_VIEW_ALL]: 'View all attendance',
  [PermissionCode.ATTENDANCE_VIEW_TEAM]: 'View team attendance',
  [PermissionCode.ATTENDANCE_VIEW_SELF]: 'View own attendance',
  [PermissionCode.ACCESS_OPERATE]: 'Operate access kiosk',
  [PermissionCode.ACCESS_VIEW_EVENTS]: 'View access events',
  [PermissionCode.PPE_POLICY_MANAGE]: 'Configure PPE policies',
  [PermissionCode.REPORTS_VIEW]: 'View reports',
  [PermissionCode.REPORTS_EXPORT]: 'Export PDF/Excel reports',
  [PermissionCode.NOTIFICATIONS_VIEW]: 'Use notification center',
  [PermissionCode.SETTINGS_MANAGE]: 'Manage system settings',
  [PermissionCode.USERS_MANAGE]: 'Manage users and roles',
  [PermissionCode.AUDIT_VIEW]: 'View audit logs',
  [PermissionCode.PROFILE_VIEW_SELF]: 'View own profile',
  [PermissionCode.PROFILE_EDIT_SELF]: 'Edit own profile fields',
};

const DEMO_USERS: Array<{ email: string; fullName: string; role: string }> = [
  { email: 'admin@granisafe.local', fullName: 'Amine Admin', role: RoleCode.ADMIN },
  { email: 'guard@granisafe.local', fullName: 'Sara Guard', role: RoleCode.GUARD },
  {
    email: 'supervisor@granisafe.local',
    fullName: 'Youssef Supervisor',
    role: RoleCode.SUPERVISOR,
  },
  { email: 'hr@granisafe.local', fullName: 'Nadia HR', role: RoleCode.HR },
  { email: 'employee@granisafe.local', fullName: 'Karim Employee', role: RoleCode.EMPLOYEE },
];

async function main() {
  const password = process.env.SEED_PASSWORD ?? 'Password123!';
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const company = await prisma.company.upsert({
    where: { slug: 'granisafe-demo' },
    update: { name: 'Granisafe Demo' },
    create: { name: 'Granisafe Demo', slug: 'granisafe-demo' },
  });

  for (const code of Object.values(PermissionCode)) {
    await prisma.permission.upsert({
      where: { code },
      update: { description: PERMISSION_DESCRIPTIONS[code] ?? code },
      create: {
        code,
        description: PERMISSION_DESCRIPTIONS[code] ?? code,
      },
    });
  }

  const permissions = await prisma.permission.findMany();
  const permissionByCode = new Map(permissions.map((p) => [p.code, p]));

  for (const code of Object.values(RoleCode)) {
    const role = await prisma.role.upsert({
      where: { code },
      update: { name: ROLE_NAMES[code] ?? code },
      create: { code, name: ROLE_NAMES[code] ?? code },
    });

    const wanted = ROLE_PERMISSIONS[code] ?? [];
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (wanted.length > 0) {
      await prisma.rolePermission.createMany({
        data: wanted
          .map((permCode) => permissionByCode.get(permCode))
          .filter((p): p is (typeof permissions)[number] => Boolean(p))
          .map((p) => ({ roleId: role.id, permissionId: p.id })),
      });
    }
  }

  const roles = await prisma.role.findMany();
  const roleByCode = new Map(roles.map((r) => [r.code, r]));

  for (const demo of DEMO_USERS) {
    const role = roleByCode.get(demo.role);
    if (!role) continue;

    const user = await prisma.user.upsert({
      where: {
        companyId_email: { companyId: company.id, email: demo.email },
      },
      update: {
        fullName: demo.fullName,
        passwordHash,
        isActive: true,
        deletedAt: null,
      },
      create: {
        companyId: company.id,
        email: demo.email,
        fullName: demo.fullName,
        passwordHash,
        isActive: true,
      },
    });

    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
  }

  const departments = [
    { code: 'WELD', name: 'Welding' },
    { code: 'LOG', name: 'Logistics' },
    { code: 'SAFE', name: 'Safety' },
  ];

  const departmentIds: Record<string, string> = {};
  for (const dept of departments) {
    const row = await prisma.department.upsert({
      where: { companyId_code: { companyId: company.id, code: dept.code } },
      update: { name: dept.name, deletedAt: null },
      create: { companyId: company.id, code: dept.code, name: dept.name },
    });
    departmentIds[dept.code] = row.id;
  }

  const portalEmployee = await prisma.user.findFirst({
    where: { companyId: company.id, email: 'employee@granisafe.local' },
  });

  const demoEmployees = [
    {
      employeeCode: 'EMP-1001',
      firstName: 'Karim',
      lastName: 'Benali',
      departmentCode: 'WELD',
      rfidTag: 'RFID-1001',
      userId: portalEmployee?.id,
    },
    {
      employeeCode: 'EMP-1002',
      firstName: 'Sara',
      lastName: 'Mansouri',
      departmentCode: 'LOG',
      rfidTag: 'RFID-1002',
    },
    {
      employeeCode: 'EMP-1003',
      firstName: 'Omar',
      lastName: 'Haddad',
      departmentCode: 'SAFE',
      rfidTag: 'RFID-1003',
    },
  ];

  for (const demo of demoEmployees) {
    const employee = await prisma.employee.upsert({
      where: {
        companyId_employeeCode: {
          companyId: company.id,
          employeeCode: demo.employeeCode,
        },
      },
      update: {
        firstName: demo.firstName,
        lastName: demo.lastName,
        departmentId: departmentIds[demo.departmentCode],
        status: EmployeeStatus.ACTIVE,
        shiftStart: '08:00:00',
        lateGraceMinutes: 10,
        deletedAt: null,
        userId: demo.userId ?? null,
      },
      create: {
        companyId: company.id,
        employeeCode: demo.employeeCode,
        firstName: demo.firstName,
        lastName: demo.lastName,
        departmentId: departmentIds[demo.departmentCode],
        status: EmployeeStatus.ACTIVE,
        shiftStart: '08:00:00',
        lateGraceMinutes: 10,
        userId: demo.userId ?? null,
      },
    });

    const activeQr = await prisma.employeeIdentifier.findFirst({
      where: { employeeId: employee.id, type: IdentifierType.QR, isActive: true },
    });
    if (!activeQr) {
      const qrPayload = createQrPayload();
      await prisma.employeeIdentifier.create({
        data: {
          employeeId: employee.id,
          type: IdentifierType.QR,
          value: qrPayload,
          valueHash: hashIdentifier(qrPayload),
          displayHint: displayHint(qrPayload),
          isActive: true,
        },
      });
    }

    const activeRfid = await prisma.employeeIdentifier.findFirst({
      where: { employeeId: employee.id, type: IdentifierType.RFID, isActive: true },
    });
    if (!activeRfid && demo.rfidTag) {
      await prisma.employeeIdentifier.create({
        data: {
          employeeId: employee.id,
          type: IdentifierType.RFID,
          value: demo.rfidTag,
          valueHash: hashIdentifier(demo.rfidTag),
          displayHint: displayHint(demo.rfidTag),
          isActive: true,
        },
      });
    }
  }

  const employees = await prisma.employee.findMany({
    where: {
      companyId: company.id,
      employeeCode: { in: demoEmployees.map((e) => e.employeeCode) },
      deletedAt: null,
    },
  });
  const employeeByCode = new Map(employees.map((e) => [e.employeeCode, e]));

  let policy = await prisma.ppePolicy.findFirst({
    where: { companyId: company.id, isDefault: true },
  });
  if (!policy) {
    policy = await prisma.ppePolicy.create({
      data: {
        companyId: company.id,
        name: 'Default Site PPE',
        isDefault: true,
        version: 1,
      },
    });
  } else {
    await prisma.ppePolicy.update({
      where: { id: policy.id },
      data: { name: 'Default Site PPE', version: 1 },
    });
  }

  await prisma.ppePolicyItem.deleteMany({ where: { policyId: policy.id } });
  const policyItems = [
    { ppeClass: PpeClass.HELMET, minConfidence: 0.7 },
    { ppeClass: PpeClass.SAFETY_VEST, minConfidence: 0.7 },
    // AI maps Person→uniform for best.pt (no dedicated workwear class).
    { ppeClass: PpeClass.UNIFORM, minConfidence: 0.65 },
  ];
  await prisma.ppePolicyItem.createMany({
    data: policyItems.map((item) => ({
      policyId: policy!.id,
      ppeClass: item.ppeClass,
      required: true,
      minConfidence: item.minConfidence,
    })),
  });

  await prisma.attendanceRecord.deleteMany({ where: { companyId: company.id } });
  await prisma.accessAttempt.deleteMany({ where: { companyId: company.id } });

  const day = new Date();
  const y = day.getUTCFullYear();
  const m = day.getUTCMonth();
  const d = day.getUTCDate();
  const at = (hours: number, minutes: number) => new Date(Date.UTC(y, m, d, hours, minutes, 0, 0));

  const demoPunches: Array<{
    employeeCode: string;
    punchType: string;
    punchedAt: Date;
  }> = [
    { employeeCode: 'EMP-1001', punchType: PunchType.ENTRY, punchedAt: at(8, 5) },
    { employeeCode: 'EMP-1002', punchType: PunchType.ENTRY, punchedAt: at(8, 25) },
    { employeeCode: 'EMP-1002', punchType: PunchType.EXIT, punchedAt: at(12, 0) },
    { employeeCode: 'EMP-1002', punchType: PunchType.ENTRY, punchedAt: at(13, 5) },
    { employeeCode: 'EMP-1003', punchType: PunchType.ENTRY, punchedAt: at(7, 55) },
    { employeeCode: 'EMP-1003', punchType: PunchType.EXIT, punchedAt: at(17, 10) },
  ];

  let attendanceCount = 0;
  for (const punch of demoPunches) {
    const employee = employeeByCode.get(punch.employeeCode);
    if (!employee) continue;
    await prisma.attendanceRecord.create({
      data: {
        companyId: company.id,
        employeeId: employee.id,
        punchType: punch.punchType,
        punchedAt: punch.punchedAt,
        isLate: computeIsLate(
          punch.punchType,
          punch.punchedAt,
          employee.shiftStart,
          employee.lateGraceMinutes,
        ),
        source: AttendanceSource.MANUAL,
      },
    });
    attendanceCount += 1;
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.systemSetting.upsert({
      where: { companyId_key: { companyId: company.id, key } },
      create: { companyId: company.id, key, value },
      update: { value },
    });
  }

  const guardUser = await prisma.user.findFirst({
    where: { companyId: company.id, email: 'guard@granisafe.local' },
  });
  if (guardUser) {
    await prisma.notification.deleteMany({ where: { userId: guardUser.id } });
    await prisma.notification.createMany({
      data: [
        {
          companyId: company.id,
          userId: guardUser.id,
          type: 'SYSTEM',
          title: 'Welcome to notifications',
          body: 'Denied access and subsystem alerts appear here.',
          isRead: false,
        },
        {
          companyId: company.id,
          userId: guardUser.id,
          type: 'ACCESS_DENIED',
          title: 'Sample denial',
          body: 'Demo seed: EMP-1002 was denied (missing helmet).',
          payload: { employeeCode: 'EMP-1002', sample: true },
          isRead: false,
        },
      ],
    });
  }

  await prisma.auditLog.create({
    data: {
      companyId: company.id,
      action: 'SEED_COMPLETED',
      entityType: 'system',
      metadata: {
        users: DEMO_USERS.map((u) => u.email),
        departments: departments.map((d) => d.code),
        employees: demoEmployees.map((e) => e.employeeCode),
        attendanceRecords: attendanceCount,
        ppePolicy: policy.name,
      },
    },
  });

  console.log('Seed complete.');
  console.log(`Company: ${company.name}`);
  console.log('Demo users (password from SEED_PASSWORD or Password123!):');
  for (const u of DEMO_USERS) {
    console.log(`  - ${u.email} [${u.role}]`);
  }
  console.log('Departments:', departments.map((d) => d.code).join(', '));
  console.log('Employees:', demoEmployees.map((e) => e.employeeCode).join(', '));
  console.log(`Attendance punches: ${attendanceCount}`);
  console.log(`PPE policy: ${policy.name} (${policyItems.map((i) => i.ppeClass).join(', ')})`);
  console.log('System settings + sample notifications seeded.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
