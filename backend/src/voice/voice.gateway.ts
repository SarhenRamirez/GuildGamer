import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { userRoom, useWsAuth } from '../auth/ws-auth.js';
import { type Ack, requireUuid, wsHandle, WsUserError } from '../common/ws-ack.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { VoiceService, type VoiceTarget } from './voice.service.js';

export const MAX_VOICE_PEERS = 8;

export interface Participant {
  socketId: string;
  userId: string;
  username: string;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
}

type VoiceSocket = Socket & { data: { user: AuthUser; voiceRoom?: string } };

@WebSocketGateway({
  namespace: '/voice',
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' },
})
export class VoiceGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer() private server: Namespace;
  private readonly logger = new Logger(VoiceGateway.name);
  private readonly rooms = new Map<string, Map<string, Participant>>();

  constructor(
    private readonly auth: AuthService,
    private readonly voice: VoiceService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(namespace: Namespace) {
    useWsAuth(namespace, this.auth);
  }

  handleDisconnect(socket: VoiceSocket) {
    this.leave(socket);
  }

  @SubscribeMessage('voice:join')
  onJoin(
    @ConnectedSocket() socket: VoiceSocket,
    @MessageBody() body: { sessionId?: unknown; roomId?: unknown },
  ): Promise<Ack<{ self: Participant; peers: Participant[] }>> {
    return wsHandle(this.logger, async () => {
      const target: VoiceTarget = body?.sessionId
        ? { sessionId: requireUuid(body.sessionId, 'sessionId') }
        : { roomId: requireUuid(body?.roomId, 'roomId') };
      const roomKey = await this.voice.authorize(target, socket.data.user);

      if (socket.data.voiceRoom === roomKey) {
        throw new WsUserError('Ya estás en este canal');
      }
      const room = this.rooms.get(roomKey) ?? new Map<string, Participant>();
      if (room.size >= MAX_VOICE_PEERS) {
        throw new WsUserError(`El canal está lleno (máximo ${MAX_VOICE_PEERS})`);
      }
      this.leave(socket);

      const { username } = await this.prisma.user.findUniqueOrThrow({
        where: { id: socket.data.user.id },
        select: { username: true },
      });
      const self: Participant = {
        socketId: socket.id,
        userId: socket.data.user.id,
        username,
        muted: false,
        deafened: false,
        speaking: false,
      };
      const peers = [...room.values()];
      room.set(socket.id, self);
      this.rooms.set(roomKey, room);
      socket.data.voiceRoom = roomKey;
      await socket.join(roomKey);
      socket.to(roomKey).emit('voice:peer-joined', self);
      return { self, peers };
    });
  }

  @SubscribeMessage('voice:signal')
  onSignal(
    @ConnectedSocket() socket: VoiceSocket,
    @MessageBody() body: { to?: unknown; data?: unknown },
  ): Promise<Ack> {
    return wsHandle(this.logger, async () => {
      const roomKey = socket.data.voiceRoom;
      const to = typeof body?.to === 'string' ? body.to : '';
      if (!roomKey || !this.rooms.get(roomKey)?.has(to)) {
        throw new WsUserError('Ese participante no está en tu canal');
      }
      this.server.to(to).emit('voice:signal', { from: socket.id, data: body.data });
    });
  }

  @SubscribeMessage('voice:state')
  onState(
    @ConnectedSocket() socket: VoiceSocket,
    @MessageBody() body: { muted?: unknown; deafened?: unknown; speaking?: unknown },
  ): Promise<Ack> {
    return wsHandle(this.logger, async () => {
      const roomKey = socket.data.voiceRoom;
      const me = roomKey && this.rooms.get(roomKey)?.get(socket.id);
      if (!me) throw new WsUserError('No estás en un canal de voz');
      for (const key of ['muted', 'deafened', 'speaking'] as const) {
        if (typeof body?.[key] === 'boolean') me[key] = body[key];
      }
      if (me.deafened) me.muted = true;
      this.server.to(roomKey).emit('voice:state', me);
    });
  }

  @SubscribeMessage('voice:leave')
  onLeave(@ConnectedSocket() socket: VoiceSocket): Promise<Ack> {
    return wsHandle(this.logger, async () => {
      this.leave(socket);
    });
  }

  async removeUserFromSession(sessionId: string, userId: string) {
    const roomKey = `voice:session:${sessionId}`;
    for (const socket of await this.server.in(userRoom(userId)).fetchSockets()) {
      if (socket.data.voiceRoom === roomKey) {
        const s = this.server.sockets.get(socket.id) as VoiceSocket | undefined;
        if (s) {
          s.emit('voice:closed', { sessionId, reason: 'removed' });
          this.leave(s);
        }
      }
    }
  }

  async closeSession(sessionId: string) {
    const roomKey = `voice:session:${sessionId}`;
    this.server.to(roomKey).emit('voice:closed', { sessionId, reason: 'ended' });
    for (const socketId of this.rooms.get(roomKey)?.keys() ?? []) {
      const s = this.server.sockets.get(socketId) as VoiceSocket | undefined;
      if (s) this.leave(s);
    }
    this.rooms.delete(roomKey);
    await this.voice.closeSessionChannel(sessionId);
  }

  participants(target: VoiceTarget) {
    const key = 'sessionId' in target ? `voice:session:${target.sessionId}` : `voice:room:${target.roomId}`;
    return [...(this.rooms.get(key)?.values() ?? [])];
  }

  disconnectUser(userId: string) {
    this.server.in(userRoom(userId)).disconnectSockets(true);
  }

  private leave(socket: VoiceSocket) {
    const roomKey = socket.data.voiceRoom;
    if (!roomKey) return;
    const room = this.rooms.get(roomKey);
    const me = room?.get(socket.id);
    room?.delete(socket.id);
    if (room && !room.size) this.rooms.delete(roomKey);
    socket.data.voiceRoom = undefined;
    void socket.leave(roomKey);
    if (me) {
      this.server.to(roomKey).emit('voice:peer-left', {
        socketId: socket.id,
        userId: me.userId,
      });
    }
  }
}
