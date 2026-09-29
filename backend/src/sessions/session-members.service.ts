import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { ChatGateway } from '../chat/chat.gateway.js';
import { FriendsService } from '../friends/friends.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  JoinMode,
  MemberStatus,
  NotificationType,
  Role,
  SessionStatus,
} from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { VoiceGateway } from '../voice/voice.gateway.js';

type Tx = Prisma.TransactionClient;
type LockedSession = Awaited<ReturnType<SessionMembersService['lockSession']>>;

const userSummary = { id: true, username: true, avatarUrl: true } as const;

const label = (s: { title: string; game: { name: string } }) =>
  `"${s.title}" (${s.game.name})`;

@Injectable()
export class SessionMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatGateway,
    private readonly notifications: NotificationsService,
    private readonly friends: FriendsService,
    private readonly voice: VoiceGateway,
  ) {}

  async join(sessionId: string, user: AuthUser) {
    const { member, session } = await this.prisma.$transaction(async (tx) => {
      const session = await this.lockSession(tx, sessionId, user.id);

      if (session.creatorId === user.id) {
        throw new ConflictException('Ya eres el creador de esta sesión');
      }
      switch (session.myStatus) {
        case MemberStatus.ACCEPTED:
          throw new ConflictException('Ya estás en esta sesión');
        case MemberStatus.PENDING:
          throw new ConflictException('Tu solicitud ya está pendiente');
        case MemberStatus.REJECTED:
          throw new ForbiddenException('El creador rechazó tu solicitud');
        case MemberStatus.KICKED:
          throw new ForbiddenException('Fuiste expulsado de esta sesión');
      }
      if (session.status === SessionStatus.FULL) {
        throw new ConflictException('La sesión está llena');
      }
      if (session.status !== SessionStatus.OPEN) {
        throw new ConflictException('La sesión ya no admite jugadores');
      }
      if (session.startsAt.getTime() <= Date.now()) {
        throw new ConflictException('La sesión ya ha empezado');
      }

      const status =
        session.myStatus === MemberStatus.INVITED ||
        session.joinMode === JoinMode.AUTOMATIC
          ? MemberStatus.ACCEPTED
          : MemberStatus.PENDING;

      const member = await tx.sessionMember.upsert({
        where: { sessionId_userId: { sessionId, userId: user.id } },
        create: { sessionId, userId: user.id, status },
        update: { status, joinedAt: new Date() },
        select: { status: true, joinedAt: true, user: { select: userSummary } },
      });
      if (status === MemberStatus.ACCEPTED) {
        await this.syncFullStatus(tx, sessionId, session.maxPlayers, session.accepted + 1);
      }
      return { member, session };
    });

    const data = { sessionId, userId: user.id };
    if (member.status === MemberStatus.ACCEPTED) {
      this.chat.emitToSession(sessionId, 'member:joined', { sessionId, member });
      await this.notifications.notify([session.creatorId], {
        type: NotificationType.MEMBER_JOINED,
        title: `${member.user.username} se unió a ${label(session)}`,
        data,
      });
    } else {
      await this.notifications.notify([session.creatorId], {
        type: NotificationType.JOIN_REQUEST,
        title: `${member.user.username} quiere unirse a ${label(session)}`,
        data,
      });
    }
    return member;
  }

  async leave(sessionId: string, user: AuthUser) {
    const { wasAccepted, session } = await this.prisma.$transaction(async (tx) => {
      const session = await this.lockSession(tx, sessionId, user.id);
      if (session.creatorId === user.id) {
        throw new BadRequestException(
          'El creador no puede salir de su sesión; cancélala en su lugar',
        );
      }
      const leavable: (MemberStatus | null)[] = [
        MemberStatus.ACCEPTED,
        MemberStatus.PENDING,
        MemberStatus.INVITED,
      ];
      if (!leavable.includes(session.myStatus)) {
        throw new NotFoundException('No estás en esta sesión');
      }
      this.assertActive(session.status);

      await this.setMemberStatus(tx, sessionId, user.id, MemberStatus.LEFT);
      const wasAccepted = session.myStatus === MemberStatus.ACCEPTED;
      if (wasAccepted) {
        await this.syncFullStatus(tx, sessionId, session.maxPlayers, session.accepted - 1);
      }
      return { wasAccepted, session };
    });

    if (wasAccepted) {
      this.onMemberGone(sessionId, user.id, 'left');
      const { username } = await this.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { username: true },
      });
      await this.notifications.notify([session.creatorId], {
        type: NotificationType.MEMBER_LEFT,
        title: `${username} salió de ${label(session)}`,
        data: { sessionId, userId: user.id },
      });
    }
  }

  async accept(sessionId: string, targetId: string, actor: AuthUser) {
    const { member, session } = await this.prisma.$transaction(async (tx) => {
      const session = await this.lockSession(tx, sessionId, targetId);
      this.assertCreator(session, actor);
      if (session.myStatus !== MemberStatus.PENDING) {
        throw new NotFoundException('No hay una solicitud pendiente de ese usuario');
      }
      if (session.status === SessionStatus.FULL) {
        throw new ConflictException('La sesión está llena');
      }
      this.assertActive(session.status);

      const member = await this.setMemberStatus(tx, sessionId, targetId, MemberStatus.ACCEPTED);
      await this.syncFullStatus(tx, sessionId, session.maxPlayers, session.accepted + 1);
      return { member, session };
    });

    this.chat.emitToSession(sessionId, 'member:joined', { sessionId, member });
    await this.notifications.notify([targetId], {
      type: NotificationType.JOIN_ACCEPTED,
      title: `¡Te aceptaron en ${label(session)}!`,
      body: 'Ya puedes entrar al chat del grupo.',
      data: { sessionId },
    });
    return member;
  }

  async reject(sessionId: string, targetId: string, actor: AuthUser) {
    const session = await this.prisma.$transaction(async (tx) => {
      const session = await this.lockSession(tx, sessionId, targetId);
      this.assertCreator(session, actor);
      if (session.myStatus !== MemberStatus.PENDING) {
        throw new NotFoundException('No hay una solicitud pendiente de ese usuario');
      }
      await this.setMemberStatus(tx, sessionId, targetId, MemberStatus.REJECTED);
      return session;
    });

    await this.notifications.notify([targetId], {
      type: NotificationType.JOIN_REJECTED,
      title: `Tu solicitud para ${label(session)} no fue aceptada`,
      data: { sessionId },
    });
  }

  async kick(sessionId: string, targetId: string, actor: AuthUser) {
    const session = await this.prisma.$transaction(async (tx) => {
      const session = await this.lockSession(tx, sessionId, targetId);
      this.assertCreator(session, actor);
      if (targetId === session.creatorId) {
        throw new BadRequestException('No puedes expulsar al creador');
      }
      if (session.myStatus !== MemberStatus.ACCEPTED) {
        throw new NotFoundException('Ese usuario no está en la sesión');
      }
      this.assertActive(session.status);

      await this.setMemberStatus(tx, sessionId, targetId, MemberStatus.KICKED);
      await this.syncFullStatus(tx, sessionId, session.maxPlayers, session.accepted - 1);
      return session;
    });

    this.onMemberGone(sessionId, targetId, 'kicked');
    await this.notifications.notify([targetId], {
      type: NotificationType.SYSTEM,
      title: `Ya no formas parte de ${label(session)}`,
      body: 'El creador de la sesión te ha retirado del grupo.',
      data: { sessionId },
    });
  }

  async invite(sessionId: string, friendId: string, actor: AuthUser) {
    if (friendId === actor.id) throw new BadRequestException('No puedes invitarte a ti mismo');
    if (!(await this.friends.areFriends(actor.id, friendId))) {
      throw new ForbiddenException('Solo puedes invitar a tus amigos');
    }

    const { session, inviter } = await this.prisma.$transaction(async (tx) => {
      const session = await this.lockSession(tx, sessionId, friendId);
      const inviter = await tx.sessionMember.findUnique({
        where: { sessionId_userId: { sessionId, userId: actor.id } },
        select: { status: true, user: { select: { username: true } } },
      });
      if (inviter?.status !== MemberStatus.ACCEPTED) {
        throw new ForbiddenException('Solo los miembros de la sesión pueden invitar');
      }
      if (session.status !== SessionStatus.OPEN) {
        throw new ConflictException('La sesión no tiene puestos libres');
      }
      switch (session.myStatus) {
        case MemberStatus.ACCEPTED:
          throw new ConflictException('Ya está en la sesión');
        case MemberStatus.PENDING:
          throw new ConflictException('Ya tiene una solicitud pendiente');
      }

      const isCreator = session.creatorId === actor.id;
      const blocked =
        session.myStatus === MemberStatus.KICKED || session.myStatus === MemberStatus.REJECTED;
      if (blocked && !isCreator) {
        throw new ForbiddenException('Solo el creador puede volver a invitar a este jugador');
      }
      if (isCreator) {
        await tx.sessionMember.upsert({
          where: { sessionId_userId: { sessionId, userId: friendId } },
          create: { sessionId, userId: friendId, status: MemberStatus.INVITED },
          update: { status: MemberStatus.INVITED },
        });
      }
      return { session, inviter };
    });

    await this.notifications.notify([friendId], {
      type: NotificationType.SESSION_INVITE,
      title: `${inviter.user.username} te invita a ${label(session)}`,
      data: { sessionId, userId: actor.id },
    });
    return { invited: true, directJoin: session.creatorId === actor.id };
  }

  private async lockSession(tx: Tx, sessionId: string, userId: string) {
    await tx.$queryRaw`SELECT 1 FROM game_sessions WHERE id = ${sessionId} FOR UPDATE`;
    const session = await tx.gameSession.findUnique({
      where: { id: sessionId },
      select: {
        title: true,
        creatorId: true,
        status: true,
        joinMode: true,
        maxPlayers: true,
        startsAt: true,
        game: { select: { name: true } },
        members: { where: { userId }, select: { status: true } },
        _count: {
          select: { members: { where: { status: MemberStatus.ACCEPTED } } },
        },
      },
    });
    if (!session) throw new NotFoundException('Sesión no encontrada');
    const { members, _count, ...rest } = session;
    return {
      ...rest,
      myStatus: members[0]?.status ?? null,
      accepted: _count.members,
    };
  }

  private setMemberStatus(tx: Tx, sessionId: string, userId: string, status: MemberStatus) {
    return tx.sessionMember.update({
      where: { sessionId_userId: { sessionId, userId } },
      data: { status },
      select: { status: true, joinedAt: true, user: { select: userSummary } },
    });
  }

  private async syncFullStatus(tx: Tx, sessionId: string, maxPlayers: number, accepted: number) {
    await tx.gameSession.update({
      where: { id: sessionId },
      data: {
        status: accepted >= maxPlayers ? SessionStatus.FULL : SessionStatus.OPEN,
      },
    });
  }

  private assertCreator(session: LockedSession, actor: AuthUser) {
    if (session.creatorId !== actor.id && actor.role !== Role.ADMIN) {
      throw new ForbiddenException('Solo el creador gestiona los miembros');
    }
  }

  private assertActive(status: SessionStatus) {
    if (status !== SessionStatus.OPEN && status !== SessionStatus.FULL) {
      throw new ConflictException('La sesión ya no admite cambios de miembros');
    }
  }

  private onMemberGone(sessionId: string, userId: string, reason: 'left' | 'kicked') {
    this.chat.emitToSession(sessionId, 'member:left', { sessionId, userId, reason });
    this.chat.removeUserFromSession(sessionId, userId);
    void this.voice.removeUserFromSession(sessionId, userId);
  }
}
