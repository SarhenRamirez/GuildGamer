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
  ReportStatus,
} from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateReportDto,
  ReportQueryDto,
  ResolveReportDto,
} from './reports.dto.js';

const OPEN_STATES = [ReportStatus.OPEN, ReportStatus.REVIEWING];
const user = { select: { id: true, username: true, avatarUrl: true } } as const;

const reportSelect = {
  id: true,
  reason: true,
  details: true,
  status: true,
  resolutionNote: true,
  resolvedAt: true,
  createdAt: true,
  reporter: user,
  resolvedBy: user,
  targetUser: { select: { id: true, username: true, avatarUrl: true, isBanned: true } },
  targetSession: { select: { id: true, title: true, status: true } },
  targetMessage: { select: { id: true, content: true, sessionId: true, sender: user } },
  targetPost: { select: { id: true, content: true, author: user } },
} satisfies Prisma.ReportSelect;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateReportDto, reporter: AuthUser) {
    const targets = [dto.targetUserId, dto.targetSessionId, dto.targetMessageId, dto.targetPostId]
      .filter(Boolean);
    if (targets.length !== 1) {
      throw new BadRequestException('Indica exactamente un elemento a reportar');
    }
    if (dto.targetUserId === reporter.id) {
      throw new BadRequestException('No puedes reportarte a ti mismo');
    }
    await this.assertTargetVisible(dto, reporter);

    const duplicate = await this.prisma.report.count({
      where: {
        reporterId: reporter.id,
        status: { in: OPEN_STATES },
        targetUserId: dto.targetUserId,
        targetSessionId: dto.targetSessionId,
        targetMessageId: dto.targetMessageId,
        targetPostId: dto.targetPostId,
      },
    });
    if (duplicate) throw new ConflictException('Ya tienes un reporte abierto sobre esto');

    return this.prisma.report.create({
      data: { ...dto, reporterId: reporter.id },
      select: { id: true, reason: true, status: true, createdAt: true },
    });
  }

  mine(reporter: AuthUser) {
    return this.prisma.report.findMany({
      where: { reporterId: reporter.id },
      select: { id: true, reason: true, status: true, resolutionNote: true, createdAt: true, resolvedAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async list(query: ReportQueryDto) {
    const where = { status: query.status };
    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        select: reportSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.report.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async resolve(id: string, dto: ResolveReportDto, admin: AuthUser) {
    const report = await this.prisma.report.findUnique({ where: { id }, select: { reporterId: true } });
    if (!report) throw new NotFoundException('Reporte no encontrado');

    const closed = dto.status === ReportStatus.RESOLVED || dto.status === ReportStatus.DISMISSED;
    const updated = await this.prisma.report.update({
      where: { id },
      data: {
        status: dto.status,
        resolutionNote: dto.resolutionNote,
        resolvedById: closed ? admin.id : null,
        resolvedAt: closed ? new Date() : null,
      },
      select: reportSelect,
    });
    if (closed) {
      await this.notifications.notify([report.reporterId], {
        type: NotificationType.SYSTEM,
        title: 'Hemos revisado tu reporte',
        body:
          dto.status === ReportStatus.RESOLVED
            ? 'Gracias: hemos tomado medidas.'
            : 'Tras revisarlo no hemos encontrado una infracción.',
        data: { reportId: id },
      });
    }
    return updated;
  }

  private async assertTargetVisible(dto: CreateReportDto, reporter: AuthUser) {
    if (dto.targetUserId) {
      const exists = await this.prisma.user.count({ where: { id: dto.targetUserId } });
      if (!exists) throw new NotFoundException('Usuario no encontrado');
    }
    if (dto.targetSessionId) {
      const exists = await this.prisma.gameSession.count({ where: { id: dto.targetSessionId } });
      if (!exists) throw new NotFoundException('Sesión no encontrada');
    }
    if (dto.targetPostId) {
      const exists = await this.prisma.post.count({ where: { id: dto.targetPostId } });
      if (!exists) throw new NotFoundException('Publicación no encontrada');
    }
    if (dto.targetMessageId) {
      const msg = await this.prisma.message.findUnique({
        where: { id: dto.targetMessageId },
        select: { senderId: true, recipientId: true, sessionId: true },
      });
      if (!msg) throw new NotFoundException('Mensaje no encontrado');
      if (msg.senderId === reporter.id) {
        throw new BadRequestException('No puedes reportar tu propio mensaje');
      }
      const canSee = msg.sessionId
        ? await this.prisma.sessionMember.count({
            where: { sessionId: msg.sessionId, userId: reporter.id, status: MemberStatus.ACCEPTED },
          })
        : msg.recipientId === reporter.id;
      if (!canSee) throw new ForbiddenException('No puedes reportar ese mensaje');
    }
  }
}
