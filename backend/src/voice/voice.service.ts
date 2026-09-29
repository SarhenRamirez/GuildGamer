import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../auth/auth.types.js';
import { FriendsService } from '../friends/friends.service.js';
import { MemberStatus, SessionStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

const VOICE_OPEN: SessionStatus[] = [
  SessionStatus.OPEN,
  SessionStatus.FULL,
  SessionStatus.IN_PROGRESS,
];

export type VoiceTarget = { sessionId: string } | { roomId: string };

@Injectable()
export class VoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly friends: FriendsService,
    private readonly config: ConfigService,
  ) {}

  async authorize(target: VoiceTarget, user: AuthUser) {
    if ('sessionId' in target) {
      const session = await this.prisma.gameSession.findUnique({
        where: { id: target.sessionId },
        select: {
          title: true,
          status: true,
          members: { where: { userId: user.id }, select: { status: true } },
        },
      });
      if (!session) throw new NotFoundException('Sesión no encontrada');
      if (session.members[0]?.status !== MemberStatus.ACCEPTED) {
        throw new ForbiddenException('No eres miembro de esta sesión');
      }
      if (!VOICE_OPEN.includes(session.status)) {
        throw new ForbiddenException('El canal de voz de esta sesión está cerrado');
      }
      await this.prisma.voiceChannel.upsert({
        where: { sessionId: target.sessionId },
        create: { sessionId: target.sessionId, name: session.title },
        update: {},
      });
      return `voice:session:${target.sessionId}`;
    }

    const room = await this.prisma.voiceChannel.findFirst({
      where: { id: target.roomId, persistent: true, closedAt: null },
      select: { ownerId: true },
    });
    if (!room?.ownerId) throw new NotFoundException('Sala no encontrada');
    if (room.ownerId !== user.id && !(await this.friends.areFriends(room.ownerId, user.id))) {
      throw new ForbiddenException('Solo el dueño y sus amigos pueden entrar');
    }
    return `voice:room:${target.roomId}`;
  }

  createRoom(owner: AuthUser, name: string) {
    return this.prisma.voiceChannel.create({
      data: { ownerId: owner.id, name, persistent: true },
      select: { id: true, name: true, createdAt: true },
    });
  }

  async listRooms(user: AuthUser) {
    const friendIds = await this.friends.friendIds(user.id);
    return this.prisma.voiceChannel.findMany({
      where: {
        persistent: true,
        closedAt: null,
        ownerId: { in: [user.id, ...friendIds] },
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        owner: { select: { id: true, username: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteRoom(user: AuthUser, roomId: string) {
    const { count } = await this.prisma.voiceChannel.updateMany({
      where: { id: roomId, ownerId: user.id, persistent: true, closedAt: null },
      data: { closedAt: new Date() },
    });
    if (!count) throw new NotFoundException('Sala no encontrada');
  }

  async closeSessionChannel(sessionId: string) {
    await this.prisma.voiceChannel.updateMany({
      where: { sessionId, closedAt: null },
      data: { closedAt: new Date() },
    });
  }

  iceServers() {
    const servers: { urls: string | string[]; username?: string; credential?: string }[] = [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    ];
    const turn = this.config.get<string>('TURN_URL');
    if (turn) {
      servers.push({
        urls: turn,
        username: this.config.get<string>('TURN_USERNAME'),
        credential: this.config.get<string>('TURN_CREDENTIAL'),
      });
    }
    return { iceServers: servers };
  }
}
