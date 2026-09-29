import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  MemberStatus,
  Platform,
  Role,
  SessionStatus,
} from '../generated/prisma/enums.js';
import { PremiumService } from '../premium/premium.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEFAULT_DURATION_H } from '../sessions/session-scheduler.service.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { UpsertUserGameDto } from './dto/upsert-user-game.dto.js';
import type { UserSearchDto } from './dto/user-search.dto.js';
import {
  privateUserSelect,
  publicUserSelect,
  userGameSelect,
  withPremiumFlag,
} from './user.select.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly premium: PremiumService,
  ) {}

  async search(query: UserSearchDto, viewer: AuthUser) {
    const where: Prisma.UserWhereInput = {
      isBanned: false,
      id: { not: viewer.id },
      username: query.search
        ? { contains: query.search, mode: 'insensitive' }
        : undefined,
      skillLevel: query.skillLevel,
      availability: query.availability,
      communicationPreference: query.communicationPreference,
      languages: query.language ? { has: query.language } : undefined,
      games:
        query.gameId || query.platform
          ? { some: { gameId: query.gameId, platform: query.platform } }
          : undefined,
    };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: publicUserSelect,
        orderBy: [
          { subscription: { plan: 'desc' } },
          { availability: 'asc' },
          { username: 'asc' },
        ],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: rows.map(withPremiumFlag), total, page: query.page, limit: query.limit };
  }

  async getProfile(id: string, viewer: AuthUser) {
    const canSeePrivate = viewer.id === id || viewer.role === Role.ADMIN;
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...(canSeePrivate ? privateUserSelect : publicUserSelect),
        games: { select: userGameSelect, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const [rating, tagRows, sessionsPlayed] = await Promise.all([
      this.prisma.review.aggregate({
        where: { targetId: id },
        _avg: { stars: true },
        _count: true,
      }),
      this.prisma.$queryRaw<{ tag: string; count: bigint }[]>`
        SELECT tag::text AS tag, COUNT(*) AS count
        FROM reviews, unnest(tags) AS tag
        WHERE "targetId" = ${id}
        GROUP BY tag ORDER BY count DESC`,
      this.prisma.sessionMember.count({
        where: { userId: id, status: MemberStatus.ACCEPTED, session: { status: SessionStatus.FINISHED } },
      }),
    ]);

    return {
      ...withPremiumFlag(user),
      reputation: {
        averageStars: rating._avg.stars,
        reviewCount: rating._count,
        tags: Object.fromEntries(tagRows.map((r) => [r.tag, Number(r.count)])),
      },
      stats: { sessionsPlayed },
    };
  }

  async updateProfile(id: string, dto: UpdateProfileDto, actor: AuthUser) {
    this.assertCanEdit(id, actor);

    if (dto.username) {
      const taken = await this.prisma.user.findFirst({
        where: {
          username: { equals: dto.username, mode: 'insensitive' },
          NOT: { id },
        },
        select: { id: true },
      });
      if (taken) throw new ConflictException('Ese nombre de usuario ya existe');
    }

    const exists = await this.prisma.user.count({ where: { id } });
    if (!exists) throw new NotFoundException('Usuario no encontrado');

    if ((dto.bannerUrl !== undefined || dto.accentColor !== undefined) && actor.role !== Role.ADMIN) {
      await this.premium.assertPremium(id, 'La personalización del perfil');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: privateUserSelect,
    });
    return withPremiumFlag(user);
  }

  async advancedStats(userId: string) {
    await this.premium.assertPremium(userId, 'Las estadísticas avanzadas');

    const finished = await this.prisma.gameSession.findMany({
      where: {
        status: SessionStatus.FINISHED,
        members: { some: { userId, status: MemberStatus.ACCEPTED } },
      },
      select: {
        startsAt: true,
        endsAt: true,
        game: { select: { id: true, name: true } },
        members: {
          where: { status: MemberStatus.ACCEPTED, userId: { not: userId } },
          select: { user: { select: { id: true, username: true, avatarUrl: true } } },
        },
      },
    });

    const byGame = new Map<string, { game: { id: string; name: string }; sessions: number; hours: number }>();
    const mates = new Map<string, { user: { id: string; username: string; avatarUrl: string | null }; sessions: number }>();
    let totalHours = 0;
    for (const s of finished) {
      const end = s.endsAt ?? new Date(s.startsAt.getTime() + DEFAULT_DURATION_H * 3600_000);
      const hours = (end.getTime() - s.startsAt.getTime()) / 3600_000;
      totalHours += hours;
      const g = byGame.get(s.game.id) ?? { game: s.game, sessions: 0, hours: 0 };
      g.sessions++;
      g.hours += hours;
      byGame.set(s.game.id, g);
      for (const { user } of s.members) {
        const m = mates.get(user.id) ?? { user, sessions: 0 };
        m.sessions++;
        mates.set(user.id, m);
      }
    }

    const [created, reviewsGiven] = await Promise.all([
      this.prisma.gameSession.count({ where: { creatorId: userId } }),
      this.prisma.review.count({ where: { authorId: userId } }),
    ]);

    const round = (n: number) => Math.round(n * 10) / 10;
    return {
      sessionsPlayed: finished.length,
      sessionsCreated: created,
      reviewsGiven,
      totalHours: round(totalHours),
      byGame: [...byGame.values()]
        .map((g) => ({ ...g, hours: round(g.hours) }))
        .sort((a, b) => b.sessions - a.sessions),
      topTeammates: [...mates.values()].sort((a, b) => b.sessions - a.sessions).slice(0, 5),
    };
  }

  async upsertGame(userId: string, dto: UpsertUserGameDto) {
    const game = await this.prisma.game.findUnique({
      where: { id: dto.gameId },
      select: { name: true, platforms: true },
    });
    if (!game) throw new NotFoundException('Juego no encontrado');
    if (!game.platforms.includes(dto.platform)) {
      throw new BadRequestException(
        `${game.name} no está disponible en ${dto.platform}`,
      );
    }

    const { gameId, platform, ...fields } = dto;
    return this.prisma.userGame.upsert({
      where: { userId_gameId_platform: { userId, gameId, platform } },
      update: fields,
      create: { userId, gameId, platform, ...fields },
      select: userGameSelect,
    });
  }

  async removeGame(userId: string, gameId: string, platform: Platform) {
    const { count } = await this.prisma.userGame.deleteMany({
      where: { userId, gameId, platform },
    });
    if (!count) throw new NotFoundException('Ese juego no está en tu perfil');
  }

  private assertCanEdit(targetId: string, actor: AuthUser) {
    if (actor.id !== targetId && actor.role !== Role.ADMIN) {
      throw new ForbiddenException('Solo puedes editar tu propio perfil');
    }
  }
}
