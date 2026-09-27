import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import {
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { PermissionCode, ROLE_PERMISSIONS } from '@granisafe/shared';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  ACCESS_EVENT_CREATED,
  SYSTEM_AI_STATUS,
  SYSTEM_CAMERA_STATUS,
  type AccessEventCreatedPayload,
  type CameraStatusPayload,
} from './realtime.events';

type SocketUser = {
  id: string;
  companyId: string;
  permissions: string[];
};

@WebSocketGateway({
  namespace: '/ws',
  cors: { origin: true, credentials: true },
})
export class DashboardGateway implements OnGatewayConnection {
  private readonly logger = new Logger(DashboardGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }

      const secret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, { secret });
      const user = await this.prisma.user.findFirst({
        where: { id: payload.sub, deletedAt: null, isActive: true },
        include: { roles: { include: { role: true } } },
      });
      if (!user) {
        client.disconnect(true);
        return;
      }

      const roles = user.roles.map((ur) => ur.role.code);
      const permissions = Array.from(
        new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role] ?? [])),
      );

      if (!permissions.includes(PermissionCode.DASHBOARD_LIVE)) {
        client.emit('error', { code: 'FORBIDDEN', detail: 'dashboard.live required' });
        client.disconnect(true);
        return;
      }

      const socketUser: SocketUser = {
        id: user.id,
        companyId: user.companyId,
        permissions,
      };
      client.data.user = socketUser;
      await client.join(this.companyRoom(user.companyId));
      client.emit('connected', { companyId: user.companyId });
    } catch (error) {
      this.logger.debug(`WS auth failed: ${String(error)}`);
      client.disconnect(true);
    }
  }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() body?: unknown) {
    return { event: 'pong', data: body ?? null, at: new Date().toISOString() };
  }

  @OnEvent(ACCESS_EVENT_CREATED)
  onAccessEvent(payload: AccessEventCreatedPayload) {
    this.server.to(this.companyRoom(payload.companyId)).emit(ACCESS_EVENT_CREATED, payload.event);
  }

  @OnEvent(SYSTEM_CAMERA_STATUS)
  onCameraStatus(payload: CameraStatusPayload) {
    this.server.to(this.companyRoom(payload.companyId)).emit(SYSTEM_CAMERA_STATUS, {
      accessPointCode: payload.accessPointCode,
      status: payload.status,
      lastHeartbeatAt: payload.lastHeartbeatAt,
    });
  }

  @OnEvent(SYSTEM_AI_STATUS)
  onAiStatus(payload: { companyId?: string; status: string }) {
    if (payload.companyId) {
      this.server.to(this.companyRoom(payload.companyId)).emit(SYSTEM_AI_STATUS, payload);
      return;
    }
    this.server.emit(SYSTEM_AI_STATUS, payload);
  }

  private companyRoom(companyId: string) {
    return `company:${companyId}`;
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: string } | undefined;
    if (auth?.token) return auth.token;
    const queryToken = client.handshake.query.token;
    if (typeof queryToken === 'string' && queryToken) return queryToken;
    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return null;
  }
}
