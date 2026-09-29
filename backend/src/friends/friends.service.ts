import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import {
  FriendshipStatus,
  MemberStatus,
  NotificationType,
  SessionStatus,
} from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const friendSelect = {
  id: true,
  username: true,
  avatarUrl: true,
  availability: true,
  skillLevel: true,
} as const;

const AVAILABILITY_ORDER = { AVAILABLE: 0, AWAY: 1, UNAVAILABLE: 2 } as const;

@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(userId: string) {
    const friends = await this.accepted(userId);
    const playing = await this.prisma.sessionMember.findMany({
      where: {
        userId: { in: friends.map((f) => f.user.id) },
        status: MemberStatus.ACCEPTED,
        session: { status: SessionStatus.IN_PROGRESS },
      },
      select: {
        userId: true,
        session: { select: { id: true, title: true, kind: true, game: { select: { name: true } } } },
      },
    });
    return friends.map((f) => {
      const s = playing.find((p) => p.userId === f.user.id)?.session;
      return {
        ...f,
        playing: s ? { sessionId: s.id, title: s.title, kind: s.kind, game: s.game.name } : null,
      };
    });
  }

  private async accepted(userId: string) {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: {
        id: true,
        updatedAt: true,
        requester: { select: friendSelect },
        addressee: { select: friendSelect },
      },
    });
    return rows
      .map((f) => ({
        friendshipId: f.id,
        since: f.updatedAt,
        user: f.requester.id === userId ? f.addressee : f.requester,
      }))
      .sort(
        (a, b) =>
          AVAILABILITY_ORDER[a.user.availability] - AVAILABILITY_ORDER[b.user.availability] ||
          a.user.username.localeCompare(b.user.username),
      );
  }

  async requests(userId: string) {
    const [incoming, outgoing] = await Promise.all([
      this.prisma.friendship.findMany({
        where: { addresseeId: userId, status: FriendshipStatus.PENDING },
        select: { id: true, createdAt: true, requester: { select: friendSelect } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.friendship.findMany({
        where: { requesterId: userId, status: FriendshipStatus.PENDING },
        select: { id: true, createdAt: true, addressee: { select: friendSelect } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      incoming: incoming.map((f) => ({ id: f.id, createdAt: f.createdAt, user: f.requester })),
      outgoing: outgoing.map((f) => ({ id: f.id, createdAt: f.createdAt, user: f.addressee })),
    };
  }

  async request(from: AuthUser, toUserId: string) {
    if (from.id === toUserId) {
      throw new BadRequestException('No puedes enviarte una solicitud a ti mismo');
    }
    const target = await this.prisma.user.findUnique({
      where: { id: toUserId },
      select: { isBanned: true },
    });
    if (!target || target.isBanned) throw new NotFoundException('Usuario no encontrado');

    const existing = await this.between(from.id, toUserId);
    if (existing) {
      switch (existing.status) {
        case FriendshipStatus.ACCEPTED:
          throw new ConflictException('Ya son amigos');
        case FriendshipStatus.BLOCKED:
          throw new ForbiddenException('No puedes enviar una solicitud a este usuario');
        case FriendshipStatus.PENDING:
          if (existing.requesterId === from.id) {
            throw new ConflictException('Ya le enviaste una solicitud');
          }
          return this.accept(existing.id, from);
        case FriendshipStatus.REJECTED:
          await this.prisma.friendship.delete({ where: { id: existing.id } });
      }
    }

    const friendship = await this.prisma.friendship.create({
      data: { requesterId: from.id, addresseeId: toUserId },
      select: { id: true, status: true, requester: { select: { username: true } } },
    });
    await this.notifications.notify([toUserId], {
      type: NotificationType.FRIEND_REQUEST,
      title: `${friendship.requester.username} quiere ser tu amigo`,
      data: { friendshipId: friendship.id, userId: from.id },
    });
    return { id: friendship.id, status: friendship.status };
  }

  async accept(friendshipId: string, user: AuthUser) {
    const f = await this.pendingFor(friendshipId, user.id);
    const updated = await this.prisma.friendship.update({
      where: { id: f.id },
      data: { status: FriendshipStatus.ACCEPTED },
      select: { id: true, status: true, addressee: { select: { username: true } } },
    });
    await this.notifications.notify([f.requesterId], {
      type: NotificationType.FRIEND_ACCEPTED,
      title: `${updated.addressee.username} aceptó tu solicitud de amistad`,
      data: { friendshipId: f.id, userId: user.id },
    });
    return { id: updated.id, status: updated.status };
  }

  async reject(friendshipId: string, user: AuthUser) {
    const f = await this.pendingFor(friendshipId, user.id);
    await this.prisma.friendship.update({
      where: { id: f.id },
      data: { status: FriendshipStatus.REJECTED },
    });
  }

  async cancelRequest(friendshipId: string, user: AuthUser) {
    const { count } = await this.prisma.friendship.deleteMany({
      where: { id: friendshipId, requesterId: user.id, status: FriendshipStatus.PENDING },
    });
    if (!count) throw new NotFoundException('Solicitud no encontrada');
  }

  async remove(user: AuthUser, friendId: string) {
    const { count } = await this.prisma.friendship.deleteMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [
          { requesterId: user.id, addresseeId: friendId },
          { requesterId: friendId, addresseeId: user.id },
        ],
      },
    });
    if (!count) throw new NotFoundException('No son amigos');
  }

  async block(user: AuthUser, targetId: string) {
    if (user.id === targetId) throw new BadRequestException('No puedes bloquearte a ti mismo');
    await this.prisma.$transaction([
      this.prisma.friendship.deleteMany({
        where: {
          OR: [
            { requesterId: user.id, addresseeId: targetId },
            { requesterId: targetId, addresseeId: user.id },
          ],
        },
      }),
      this.prisma.friendship.create({
        data: { requesterId: user.id, addresseeId: targetId, status: FriendshipStatus.BLOCKED },
      }),
    ]);
  }

  async unblock(user: AuthUser, targetId: string) {
    const { count } = await this.prisma.friendship.deleteMany({
      where: { requesterId: user.id, addresseeId: targetId, status: FriendshipStatus.BLOCKED },
    });
    if (!count) throw new NotFoundException('Ese usuario no está bloqueado');
  }

  async areFriends(a: string, b: string) {
    const f = await this.between(a, b);
    return f?.status === FriendshipStatus.ACCEPTED;
  }

  async friendIds(userId: string) {
    return (await this.accepted(userId)).map((f) => f.user.id);
  }

  private between(a: string, b: string) {
    return this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: a, addresseeId: b },
          { requesterId: b, addresseeId: a },
        ],
      },
      select: { id: true, status: true, requesterId: true },
    });
  }

  private async pendingFor(friendshipId: string, addresseeId: string) {
    const f = await this.prisma.friendship.findFirst({
      where: { id: friendshipId, addresseeId, status: FriendshipStatus.PENDING },
      select: { id: true, requesterId: true },
    });
    if (!f) throw new NotFoundException('Solicitud no encontrada');
    return f;
  }
}
