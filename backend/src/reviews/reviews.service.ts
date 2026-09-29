import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import {
  MemberStatus,
  NotificationType,
  SessionStatus,
} from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateReviewDto } from './reviews.dto.js';

export const REVIEW_WINDOW_DAYS = 14;

const userSummary = { select: { id: true, username: true, avatarUrl: true } } as const;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(sessionId: string, dto: CreateReviewDto, author: AuthUser) {
    if (dto.targetId === author.id) {
      throw new BadRequestException('No puedes valorarte a ti mismo');
    }
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
      select: {
        title: true,
        status: true,
        startsAt: true,
        game: { select: { name: true } },
        members: {
          where: { userId: { in: [author.id, dto.targetId] }, status: MemberStatus.ACCEPTED },
          select: { userId: true },
        },
      },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    if (session.status !== SessionStatus.FINISHED) {
      throw new ConflictException('Solo se puede valorar cuando la sesión ha terminado');
    }
    if (Date.now() - session.startsAt.getTime() > REVIEW_WINDOW_DAYS * 24 * 3600_000) {
      throw new ConflictException(`El plazo para valorar (${REVIEW_WINDOW_DAYS} días) ha terminado`);
    }
    const played = new Set(session.members.map((m) => m.userId));
    if (!played.has(author.id)) throw new ForbiddenException('No jugaste en esta sesión');
    if (!played.has(dto.targetId)) throw new BadRequestException('Ese jugador no jugó en esta sesión');

    const already = await this.prisma.review.count({
      where: { sessionId, authorId: author.id, targetId: dto.targetId },
    });
    if (already) throw new ConflictException('Ya valoraste a este jugador en esta sesión');

    const review = await this.prisma.review.create({
      data: {
        sessionId,
        authorId: author.id,
        targetId: dto.targetId,
        stars: dto.stars,
        tags: [...new Set(dto.tags ?? [])],
        comment: dto.comment,
      },
      select: {
        id: true,
        stars: true,
        tags: true,
        comment: true,
        createdAt: true,
        author: userSummary,
      },
    });
    await this.notifications.notify([dto.targetId], {
      type: NotificationType.REVIEW_RECEIVED,
      title: `${review.author.username} te valoró con ${'★'.repeat(review.stars)}`,
      body: `Sesión "${session.title}" (${session.game.name})`,
      data: { sessionId, reviewId: review.id, userId: author.id },
    });
    return review;
  }

  async forUser(userId: string, page: number, limit: number) {
    const where = { targetId: userId };
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        select: {
          id: true,
          stars: true,
          tags: true,
          comment: true,
          createdAt: true,
          author: userSummary,
          session: { select: { id: true, title: true, game: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async pending(user: AuthUser) {
    const since = new Date(Date.now() - REVIEW_WINDOW_DAYS * 24 * 3600_000);
    const sessions = await this.prisma.gameSession.findMany({
      where: {
        status: SessionStatus.FINISHED,
        startsAt: { gte: since },
        members: { some: { userId: user.id, status: MemberStatus.ACCEPTED } },
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        game: { select: { id: true, name: true, coverUrl: true } },
        members: {
          where: { status: MemberStatus.ACCEPTED, userId: { not: user.id } },
          select: { user: userSummary },
        },
        reviews: { where: { authorId: user.id }, select: { targetId: true } },
      },
      orderBy: { startsAt: 'desc' },
    });
    return sessions
      .map(({ members, reviews, ...s }) => {
        const done = new Set(reviews.map((r) => r.targetId));
        return { session: s, teammates: members.map((m) => m.user).filter((u) => !done.has(u.id)) };
      })
      .filter((p) => p.teammates.length);
  }
}
