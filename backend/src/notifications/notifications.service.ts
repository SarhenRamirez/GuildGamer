import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Prisma } from '../generated/prisma/client.js';
import type { NotificationType } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsGateway } from './notifications.gateway.js';

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body?: string;
  data?: Prisma.InputJsonObject;
}

const notificationSelect = {
  id: true,
  type: true,
  title: true,
  body: true,
  data: true,
  readAt: true,
  createdAt: true,
} as const;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async notify(userIds: string[], input: NotificationInput) {
    const recipients = [...new Set(userIds)];
    if (!recipients.length) return;
    try {
      const created = await this.prisma.notification.createManyAndReturn({
        data: recipients.map((userId) => ({ userId, ...input })),
        select: { ...notificationSelect, userId: true },
      });
      for (const { userId, ...notification } of created) {
        this.gateway.push(userId, notification);
      }
    } catch (e) {
      this.logger.error(`No se pudo notificar ${input.type}`, e as Error);
    }
  }

  list(userId: string, opts: { unread?: boolean; before?: Date; limit: number }) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        readAt: opts.unread ? null : undefined,
        createdAt: opts.before ? { lt: opts.before } : undefined,
      },
      select: notificationSelect,
      orderBy: { createdAt: 'desc' },
      take: opts.limit,
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  async markRead(id: string, userId: string) {
    const exists = await this.prisma.notification.count({ where: { id, userId } });
    if (!exists) throw new NotFoundException('Notificación no encontrada');
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanup() {
    const deleted = await this.deleteReadOlderThan(30);
    if (deleted) this.logger.log(`Borradas ${deleted} notificaciones leídas antiguas`);
  }

  async deleteReadOlderThan(days: number) {
    const { count } = await this.prisma.notification.deleteMany({
      where: {
        readAt: { not: null },
        createdAt: { lt: new Date(Date.now() - days * 24 * 3600_000) },
      },
    });
    return count;
  }
}
