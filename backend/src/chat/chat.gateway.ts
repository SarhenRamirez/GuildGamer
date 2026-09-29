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
import { ChatService, MAX_MESSAGE_LENGTH } from './chat.service.js';

type ChatSocket = Socket & { data: { user: AuthUser } };

export const sessionRoom = (sessionId: string) => `session:${sessionId}`;

const RATE_MAX = 5;
const RATE_WINDOW_MS = 3000;

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' },
})
export class ChatGateway implements OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer() private server: Namespace;
  private readonly logger = new Logger(ChatGateway.name);
  private readonly sentAt = new Map<string, number[]>();

  constructor(
    private readonly auth: AuthService,
    private readonly chat: ChatService,
  ) {}

  afterInit(namespace: Namespace) {
    useWsAuth(namespace, this.auth);
    this.chat.bindRealtime({
      emitToUser: (userId, event, payload) =>
        this.server.to(userRoom(userId)).emit(event, payload),
      isOnline: async (userId) =>
        (await this.server.in(userRoom(userId)).fetchSockets()).length > 0,
    });
  }

  handleDisconnect(socket: ChatSocket) {
    this.sentAt.delete(socket.id);
  }

  @SubscribeMessage('session:join')
  onJoin(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() body: { sessionId?: unknown },
  ): Promise<Ack> {
    return wsHandle(this.logger, async () => {
      const sessionId = requireUuid(body?.sessionId, 'sessionId');
      await this.chat.assertCanRead(sessionId, socket.data.user);
      await socket.join(sessionRoom(sessionId));
    });
  }

  @SubscribeMessage('session:leave')
  onLeave(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() body: { sessionId?: unknown },
  ): Promise<Ack> {
    return wsHandle(this.logger, async () => {
      await socket.leave(sessionRoom(requireUuid(body?.sessionId, 'sessionId')));
    });
  }

  @SubscribeMessage('message:send')
  onMessage(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() body: { sessionId?: unknown; content?: unknown },
  ): Promise<Ack<unknown>> {
    return wsHandle(this.logger, async () => {
      const sessionId = requireUuid(body?.sessionId, 'sessionId');
      const content = this.validContent(body?.content);
      this.checkRate(socket.id);

      const message = await this.chat.createMessage(sessionId, socket.data.user, content);
      this.server.to(sessionRoom(sessionId)).emit('message:new', message);
      return message;
    });
  }

  @SubscribeMessage('dm:send')
  onDirect(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() body: { toUserId?: unknown; content?: unknown },
  ): Promise<Ack<unknown>> {
    return wsHandle(this.logger, async () => {
      const to = requireUuid(body?.toUserId, 'toUserId');
      const content = this.validContent(body?.content);
      this.checkRate(socket.id);
      return this.chat.sendDirect(socket.data.user, to, content);
    });
  }

  @SubscribeMessage('typing')
  onTyping(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() body: { sessionId?: unknown },
  ) {
    const sessionId = body?.sessionId;
    if (typeof sessionId === 'string' && socket.rooms.has(sessionRoom(sessionId))) {
      socket
        .to(sessionRoom(sessionId))
        .emit('typing', { sessionId, userId: socket.data.user.id });
    }
  }

  emitToSession(sessionId: string, event: string, payload: unknown) {
    this.server.to(sessionRoom(sessionId)).emit(event, payload);
  }

  removeUserFromSession(sessionId: string, userId: string) {
    this.server.to(userRoom(userId)).emit('session:removed', { sessionId });
    this.server.in(userRoom(userId)).socketsLeave(sessionRoom(sessionId));
  }

  disconnectUser(userId: string) {
    this.server.in(userRoom(userId)).disconnectSockets(true);
  }

  private validContent(raw: unknown) {
    const content = typeof raw === 'string' ? raw.trim() : '';
    if (!content || content.length > MAX_MESSAGE_LENGTH) {
      throw new WsUserError(
        `El mensaje debe tener entre 1 y ${MAX_MESSAGE_LENGTH} caracteres`,
      );
    }
    return content;
  }

  private checkRate(socketId: string) {
    const now = Date.now();
    const recent = (this.sentAt.get(socketId) ?? []).filter(
      (t) => now - t < RATE_WINDOW_MS,
    );
    if (recent.length >= RATE_MAX) {
      throw new WsUserError('Vas demasiado rápido, espera un momento');
    }
    recent.push(now);
    this.sentAt.set(socketId, recent);
  }
}
