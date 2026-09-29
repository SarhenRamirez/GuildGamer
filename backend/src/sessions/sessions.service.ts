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
  NotificationType,
  Role,
  SessionKind,
  SessionStatus,
  SkillLevel,
} from '../generated/prisma/enums.js';
import { ChatGateway } from '../chat/chat.gateway.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PremiumService } from '../premium/premium.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { VoiceGateway } from '../voice/voice.gateway.js';
import type {
  CreateSessionDto,
  SessionQueryDto,
  UpdateSessionDto,
} from './dto/session.dto.js';

const MAX_DAYS_AHEAD = 60;
const MAX_CASUAL_PLAYERS = 16;

const userSummary = {
  select: { id: true, username: true, avatarUrl: true },
} as const;

const sessionSummarySelect = {
  id: true,
  title: true,
  description: true,
  platform: true,
  mode: true,
  maxPlayers: true,
  skillLevel: true,
  language: true,
  micRequired: true,
  joinMode: true,
  status: true,
  kind: true,
  startsAt: true,
  endsAt: true,
  createdAt: true,
  game: { select: { id: true, name: true, slug: true, coverUrl: true } },
  creator: userSummary,
  _count: {
    select: { members: { where: { status: MemberStatus.ACCEPTED } } },
  },
} satisfies Prisma.GameSessionSelect;

type SessionSummaryRow = Prisma.GameSessionGetPayload<{
  select: typeof sessionSummarySelect;
}>;

const EDITABLE: SessionStatus[] = [SessionStatus.OPEN, SessionStatus.FULL];

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatGateway,
    private readonly notifications: NotificationsService,
    private readonly premium: PremiumService,
    private readonly voice: VoiceGateway,
  ) {}

  async create(dto: CreateSessionDto, creator: AuthUser) {
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
    this.assertValidSchedule(dto.startsAt, dto.endsAt);
    await this.assertKindLimits(creator.id, dto.kind ?? SessionKind.CASUAL, dto.maxPlayers);

    const session = await this.prisma.gameSession.create({
      data: {
        ...dto,
        creatorId: creator.id,
        members: {
          create: { userId: creator.id, status: MemberStatus.ACCEPTED },
        },
      },
      select: { id: true },
    });
    return this.findOne(session.id, creator);
  }

  async findAll(query: SessionQueryDto) {
    const where: Prisma.GameSessionWhereInput = {
      gameId: query.gameId,
      platform: query.platform,
      skillLevel: query.skillLevel,
      language: query.language,
      micRequired: query.micRequired,
      kind: query.kind,
      status: query.status ?? SessionStatus.OPEN,
      startsAt: { gte: query.from ?? new Date(), lte: query.to },
      title: query.search
        ? { contains: query.search, mode: 'insensitive' }
        : undefined,
    };

    const [rows, total] = await Promise.all([
      this.prisma.gameSession.findMany({
        where,
        select: sessionSummarySelect,
        orderBy: { startsAt: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.gameSession.count({ where }),
    ]);

    return {
      items: rows.map(toSummary),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOne(id: string, viewer: AuthUser) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id },
      select: {
        ...sessionSummarySelect,
        joinInfo: true,
        members: {
          where: {
            status: { in: [MemberStatus.ACCEPTED, MemberStatus.PENDING, MemberStatus.INVITED] },
          },
          select: {
            status: true,
            joinedAt: true,
            user: { select: { id: true, username: true, avatarUrl: true, availability: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');

    const { joinInfo, members: rawMembers, ...summary } = session;
    const profiles = await this.prisma.userGame.findMany({
      where: {
        gameId: session.game.id,
        platform: session.platform,
        userId: { in: rawMembers.map((m) => m.user.id) },
      },
      select: { userId: true, rank: true, role: true, skillLevel: true, gamerTag: true },
    });
    const members = rawMembers.map((m) => {
      const p = profiles.find((x) => x.userId === m.user.id);
      return {
        ...m,
        gameProfile: p ? { rank: p.rank, role: p.role, skillLevel: p.skillLevel, gamerTag: p.gamerTag } : null,
      };
    });
    const isCreator = session.creator.id === viewer.id;
    const mine = await this.prisma.sessionMember.findUnique({
      where: { sessionId_userId: { sessionId: id, userId: viewer.id } },
      select: { status: true },
    });
    const myStatus = mine?.status ?? null;
    const canSeePrivate =
      myStatus === MemberStatus.ACCEPTED || viewer.role === Role.ADMIN;

    return {
      ...toSummary(summary),
      members: members.filter((m) => m.status === MemberStatus.ACCEPTED),
      pendingRequests: isCreator
        ? members.filter((m) => m.status === MemberStatus.PENDING)
        : undefined,
      invited: isCreator
        ? members.filter((m) => m.status === MemberStatus.INVITED)
        : undefined,
      joinInfo: canSeePrivate ? joinInfo : undefined,
      myStatus,
      isCreator,
    };
  }

  async update(id: string, dto: UpdateSessionDto, actor: AuthUser) {
    const current = await this.getEditable(id, actor);
    this.assertValidSchedule(
      dto.startsAt ?? current.startsAt,
      dto.endsAt ?? current.endsAt ?? undefined,
      dto.startsAt === undefined,
    );

    let status: SessionStatus | undefined;
    if (dto.maxPlayers !== undefined) {
      await this.assertKindLimits(current.creatorId, current.kind, dto.maxPlayers);
      const accepted = current._count.members;
      if (dto.maxPlayers < accepted) {
        throw new BadRequestException(
          `Ya hay ${accepted} jugadores en la sesión; maxPlayers no puede ser menor`,
        );
      }
      status =
        accepted >= dto.maxPlayers ? SessionStatus.FULL : SessionStatus.OPEN;
    }

    const rescheduled =
      dto.startsAt !== undefined &&
      dto.startsAt.getTime() !== current.startsAt.getTime();

    await this.prisma.gameSession.update({
      where: { id },
      data: {
        ...dto,
        status,
        reminderSentAt: rescheduled ? null : undefined,
      },
    });

    const session = await this.findOne(id, actor);
    if (rescheduled) {
      await this.notifications.notify(
        await this.memberIds(id, [MemberStatus.ACCEPTED, MemberStatus.PENDING], actor.id),
        {
          type: NotificationType.SESSION_UPDATED,
          title: `Cambio de horario en "${session.title}" (${session.game.name})`,
          body: 'El creador ha cambiado la hora de inicio.',
          data: { sessionId: id, startsAt: session.startsAt.toISOString() },
        },
      );
    }
    return session;
  }

  async cancel(id: string, actor: AuthUser) {
    await this.getEditable(id, actor);
    await this.prisma.gameSession.update({
      where: { id },
      data: { status: SessionStatus.CANCELLED },
    });
    this.chat.emitToSession(id, 'session:cancelled', { sessionId: id });
    await this.voice.closeSession(id);

    const session = await this.findOne(id, actor);
    await this.notifications.notify(
      await this.memberIds(id, [MemberStatus.ACCEPTED, MemberStatus.PENDING], actor.id),
      {
        type: NotificationType.SESSION_CANCELLED,
        title: `Se canceló "${session.title}" (${session.game.name})`,
        data: { sessionId: id },
      },
    );
    return session;
  }

  async mine(user: AuthUser) {
    const rows = await this.prisma.gameSession.findMany({
      where: {
        status: { in: [SessionStatus.OPEN, SessionStatus.FULL, SessionStatus.IN_PROGRESS] },
        members: {
          some: {
            userId: user.id,
            status: { in: [MemberStatus.ACCEPTED, MemberStatus.PENDING, MemberStatus.INVITED] },
          },
        },
      },
      select: {
        ...sessionSummarySelect,
        members: { where: { userId: user.id }, select: { status: true } },
      },
      orderBy: { startsAt: 'asc' },
      take: 50,
    });
    return rows.map(({ members, ...s }) => ({ ...toSummary(s), myStatus: members[0]?.status ?? null }));
  }

  async recommended(user: AuthUser, limit = 10) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        skillLevel: true,
        languages: true,
        games: { select: { gameId: true, platform: true, skillLevel: true } },
      },
    });
    if (!me.games.length) return [];

    const candidates = await this.prisma.gameSession.findMany({
      where: {
        status: SessionStatus.OPEN,
        startsAt: { gte: new Date() },
        creatorId: { not: user.id },
        members: { none: { userId: user.id } },
        OR: me.games.map((g) => ({ gameId: g.gameId, platform: g.platform })),
      },
      select: sessionSummarySelect,
      orderBy: { startsAt: 'asc' },
      take: 100,
    });

    const LEVELS = Object.values(SkillLevel);
    const now = Date.now();
    const score = (s: SessionSummaryRow) => {
      const mine = me.games.find((g) => g.gameId === s.game.id && g.platform === s.platform);
      const myLevel = mine?.skillLevel ?? me.skillLevel;
      const levelGap = Math.abs(LEVELS.indexOf(myLevel) - LEVELS.indexOf(s.skillLevel));
      const hoursAway = (s.startsAt.getTime() - now) / 3600_000;
      return (
        (3 - Math.min(levelGap, 3)) * 2 +
        (s.language && me.languages.includes(s.language) ? 3 : 0) +
        (hoursAway < 3 ? 2 : hoursAway < 24 ? 1 : 0)
      );
    };
    return candidates
      .map((s) => ({ session: s, score: score(s) }))
      .sort((a, b) => b.score - a.score || a.session.startsAt.getTime() - b.session.startsAt.getTime())
      .slice(0, limit)
      .map(({ session, score }) => ({ ...toSummary(session), matchScore: score }));
  }

  private async assertKindLimits(userId: string, kind: SessionKind, maxPlayers: number) {
    if (kind === SessionKind.TOURNAMENT) {
      await this.premium.assertPremium(userId, 'Crear torneos o eventos');
    } else if (maxPlayers > MAX_CASUAL_PLAYERS) {
      throw new BadRequestException(
        `Una sesión normal admite hasta ${MAX_CASUAL_PLAYERS} jugadores; para más, crea un torneo (Premium)`,
      );
    }
  }

  private async memberIds(sessionId: string, statuses: MemberStatus[], exceptUserId: string) {
    const rows = await this.prisma.sessionMember.findMany({
      where: { sessionId, status: { in: statuses }, userId: { not: exceptUserId } },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  private async getEditable(id: string, actor: AuthUser) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id },
      select: {
        creatorId: true,
        kind: true,
        status: true,
        startsAt: true,
        endsAt: true,
        _count: sessionSummarySelect._count,
      },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    if (session.creatorId !== actor.id && actor.role !== Role.ADMIN) {
      throw new ForbiddenException('Solo el creador puede modificar la sesión');
    }
    if (!EDITABLE.includes(session.status)) {
      throw new ConflictException(
        `La sesión está ${session.status} y ya no se puede modificar`,
      );
    }
    return session;
  }

  private assertValidSchedule(
    startsAt: Date,
    endsAt?: Date,
    skipFutureCheck = false,
  ) {
    const now = Date.now();
    if (!skipFutureCheck && startsAt.getTime() <= now) {
      throw new BadRequestException('La sesión debe empezar en el futuro');
    }
    if (startsAt.getTime() > now + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
      throw new BadRequestException(
        `Solo se pueden programar sesiones hasta ${MAX_DAYS_AHEAD} días vista`,
      );
    }
    if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('endsAt debe ser posterior a startsAt');
    }
  }
}

function toSummary({ _count, ...session }: SessionSummaryRow) {
  return {
    ...session,
    playersCount: _count.members,
    spotsLeft: Math.max(session.maxPlayers - _count.members, 0),
  };
}
