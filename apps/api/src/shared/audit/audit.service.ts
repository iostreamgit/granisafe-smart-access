import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type WriteAuditInput = {
  companyId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async write(input: WriteAuditInput) {
    return this.prisma.auditLog.create({
      data: {
        companyId: input.companyId ?? null,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata ?? undefined,
        ipAddress: input.ipAddress ?? null,
      },
    });
  }
}
