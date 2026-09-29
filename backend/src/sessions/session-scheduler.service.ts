import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChatGateway } from '../chat/chat.gateway.js';
import {
  MemberStatus,
  NotificationType,
  SessionStatus,
} from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { VoiceGateway } from '../voice/voice.gateway.js';

export const REMINDER_WINDOW_MIN = 60;
export const DEFAULT_DURATION_H = 3;

const ACTIVE = [SessionStatus.OPEN, SessionStatus.FULL];

@Injectable()
export class SessionSchedulerService {
  private readonly logger = new Logger(SessionSchedulerService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly chat: ChatGateway,
    private readonly voice: VoiceGateway,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.sendReminders();
      await this.updateStatuses();
    } catch (e) {
      this.logger.error('Fallo en la tarea programada de sesiones', e as Error);
    } finally {
      this.running = false;
    }
  }

  async sendReminders(now = new Date()) {
    const due = await this.prisma.gameSession.findMany({
      where: {
        status: { in: ACTIVE },
        reminderSentAt: null,
        startsAt: { gt: now, lte: new Date(now.getTime() + REMINDER_WINDOW_MIN * 60_000) },
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        game: { select: { name: true } },
        members: { where: { status: MemberStatus.ACCEPTED }, select: { userId: true } },
      },
    });

    let sent = 0;
    for (const session of due) {
      const { count } = await this.prisma.gameSession.updateMany({
        where: { id: session.id, reminderSentAt: null },
        data: { reminderSentAt: now },
      });
      if (!count) continue;

      await this.notifications.notify(
        session.members.map((m) => m.userId),
        {
          type: NotificationType.SESSION_REMINDER,
          title: `Tu sesión de ${session.game.name} comienza en ${timeUntil(session.startsAt, now)}`,
          body: session.title,
          data: { sessionId: session.id, startsAt: session.startsAt.toISOString() },
        },
      );
      sent++;
    }
    return sent;
  }

  async updateStatuses(now = new Date()) {
    const started = await this.transition(
      { status: { in: ACTIVE }, startsAt: { lte: now } },
      SessionStatus.IN_PROGRESS,
    );
    const finished = await this.transition(
      {
        status: SessionStatus.IN_PROGRESS,
        OR: [
          { endsAt: { lte: now } },
          {
            endsAt: null,
            startsAt: { lte: new Date(now.getTime() - DEFAULT_DURATION_H * 3600_000) },
          },
        ],
      },
      SessionStatus.FINISHED,
    );
    return { started, finished };
  }

  private async transition(
    where: Parameters<PrismaService['gameSession']['updateMany']>[0]['where'],
    status: SessionStatus,
  ) {
    const rows = await this.prisma.gameSession.findMany({ where, select: { id: true } });
    if (!rows.length) return 0;
    const ids = rows.map((r) => r.id);
    const { count } = await this.prisma.gameSession.updateMany({
      where: { AND: [where ?? {}, { id: { in: ids } }] },
      data: { status },
    });
    for (const id of ids) {
      this.chat.emitToSession(id, 'session:status', { sessionId: id, status });
      if (status === SessionStatus.FINISHED) await this.voice.closeSession(id);
    }
    return count;
  }
}

function timeUntil(startsAt: Date, now: Date) {
  const minutes = Math.max(1, Math.round((startsAt.getTime() - now.getTime()) / 60_000));
  if (minutes >= 55) return '1 hora';
  return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
}
