import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'granisafe-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        service: 'granisafe-api',
        database: 'up',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        code: 'DB_UNAVAILABLE',
        title: 'Service Unavailable',
        detail: 'Database is not ready',
      });
    }
  }
}
