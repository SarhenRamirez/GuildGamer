import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { ChatGateway } from '../chat/chat.gateway.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  ReportStatus,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../generated/prisma/enums.js';
import { NotificationsGateway } from '../notifications/notifications.gateway.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { VoiceGateway } from '../voice/voice.gateway.js';
import { withPremiumFlag } from '../users/user.select.js';
import { subscriptionSelect } from '../premium/premium.service.js';
import type {
  AdminSessionQueryDto,
  AdminUpdateUserDto,
  AdminUserQueryDto,
} from './admin.dto.js';

const DAY = 24 * 3600_000;

const adminUserSelect = {
  id: true,
  email: true,
  username: true,
  avatarUrl: true,
  role: true,
  isBanned: true,
  authProvider: true,
  createdAt: true,
  subscription: { select: subscriptionSelect },
  _count: {
    select: {
      createdSessions: true,
      reportsAgainst: { where: { status: { in: [ReportStatus.OPEN, ReportStatus.REVIEWING] } } },
    },
  },
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatGateway,
    private readonly notifications: NotificationsGateway,
    private readonly voice: VoiceGateway,
  ) {}

  async stats() {
    const now = Date.now();
    const weekAgo = new Date(now - 7 * DAY);
    const dayAgo = new Date(now - DAY);

    const [
      users,
      newUsers,
      banned,
      premium,
      sessionsByStatus,
      newSessions,
      messages24h,
      posts,
      openReports,
      topGames,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.user.count({ where: { isBanned: true } }),
      this.prisma.subscription.count({
        where: {
          plan: SubscriptionPlan.PREMIUM,
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELLED] },
          OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: new Date() } }],
        },
      }),
      this.prisma.gameSession.groupBy({ by: ['status'], _count: true }),
      this.prisma.gameSession.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.message.count({ where: { createdAt: { gte: dayAgo } } }),
      this.prisma.post.count(),
      this.prisma.report.count({
        where: { status: { in: [ReportStatus.OPEN, ReportStatus.REVIEWING] } },
      }),
      this.prisma.gameSession.groupBy({
        by: ['gameId'],
        _count: true,
        orderBy: { _count: { gameId: 'desc' } },
        take: 5,
      }),
    ]);

    const games = await this.prisma.game.findMany({
      where: { id: { in: topGames.map((g) => g.gameId) } },
      select: { id: true, name: true },
    });
    const gameName = new Map(games.map((g) => [g.id, g.name]));

    return {
      users: { total: users, newLast7Days: newUsers, banned, premium },
      sessions: {
        byStatus: Object.fromEntries(sessionsByStatus.map((s) => [s.status, s._count])),
        newLast7Days: newSessions,
      },
      messagesLast24h: messages24h,
      posts,
      openReports,
      topGames: topGames.map((g) => ({
        gameId: g.gameId,
        name: gameName.get(g.gameId),
        sessions: g._count,
      })),
    };
  }

  async listUsers(query: AdminUserQueryDto) {
    const where: Prisma.UserWhereInput = {
      role: query.role,
      isBanned: query.banned,
      OR: query.search
        ? [
            { username: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: adminUserSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: rows.map(({ _count, ...u }) => ({
        ...withPremiumFlag(u),
        sessionsCreated: _count.createdSessions,
        openReports: _count.reportsAgainst,
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async updateUser(id: string, dto: AdminUpdateUserDto, actor: AuthUser) {
    if (id === actor.id) {
      throw new BadRequestException('No puedes modificar tu propia cuenta desde el panel');
    }
    const exists = await this.prisma.user.count({ where: { id } });
    if (!exists) throw new NotFoundException('Usuario no encontrado');

    const { _count, ...user } = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: adminUserSelect,
    });
    if (dto.isBanned) {
      this.chat.disconnectUser(id);
      this.notifications.disconnectUser(id);
      this.voice.disconnectUser(id);
    }
    return {
      ...withPremiumFlag(user),
      sessionsCreated: _count.createdSessions,
      openReports: _count.reportsAgainst,
    };
  }

  async listSessions(query: AdminSessionQueryDto) {
    const where: Prisma.GameSessionWhereInput = {
      status: query.status,
      title: query.search ? { contains: query.search, mode: 'insensitive' } : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.gameSession.findMany({
        where,
        select: {
          id: true,
          title: true,
          status: true,
          kind: true,
          platform: true,
          startsAt: true,
          createdAt: true,
          game: { select: { id: true, name: true } },
          creator: { select: { id: true, username: true } },
          _count: { select: { members: true, messages: true, reports: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.gameSession.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }
}
