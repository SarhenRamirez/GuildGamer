import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { userRoom, useWsAuth } from '../auth/ws-auth.js';

type PresenceSocket = Socket & { data: { user?: AuthUser } };

@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' },
})
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() private server: Namespace;
  private readonly connections = new Map<string, number>();

  constructor(private readonly auth: AuthService) {}

  afterInit(namespace: Namespace) {
    useWsAuth(namespace, this.auth);
  }

  handleConnection(socket: PresenceSocket) {
    const id = socket.data.user?.id;
    if (id) this.connections.set(id, (this.connections.get(id) ?? 0) + 1);
  }

  handleDisconnect(socket: PresenceSocket) {
    const id = socket.data.user?.id;
    if (!id) return;
    const left = (this.connections.get(id) ?? 1) - 1;
    if (left > 0) this.connections.set(id, left);
    else this.connections.delete(id);
  }

  onlineUserIds() {
    return [...this.connections.keys()];
  }

  push(userId: string, notification: unknown) {
    this.server.to(userRoom(userId)).emit('notification:new', notification);
  }

  disconnectUser(userId: string) {
    this.server.in(userRoom(userId)).disconnectSockets(true);
  }
}
