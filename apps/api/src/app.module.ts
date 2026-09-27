import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import path from 'node:path';
import { AuthModule } from './modules/auth/auth.module';
import { AuditHttpModule } from './modules/audit/audit-http.module';
import { AccessControlModule } from './modules/access-control/access-control.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { HealthModule } from './modules/health/health.module';
import { HelloModule } from './modules/hello/hello.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SettingsModule } from './modules/settings/settings.module';
import { UsersModule } from './modules/users/users.module';
import { AuditModule } from './shared/audit/audit.module';
import { PrismaModule } from './shared/prisma/prisma.module';

const monorepoRootEnv = path.resolve(__dirname, '../../../.env');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Prefer monorepo root .env (Nest: first file wins).
      envFilePath: [monorepoRootEnv, path.resolve(process.cwd(), '../../.env'), '.env'],
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuditModule,
    HealthModule,
    HelloModule,
    AuthModule,
    UsersModule,
    AuditHttpModule,
    OrganizationModule,
    EmployeesModule,
    AttendanceModule,
    AccessControlModule,
    DashboardModule,
    SettingsModule,
    NotificationsModule,
    ReportsModule,
  ],
})
export class AppModule {}
