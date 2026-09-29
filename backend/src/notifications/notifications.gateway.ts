import {
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace } from 'socket.io';
import { AuthService } from '../auth/auth.service.js';
import { userRoom, useWsAuth } from '../auth/ws-auth.js';

@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' },
})
export class NotificationsGateway implements OnGatewayInit {
  @WebSocketServer() private server: Namespace;

  constructor(private readonly auth: AuthService) {}

  afterInit(namespace: Namespace) {
    useWsAuth(namespace, this.auth);
  }

  push(userId: string, notification: unknown) {
    this.server.to(userRoom(userId)).emit('notification:new', notification);
  }

  disconnectUser(userId: string) {
    this.server.in(userRoom(userId)).disconnectSockets(true);
  }
}
