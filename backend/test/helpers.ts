import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { setupApp } from '../src/setup-app.js';

export interface TestUser {
  id: string;
  token: string;
  username: string;
}

export async function bootstrap<N extends string>(names: readonly N[]) {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = moduleRef.createNestApplication();
  setupApp(app);
  await app.listen(0);
  const baseUrl = `http://localhost:${(app.getHttpServer().address() as AddressInfo).port}`;
  const prisma = app.get(PrismaService);
  const run = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const sockets: Socket[] = [];

  const api = () => request(app.getHttpServer());
  const users = {} as Record<N, TestUser>;
  for (const name of names) {
    const username = `${name}_${run}`.slice(0, 20);
    const res = await api()
      .post('/auth/register')
      .send({ email: `${name}_${run}@test.gz`, username, password: 'supersecreta1' })
      .expect(201);
    users[name] = { id: res.body.user.id, token: res.body.accessToken, username };
  }

  const as = (who: N) => ({ Authorization: `Bearer ${users[who].token}` });

  const connect = async (namespace: string, who: N) => {
    const socket = io(`${baseUrl}${namespace}`, {
      auth: { token: users[who].token },
      transports: ['websocket'],
      reconnection: false,
    });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    return socket;
  };

  const cleanup = async () => {
    sockets.forEach((s) => s.disconnect());
    const mine = { endsWith: `${run}@test.gz` };
    await prisma.gameSession.deleteMany({ where: { creator: { email: mine } } });
    await prisma.user.deleteMany({ where: { email: mine } });
    await app.close();
  };

  return { app, prisma, api, users, as, connect, cleanup, run, baseUrl };
}

export const nextEvent = <T = any>(socket: Socket, event: string, ms = 2000) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout esperando ${event}`)), ms);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

export const inMinutes = (m: number) => new Date(Date.now() + m * 60_000);
