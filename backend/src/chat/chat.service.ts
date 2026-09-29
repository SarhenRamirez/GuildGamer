import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { FriendsService } from '../friends/friends.service.js';
import {
  MemberStatus,
  NotificationType,
  Role,
  SessionStatus,
} from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const MAX_MESSAGE_LENGTH = 2000;

const sender = { select: { id: true, username: true, avatarUrl: true } } as const;

const messageSelect = {
  id: true,
  content: true,
  sessionId: true,
  createdAt: true,
  sender,
} as const;

const directSelect = {
  id: true,
  content: true,
  recipientId: true,
  readAt: true,
  createdAt: true,
  sender,
} as const;

export interface ChatRealtime {
  emitToUser(userId: string, event: string, payload: unknown): void;
  isOnline(userId: string): Promise<boolean>;
}

@Injectable()
export class ChatService {
  private realtime?: ChatRealtime;

  constructor(
    private readonly prisma: PrismaService,
    private readonly friends: FriendsService,
    private readonly notifications: NotificationsService,
  ) {}

  bindRealtime(realtime: ChatRealtime) {
    this.realtime = realtime;
  }

  async assertCanRead(sessionId: string, user: AuthUser) {
    await this.getSessionForUser(sessionId, user, user.role === Role.ADMIN);
  }

  async assertCanWrite(sessionId: string, user: AuthUser) {
    const session = await this.getSessionForUser(sessionId, user, false);
    if (session.status === SessionStatus.CANCELLED) {
      throw new ForbiddenException('La sesión está cancelada');
    }
  }

  async history(sessionId: string, user: AuthUser, before: Date | undefined, limit: number) {
    await this.assertCanRead(sessionId, user);
    const messages = await this.prisma.message.findMany({
      where: { sessionId, createdAt: before ? { lt: before } : undefined },
      select: messageSelect,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return messages.reverse();
  }

  async createMessage(sessionId: string, user: AuthUser, content: string) {
    await this.assertCanWrite(sessionId, user);
    return this.prisma.message.create({
      data: { sessionId, senderId: user.id, content },
      select: messageSelect,
    });
  }

  async sendDirect(from: AuthUser, toUserId: string, content: string) {
    if (!(await this.friends.areFriends(from.id, toUserId))) {
      throw new ForbiddenException('Solo puedes escribir a tus amigos');
    }
    const message = await this.prisma.message.create({
      data: { senderId: from.id, recipientId: toUserId, content },
      select: directSelect,
    });

    const payload = { ...message, partnerId: toUserId };
    this.realtime?.emitToUser(toUserId, 'dm:new', { ...payload, partnerId: from.id });
    this.realtime?.emitToUser(from.id, 'dm:new', payload);

    if (this.realtime && !(await this.realtime.isOnline(toUserId))) {
      await this.notifications.notify([toUserId], {
        type: NotificationType.NEW_MESSAGE,
        title: `Nuevo mensaje de ${message.sender.username}`,
        body: content.length > 80 ? `${content.slice(0, 77)}…` : content,
        data: { userId: from.id },
      });
    }
    return message;
  }

  async directHistory(user: AuthUser, partnerId: string, before: Date | undefined, limit: number) {
    const messages = await this.prisma.message.findMany({
      where: {
        sessionId: null,
        OR: [
          { senderId: user.id, recipientId: partnerId },
          { senderId: partnerId, recipientId: user.id },
        ],
        createdAt: before ? { lt: before } : undefined,
      },
      select: directSelect,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return messages.reverse();
  }

  async markDirectRead(user: AuthUser, partnerId: string) {
    const { count } = await this.prisma.message.updateMany({
      where: { senderId: partnerId, recipientId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }

  async conversations(user: AuthUser) {
    const recent = await this.prisma.message.findMany({
      where: {
        sessionId: null,
        OR: [{ senderId: user.id }, { recipientId: user.id }],
      },
      select: {
        ...directSelect,
        recipient: sender,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const unread = await this.prisma.message.groupBy({
      by: ['senderId'],
      where: { recipientId: user.id, readAt: null },
      _count: true,
    });
    const unreadBy = new Map(unread.map((u) => [u.senderId, u._count]));

    const seen = new Map<string, unknown>();
    for (const m of recent) {
      const partner = m.sender.id === user.id ? m.recipient! : m.sender;
      if (seen.has(partner.id)) continue;
      const { recipient: _r, ...last } = m;
      seen.set(partner.id, {
        partner,
        lastMessage: last,
        unread: unreadBy.get(partner.id) ?? 0,
      });
    }
    return [...seen.values()];
  }

  private async getSessionForUser(sessionId: string, user: AuthUser, bypassMembership: boolean) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: {
        status: true,
        members: { where: { userId: user.id }, select: { status: true } },
      },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    if (!bypassMembership && session.members[0]?.status !== MemberStatus.ACCEPTED) {
      throw new ForbiddenException('No eres miembro de esta sesión');
    }
    return session;
  }
}
