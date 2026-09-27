import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DashboardController } from './dashboard.controller';
import { DashboardGateway } from './dashboard.gateway';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardGateway],
  exports: [DashboardService],
})
export class DashboardModule {}
