import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { setupApp } from './../src/setup-app.js';

const NAMES = ['maria', 'carlos', 'laura', 'pedro', 'ana', 'luis'] as const;
type Name = (typeof NAMES)[number];

describe('Miembros y chat (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;
  let fortniteId: string;
  const run = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const users = {} as Record<Name, { id: string; token: string }>;
  const sockets: Socket[] = [];

  const api = () => request(app.getHttpServer());
  const as = (who: Name) => ({ Authorization: `Bearer ${users[who].token}` });
  const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

  const createSession = async (overrides: Record<string, unknown> = {}) => {
    const res = await api()
      .post('/sessions')
      .set(as('maria'))
      .send({
        title: 'Partida de prueba',
        gameId: fortniteId,
        platform: 'PC',
        maxPlayers: 4,
        skillLevel: 'INTERMEDIATE',
        startsAt: inHours(2),
        joinInfo: 'Sala ABC',
        ...overrides,
      })
      .expect(201);
    return res.body.id as string;
  };

  const connect = async (token: string) => {
    const socket = io(`${baseUrl}/chat`, { auth: { token }, transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    return socket;
  };

  const nextEvent = <T = any>(socket: Socket, event: string, ms = 2000) =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout esperando ${event}`)), ms);
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.listen(0);
    baseUrl = `http://localhost:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);

    for (const name of NAMES) {
      const res = await api()
        .post('/auth/register')
        .send({ email: `${name}_${run}@test.gz`, username: `${name}_${run}`, password: 'supersecreta1' })
        .expect(201);
      users[name] = { id: res.body.user.id, token: res.body.accessToken };
    }
    fortniteId = (await prisma.game.findUniqueOrThrow({ where: { slug: 'fortnite' } })).id;
  });

  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    await prisma.gameSession.deleteMany({ where: { creator: { email: { endsWith: `${run}@test.gz` } } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: `${run}@test.gz` } } });
    await app.close();
  });

  describe('ingreso automático', () => {
    it('acepta al instante y marca la sesión como FULL al completarse', async () => {
      const id = await createSession({ joinMode: 'AUTOMATIC', maxPlayers: 2 });

      const res = await api().post(`/sessions/${id}/join`).set(as('carlos')).expect(201);
      expect(res.body.status).toBe('ACCEPTED');

      const detail = await api().get(`/sessions/${id}`).set(as('carlos')).expect(200);
      expect(detail.body).toMatchObject({ status: 'FULL', spotsLeft: 0, myStatus: 'ACCEPTED', joinInfo: 'Sala ABC' });

      await api().post(`/sessions/${id}/join`).set(as('laura')).expect(409);
      await api().post(`/sessions/${id}/join`).set(as('carlos')).expect(409);
      await api().post(`/sessions/${id}/join`).set(as('maria')).expect(409);

      await api().delete(`/sessions/${id}/leave`).set(as('carlos')).expect(204);
      const after = await api().get(`/sessions/${id}`).set(as('maria')).expect(200);
      expect(after.body).toMatchObject({ status: 'OPEN', spotsLeft: 1 });

      await api().post(`/sessions/${id}/join`).set(as('carlos')).expect(201);
    });

    it('no permite ocupar más puestos de los que hay aunque todos pulsen "Unirme" a la vez', async () => {
      const id = await createSession({ joinMode: 'AUTOMATIC', maxPlayers: 3 });
      const contenders: Name[] = ['carlos', 'laura', 'pedro', 'ana', 'luis'];

      const results = await Promise.all(
        contenders.map((who) => api().post(`/sessions/${id}/join`).set(as(who))),
      );
      const codes = results.map((r) => r.status).sort();
      expect(codes.filter((c) => c === 201)).toHaveLength(2);
      expect(codes.filter((c) => c === 409)).toHaveLength(3);

      const accepted = await prisma.sessionMember.count({ where: { sessionId: id, status: 'ACCEPTED' } });
      expect(accepted).toBe(3);
    });
  });

  describe('aprobación manual', () => {
    let id: string;

    it('deja la solicitud pendiente y solo el creador la ve', async () => {
      id = await createSession({ joinMode: 'MANUAL' });

      const res = await api().post(`/sessions/${id}/join`).set(as('laura')).expect(201);
      expect(res.body.status).toBe('PENDING');
      await api().post(`/sessions/${id}/join`).set(as('pedro')).expect(201);

      const asLaura = await api().get(`/sessions/${id}`).set(as('laura')).expect(200);
      expect(asLaura.body).toMatchObject({ myStatus: 'PENDING', playersCount: 1 });
      expect(asLaura.body.joinInfo).toBeUndefined();
      expect(asLaura.body.pendingRequests).toBeUndefined();

      const asMaria = await api().get(`/sessions/${id}`).set(as('maria')).expect(200);
      expect(asMaria.body.pendingRequests.map((m: any) => m.user.id).sort()).toEqual(
        [users.laura.id, users.pedro.id].sort(),
      );
    });

    it('el creador acepta o rechaza; nadie más puede', async () => {
      await api().post(`/sessions/${id}/members/${users.laura.id}/accept`).set(as('pedro')).expect(403);

      const accepted = await api().post(`/sessions/${id}/members/${users.laura.id}/accept`).set(as('maria')).expect(200);
      expect(accepted.body.status).toBe('ACCEPTED');
      const asLaura = await api().get(`/sessions/${id}`).set(as('laura')).expect(200);
      expect(asLaura.body.joinInfo).toBe('Sala ABC');

      await api().post(`/sessions/${id}/members/${users.pedro.id}/reject`).set(as('maria')).expect(204);
      await api().post(`/sessions/${id}/join`).set(as('pedro')).expect(403);
      await api().post(`/sessions/${id}/members/${users.ana.id}/accept`).set(as('maria')).expect(404);
    });

    it('el creador no puede salir y la expulsión es definitiva', async () => {
      await api().delete(`/sessions/${id}/leave`).set(as('maria')).expect(400);
      await api().delete(`/sessions/${id}/members/${users.maria.id}`).set(as('maria')).expect(400);

      await api().delete(`/sessions/${id}/members/${users.laura.id}`).set(as('maria')).expect(204);
      await api().post(`/sessions/${id}/join`).set(as('laura')).expect(403);
      await api().delete(`/sessions/${id}/leave`).set(as('laura')).expect(404);
    });

    it('una sesión cancelada no admite nuevos jugadores', async () => {
      await api().post(`/sessions/${id}/cancel`).set(as('maria')).expect(200);
      await api().post(`/sessions/${id}/join`).set(as('ana')).expect(409);
    });
  });

  describe('chat de texto', () => {
    let id: string;
    let maria: Socket;
    let carlos: Socket;

    beforeAll(async () => {
      id = await createSession({ joinMode: 'AUTOMATIC' });
      await api().post(`/sessions/${id}/join`).set(as('carlos')).expect(201);
      maria = await connect(users.maria.token);
      carlos = await connect(users.carlos.token);
    });

    it('rechaza conexiones sin token válido', async () => {
      const socket = io(`${baseUrl}/chat`, { auth: { token: 'basura' }, transports: ['websocket'], reconnection: false });
      sockets.push(socket);
      const err = await nextEvent<Error>(socket, 'connect_error');
      expect(err.message).toBe('Token inválido o expirado');
      expect(socket.connected).toBe(false);
    });

    it('solo los miembros aceptados entran a la sala', async () => {
      expect(await maria.emitWithAck('session:join', { sessionId: id })).toEqual({ ok: true });
      expect(await carlos.emitWithAck('session:join', { sessionId: id })).toEqual({ ok: true });

      const outsider = await connect(users.luis.token);
      expect(await outsider.emitWithAck('session:join', { sessionId: id })).toEqual({
        ok: false,
        error: 'No eres miembro de esta sesión',
      });
      expect((await outsider.emitWithAck('session:join', { sessionId: 'x' })).ok).toBe(false);
    });

    it('entrega los mensajes en tiempo real y los guarda en el historial', async () => {
      const received = nextEvent(maria, 'message:new');
      const ack = await carlos.emitWithAck('message:send', { sessionId: id, content: '  ¿Ya están listos?  ' });
      expect(ack).toMatchObject({ ok: true, data: { content: '¿Ya están listos?' } });

      const msg = await received;
      expect(msg).toMatchObject({ content: '¿Ya están listos?', sender: { id: users.carlos.id } });

      await maria.emitWithAck('message:send', { sessionId: id, content: 'Sí, entro en 2 minutos.' });

      const history = await api().get(`/sessions/${id}/messages`).set(as('carlos')).expect(200);
      expect(history.body.map((m: any) => m.content)).toEqual(['¿Ya están listos?', 'Sí, entro en 2 minutos.']);

      const older = await api()
        .get(`/sessions/${id}/messages?before=${encodeURIComponent(history.body[1].createdAt)}`)
        .set(as('carlos'))
        .expect(200);
      expect(older.body).toHaveLength(1);

      await api().get(`/sessions/${id}/messages`).set(as('luis')).expect(403);
    });

    it('valida el contenido y limita el spam', async () => {
      expect((await carlos.emitWithAck('message:send', { sessionId: id, content: '   ' })).ok).toBe(false);
      expect((await carlos.emitWithAck('message:send', { sessionId: id, content: 'x'.repeat(2001) })).ok).toBe(false);

      const spammer = await connect(users.carlos.token);
      const acks = [];
      for (let i = 0; i < 7; i++) {
        acks.push(await spammer.emitWithAck('message:send', { sessionId: id, content: `spam ${i}` }));
      }
      expect(acks.filter((a) => !a.ok).map((a) => a.error)).toContain('Vas demasiado rápido, espera un momento');
    });

    it('reenvía el indicador de "escribiendo" a los demás', async () => {
      const typing = nextEvent(maria, 'typing');
      carlos.emit('typing', { sessionId: id });
      expect(await typing).toEqual({ sessionId: id, userId: users.carlos.id });
    });

    it('un expulsado sale de la sala y deja de poder escribir', async () => {
      const removed = nextEvent(carlos, 'session:removed');
      const left = nextEvent(maria, 'member:left');
      await api().delete(`/sessions/${id}/members/${users.carlos.id}`).set(as('maria')).expect(204);

      expect(await removed).toEqual({ sessionId: id });
      expect(await left).toMatchObject({ userId: users.carlos.id, reason: 'kicked' });

      const ack = await carlos.emitWithAck('message:send', { sessionId: id, content: 'sigo aquí' });
      expect(ack).toEqual({ ok: false, error: 'No eres miembro de esta sesión' });
    });

    it('avisa de la cancelación y bloquea nuevos mensajes', async () => {
      const cancelled = nextEvent(maria, 'session:cancelled');
      await api().post(`/sessions/${id}/cancel`).set(as('maria')).expect(200);
      expect(await cancelled).toEqual({ sessionId: id });

      const ack = await maria.emitWithAck('message:send', { sessionId: id, content: 'hola?' });
      expect(ack).toEqual({ ok: false, error: 'La sesión está cancelada' });
    });
  });
});
