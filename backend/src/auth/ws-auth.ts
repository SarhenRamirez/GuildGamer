import { HttpException } from '@nestjs/common';
import type { Namespace } from 'socket.io';
import type { AuthService } from './auth.service.js';

export const userRoom = (userId: string) => `user:${userId}`;

export function useWsAuth(namespace: Namespace, auth: AuthService) {
  namespace.use((socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      socket.handshake.headers.authorization?.replace(/^Bearer /, '');
    if (!token) return next(new Error('Token requerido'));
    auth
      .verifyToken(token)
      .then(async (user) => {
        socket.data.user = user;
        await socket.join(userRoom(user.id));
        next();
      })
      .catch((e: unknown) =>
        next(new Error(e instanceof HttpException ? e.message : 'No autorizado')),
      );
  });
}
