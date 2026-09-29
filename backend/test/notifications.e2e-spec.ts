import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { SessionSchedulerService } from './../src/sessions/session-scheduler.service.js';
import { setupApp } from './../src/setup-app.js';

const NAMES = ['maria', 'carlos', 'laura'] as const;
type Name = (typeof NAMES)[number];

describe('Notificaciones y tareas programadas (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let scheduler: SessionSchedulerService;
  let baseUrl: string;
  let fortniteId: string;
  const run = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const users = {} as Record<Name, { id: string; token: string }>;
  const sockets: Socket[] = [];

  const api = () => request(app.getHttpServer());
  const as = (who: Name) => ({ Authorization: `Bearer ${users[who].token}` });
  const inMinutes = (m: number) => new Date(Date.now() + m * 60_000);

  const createSession = async (overrides: Record<string, unknown> = {}) => {
    const res = await api()
      .post('/sessions')
      .set(as('maria'))
      .send({
        title: `Partida ${run}`,
        gameId: fortniteId,
        platform: 'PC',
        maxPlayers: 4,
        skillLevel: 'INTERMEDIATE',
        startsAt: inMinutes(120).toISOString(),
        ...overrides,
      })
      .expect(201);
    return res.body.id as string;
  };

  const notificationsOf = async (who: Name, sessionId: string, type?: string) => {
    const res = await api().get('/notifications?limit=100').set(as(who)).expect(200);
    return (res.body as any[]).filter(
      (n) => n.data?.sessionId === sessionId && (!type || n.type === type),
    );
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.listen(0);
    baseUrl = `http://localhost:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);
    scheduler = app.get(SessionSchedulerService);

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

  describe('eventos de miembros', () => {
    let id: string;

    it('el creador recibe la solicitud en tiempo real y en su bandeja', async () => {
      id = await createSession({ joinMode: 'MANUAL' });

      const socket = io(`${baseUrl}/notifications`, {
        auth: { token: users.maria.token },
        transports: ['websocket'],
        reconnection: false,
      });
      sockets.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('connect_error', reject);
      });
      const pushed = new Promise<any>((resolve) => socket.once('notification:new', resolve));

      await api().post(`/sessions/${id}/join`).set(as('carlos')).expect(201);

      expect(await pushed).toMatchObject({
        type: 'JOIN_REQUEST',
        title: `carlos_${run} quiere unirse a "Partida ${run}" (Fortnite)`,
        readAt: null,
      });
      expect(await notificationsOf('maria', id, 'JOIN_REQUEST')).toHaveLength(1);
    });

    it('avisa al aceptar y al rechazar', async () => {
      await api().post(`/sessions/${id}/join`).set(as('laura')).expect(201);
      await api().post(`/sessions/${id}/members/${users.carlos.id}/accept`).set(as('maria')).expect(200);
      await api().post(`/sessions/${id}/members/${users.laura.id}/reject`).set(as('maria')).expect(204);

      expect(await notificationsOf('carlos', id, 'JOIN_ACCEPTED')).toHaveLength(1);
      expect(await notificationsOf('laura', id, 'JOIN_REJECTED')).toHaveLength(1);
    });

    it('avisa al creador cuando alguien sale', async () => {
      await api().delete(`/sessions/${id}/leave`).set(as('carlos')).expect(204);
      const [n] = await notificationsOf('maria', id, 'MEMBER_LEFT');
      expect(n.title).toBe(`carlos_${run} salió de "Partida ${run}" (Fortnite)`);
    });
  });

  describe('cambios en la sesión', () => {
    let id: string;

    beforeAll(async () => {
      id = await createSession({ joinMode: 'AUTOMATIC' });
      await api().post(`/sessions/${id}/join`).set(as('carlos')).expect(201);
    });

    it('el creador recibe MEMBER_JOINED en el ingreso automático', async () => {
      expect(await notificationsOf('maria', id, 'MEMBER_JOINED')).toHaveLength(1);
    });

    it('solo el cambio de horario genera aviso, y no al propio creador', async () => {
      await api().patch(`/sessions/${id}`).set(as('maria')).send({ title: `Partida ${run} v2` }).expect(200);
      expect(await notificationsOf('carlos', id, 'SESSION_UPDATED')).toHaveLength(0);

      await api().patch(`/sessions/${id}`).set(as('maria')).send({ startsAt: inMinutes(180).toISOString() }).expect(200);
      const [n] = await notificationsOf('carlos', id, 'SESSION_UPDATED');
      expect(n.data.startsAt).toEqual(expect.any(String));
      expect(await notificationsOf('maria', id, 'SESSION_UPDATED')).toHaveLength(0);
    });

    it('la cancelación llega a los miembros', async () => {
      await api().post(`/sessions/${id}/cancel`).set(as('maria')).expect(200);
      expect(await notificationsOf('carlos', id, 'SESSION_CANCELLED')).toHaveLength(1);
    });
  });

  describe('bandeja', () => {
    it('cuenta, marca como leídas y no deja tocar las ajenas', async () => {
      const before = await api().get('/notifications/unread-count').set(as('carlos')).expect(200);
      expect(before.body.count).toBeGreaterThan(0);

      const [first] = (await api().get('/notifications?unread=true').set(as('carlos')).expect(200)).body;
      await api().patch(`/notifications/${first.id}/read`).set(as('laura')).expect(404);
      await api().patch(`/notifications/${first.id}/read`).set(as('carlos')).expect(204);

      const after = await api().get('/notifications/unread-count').set(as('carlos')).expect(200);
      expect(after.body.count).toBe(before.body.count - 1);

      await api().post('/notifications/read-all').set(as('carlos')).expect(200);
      const none = await api().get('/notifications/unread-count').set(as('carlos')).expect(200);
      expect(none.body.count).toBe(0);
    });

    it('el canal en tiempo real exige token', async () => {
      const socket = io(`${baseUrl}/notifications`, { transports: ['websocket'], reconnection: false });
      sockets.push(socket);
      const err = await new Promise<Error>((resolve) => socket.once('connect_error', resolve));
      expect(err.message).toBe('Token requerido');
    });
  });

  describe('recordatorios', () => {
    it('avisa una sola vez a los miembros de las sesiones que empiezan en menos de 1 hora', async () => {
      const soon = await createSession({ joinMode: 'AUTOMATIC', startsAt: inMinutes(45).toISOString() });
      const later = await createSession({ joinMode: 'AUTOMATIC', startsAt: inMinutes(90).toISOString() });
      await api().post(`/sessions/${soon}/join`).set(as('carlos')).expect(201);
      await api().post(`/sessions/${later}/join`).set(as('carlos')).expect(201);

      await scheduler.sendReminders();
      await scheduler.sendReminders();

      const reminders = await notificationsOf('carlos', soon, 'SESSION_REMINDER');
      expect(reminders).toHaveLength(1);
      expect(reminders[0].title).toMatch(/^Tu sesión de Fortnite comienza en \d+ minutos$/);
      expect(await notificationsOf('maria', soon, 'SESSION_REMINDER')).toHaveLength(1);
      expect(await notificationsOf('carlos', later, 'SESSION_REMINDER')).toHaveLength(0);
    });

    it('si cambia la hora, el recordatorio se vuelve a enviar', async () => {
      const id = await createSession({ joinMode: 'AUTOMATIC', startsAt: inMinutes(30).toISOString() });
      await scheduler.sendReminders();
      await api().patch(`/sessions/${id}`).set(as('maria')).send({ startsAt: inMinutes(50).toISOString() }).expect(200);
      await scheduler.sendReminders();
      expect(await notificationsOf('maria', id, 'SESSION_REMINDER')).toHaveLength(2);
    });

    it('no recuerda sesiones canceladas', async () => {
      const id = await createSession({ startsAt: inMinutes(20).toISOString() });
      await api().post(`/sessions/${id}/cancel`).set(as('maria')).expect(200);
      await scheduler.sendReminders();
      expect(await notificationsOf('maria', id, 'SESSION_REMINDER')).toHaveLength(0);
    });
  });

  describe('estados automáticos', () => {
    const statusOf = async (id: string) =>
      (await prisma.gameSession.findUniqueOrThrow({ where: { id } })).status;

    it('pasa a IN_PROGRESS al empezar y a FINISHED al terminar', async () => {
      const noEnd = await createSession();
      const withEnd = await createSession({ endsAt: inMinutes(180).toISOString() });
      const cancelled = await createSession();
      await api().post(`/sessions/${cancelled}/cancel`).set(as('maria')).expect(200);

      await prisma.gameSession.updateMany({
        where: { id: { in: [noEnd, withEnd, cancelled] } },
        data: { startsAt: inMinutes(-10) },
      });
      await scheduler.updateStatuses();
      expect(await statusOf(noEnd)).toBe('IN_PROGRESS');
      expect(await statusOf(withEnd)).toBe('IN_PROGRESS');
      expect(await statusOf(cancelled)).toBe('CANCELLED');

      await prisma.gameSession.update({ where: { id: withEnd }, data: { endsAt: inMinutes(-1) } });
      await scheduler.updateStatuses();
      expect(await statusOf(withEnd)).toBe('FINISHED');
      expect(await statusOf(noEnd)).toBe('IN_PROGRESS');

      await prisma.gameSession.update({ where: { id: noEnd }, data: { startsAt: inMinutes(-181) } });
      await scheduler.updateStatuses();
      expect(await statusOf(noEnd)).toBe('FINISHED');
    });

    it('una sesión en curso ya no admite jugadores', async () => {
      const id = await createSession({ joinMode: 'AUTOMATIC' });
      await prisma.gameSession.update({ where: { id }, data: { startsAt: inMinutes(-5) } });
      await scheduler.updateStatuses();
      await api().post(`/sessions/${id}/join`).set(as('laura')).expect(409);
    });
  });
});
