import type { Socket } from 'socket.io-client';
import { GoogleVerifier } from '../src/auth/google-verifier.js';
import { PaymentsService } from '../src/payments/payments.service.js';
import { bootstrap, inMinutes, nextEvent } from './helpers.js';

type Name = 'pro' | 'free' | 'mod' | 'amigo' | 'extra';

describe('Premium, admin, voz y login con Google (e2e)', () => {
  let t: Awaited<ReturnType<typeof bootstrap<Name>>>;
  let fortniteId: string;
  let minecraftId: string;

  const session = (who: Name, extra: Record<string, unknown> = {}) =>
    t.api().post('/sessions').set(t.as(who)).send({
      title: `Sesión ${t.run}`, gameId: fortniteId, platform: 'PC', maxPlayers: 4,
      skillLevel: 'INTERMEDIATE', startsAt: inMinutes(90).toISOString(), ...extra,
    });

  beforeAll(async () => {
    t = await bootstrap(['pro', 'free', 'mod', 'amigo', 'extra'] as const);
    await t.prisma.user.update({ where: { id: t.users.mod.id }, data: { role: 'ADMIN' } });
    fortniteId = (await t.prisma.game.findUniqueOrThrow({ where: { slug: 'fortnite' } })).id;
    minecraftId = (await t.prisma.game.findUniqueOrThrow({ where: { slug: 'minecraft' } })).id;
  });
  afterAll(() => t.cleanup());

  describe('Premium con la pasarela simulada', () => {
    it('muestra el plan y sus ventajas sin iniciar sesión', async () => {
      const res = await t.api().get('/payments/plans').expect(200);
      expect(res.body).toMatchObject({ provider: 'mock', premium: { priceCents: expect.any(Number), features: expect.any(Array) } });
    });

    it('sin Premium, las funciones Premium están bloqueadas', async () => {
      await t.api().get('/users/me/stats').set(t.as('pro')).expect(403);
      await session('pro', { kind: 'TOURNAMENT', maxPlayers: 50 }).expect(403);
      await t.api().patch(`/users/${t.users.pro.id}`).set(t.as('pro')).send({ accentColor: '#ff00aa' }).expect(403);
      await session('pro', { maxPlayers: 17 }).expect(400);
    });

    it('un pago fallido no activa nada; uno correcto sí', async () => {
      const first = await t.api().post('/payments/checkout').set(t.as('pro')).expect(201);
      expect(first.body.checkoutUrl).toContain(`/premium/checkout/${first.body.paymentId}`);
      await t.api().post(`/payments/${first.body.paymentId}/simulate`).set(t.as('free')).send({ outcome: 'success' }).expect(404);
      const failed = await t.api().post(`/payments/${first.body.paymentId}/simulate`).set(t.as('pro')).send({ outcome: 'failure' }).expect(200);
      expect(failed.body.isPremium).toBe(false);
      await t.api().post(`/payments/${first.body.paymentId}/simulate`).set(t.as('pro')).send({ outcome: 'success' }).expect(409);

      const second = await t.api().post('/payments/checkout').set(t.as('pro')).expect(201);
      const ok = await t.api().post(`/payments/${second.body.paymentId}/simulate`).set(t.as('pro')).send({ outcome: 'success' }).expect(200);
      expect(ok.body).toMatchObject({ isPremium: true, subscription: { plan: 'PREMIUM', status: 'ACTIVE' } });
      expect(ok.body.payments.map((p: any) => p.status).sort()).toEqual(['FAILED', 'SUCCEEDED']);

      const notes = (await t.api().get('/notifications').set(t.as('pro')).expect(200)).body;
      expect(notes.some((n: any) => n.type === 'PREMIUM_ACTIVATED')).toBe(true);
      await t.api().post('/payments/checkout').set(t.as('pro')).expect(409);
    });

    it('con Premium: torneos, personalización, estadísticas y perfil destacado', async () => {
      const tournament = await session('pro', { kind: 'TOURNAMENT', maxPlayers: 64 }).expect(201);
      expect(tournament.body.kind).toBe('TOURNAMENT');

      const profile = await t.api().patch(`/users/${t.users.pro.id}`).set(t.as('pro')).send({ accentColor: '#ff00aa', bannerUrl: 'https://cdn.example.com/b.png' }).expect(200);
      expect(profile.body).toMatchObject({ accentColor: '#ff00aa', isPremium: true });

      const stats = await t.api().get('/users/me/stats').set(t.as('pro')).expect(200);
      expect(stats.body).toMatchObject({ sessionsCreated: 1, totalHours: 0, byGame: [] });

      const search = await t.api().get(`/users?search=_${t.run}`.slice(0, 60)).set(t.as('free')).expect(200);
      expect(search.body.items[0]).toMatchObject({ id: t.users.pro.id, isPremium: true });
      expect(search.body.items.every((u: any) => u.email === undefined)).toBe(true);
    });

    it('cancelar mantiene Premium hasta final de periodo; al caducar se pierde', async () => {
      const cancelled = await t.api().post('/payments/cancel').set(t.as('pro')).expect(200);
      expect(cancelled.body).toMatchObject({ isPremium: true, subscription: { status: 'CANCELLED' } });

      await t.prisma.subscription.update({ where: { userId: t.users.pro.id }, data: { currentPeriodEnd: inMinutes(-1) } });
      await t.app.get(PaymentsService).expireSubscriptions();
      const after = await t.api().get('/payments/subscription').set(t.as('pro')).expect(200);
      expect(after.body).toMatchObject({ isPremium: false, subscription: { plan: 'FREE', status: 'EXPIRED' } });
    });
  });

  describe('búsqueda de jugadores y recomendaciones', () => {
    it('filtra por juego, plataforma e idioma', async () => {
      await t.api().put('/users/me/games').set(t.as('amigo')).send({ gameId: minecraftId, platform: 'PC' }).expect(200);
      await t.api().patch(`/users/${t.users.amigo.id}`).set(t.as('amigo')).send({ languages: ['es'], availability: 'AVAILABLE' }).expect(200);

      const hit = await t.api().get(`/users?gameId=${minecraftId}&platform=PC&language=es&availability=AVAILABLE&limit=50`).set(t.as('free')).expect(200);
      expect(hit.body.items.map((u: any) => u.id)).toContain(t.users.amigo.id);
      const miss = await t.api().get(`/users?gameId=${minecraftId}&platform=XBOX&limit=50`).set(t.as('free')).expect(200);
      expect(miss.body.items.map((u: any) => u.id)).not.toContain(t.users.amigo.id);
    });

    it('recomienda sesiones de mis juegos y plataformas, no las mías', async () => {
      await t.api().put('/users/me/games').set(t.as('free')).send({ gameId: fortniteId, platform: 'PC', skillLevel: 'INTERMEDIATE' }).expect(200);
      const mine = await session('free').expect(201);
      const good = await session('extra').expect(201);
      const otherPlatform = await session('extra', { platform: 'XBOX' }).expect(201);

      const rec = await t.api().get('/sessions/recommended').set(t.as('free')).expect(200);
      const ids = rec.body.map((s: any) => s.id);
      expect(ids).toContain(good.body.id);
      expect(ids).not.toContain(mine.body.id);
      expect(ids).not.toContain(otherPlatform.body.id);
      expect(rec.body[0].matchScore).toEqual(expect.any(Number));
    });
  });

  describe('chat de voz (señalización WebRTC)', () => {
    let sessionId: string;
    let a: Socket;
    let b: Socket;

    beforeAll(async () => {
      sessionId = (await session('free', { joinMode: 'AUTOMATIC' }).expect(201)).body.id;
      await t.api().post(`/sessions/${sessionId}/join`).set(t.as('extra')).expect(201);
      a = await t.connect('/voice', 'free');
      b = await t.connect('/voice', 'extra');
    });

    it('da los servidores ICE', async () => {
      const res = await t.api().get('/voice/ice-servers').set(t.as('free')).expect(200);
      expect(res.body.iceServers[0].urls[0]).toMatch(/^stun:/);
    });

    it('presenta a los participantes y reenvía la señalización solo dentro del canal', async () => {
      const first = await a.emitWithAck('voice:join', { sessionId });
      expect(first).toMatchObject({ ok: true, data: { peers: [], self: { userId: t.users.free.id, muted: false } } });

      const joinedEvt = nextEvent(a, 'voice:peer-joined');
      const second = await b.emitWithAck('voice:join', { sessionId });
      expect(second.data.peers.map((p: any) => p.socketId)).toEqual([a.id]);
      expect(await joinedEvt).toMatchObject({ socketId: b.id, userId: t.users.extra.id });

      const offer = nextEvent(a, 'voice:signal');
      expect(await b.emitWithAck('voice:signal', { to: a.id, data: { type: 'offer', sdp: 'v=0…' } })).toEqual({ ok: true });
      expect(await offer).toEqual({ from: b.id, data: { type: 'offer', sdp: 'v=0…' } });

      expect((await b.emitWithAck('voice:signal', { to: 'socket-ajeno', data: {} })).ok).toBe(false);

      const stateEvt = nextEvent(a, 'voice:state');
      await b.emitWithAck('voice:state', { deafened: true });
      expect(await stateEvt).toMatchObject({ socketId: b.id, deafened: true, muted: true });

      const participants = await t.api().get(`/voice/sessions/${sessionId}/participants`).set(t.as('free')).expect(200);
      expect(participants.body).toHaveLength(2);
    });

    it('rechaza a quien no es miembro', async () => {
      const outsider = await t.connect('/voice', 'amigo');
      expect(await outsider.emitWithAck('voice:join', { sessionId })).toEqual({ ok: false, error: 'No eres miembro de esta sesión' });
    });

    it('al expulsar a un miembro sale también del canal de voz', async () => {
      const closed = nextEvent(b, 'voice:closed');
      const left = nextEvent(a, 'voice:peer-left');
      await t.api().delete(`/sessions/${sessionId}/members/${t.users.extra.id}`).set(t.as('free')).expect(204);
      expect(await closed).toEqual({ sessionId, reason: 'removed' });
      expect(await left).toMatchObject({ userId: t.users.extra.id });
    });

    it('al cancelar la sesión se cierra el canal', async () => {
      const closed = nextEvent(a, 'voice:closed');
      await t.api().post(`/sessions/${sessionId}/cancel`).set(t.as('free')).expect(200);
      expect(await closed).toEqual({ sessionId, reason: 'ended' });
      const again = await a.emitWithAck('voice:join', { sessionId });
      expect(again).toEqual({ ok: false, error: 'El canal de voz de esta sesión está cerrado' });
    });

    it('salas de voz persistentes: solo el dueño y sus amigos', async () => {
      const room = await t.api().post('/voice/rooms').set(t.as('free')).send({ name: 'Los de siempre' }).expect(201);
      const f = await t.api().post('/friends/request').set(t.as('free')).send({ userId: t.users.amigo.id }).expect(201);
      await t.api().post(`/friends/requests/${f.body.id}/accept`).set(t.as('amigo')).expect(200);

      const friendSocket = await t.connect('/voice', 'amigo');
      expect((await friendSocket.emitWithAck('voice:join', { roomId: room.body.id })).ok).toBe(true);
      const stranger = await t.connect('/voice', 'pro');
      expect(await stranger.emitWithAck('voice:join', { roomId: room.body.id })).toEqual({
        ok: false,
        error: 'Solo el dueño y sus amigos pueden entrar',
      });

      const rooms = await t.api().get('/voice/rooms').set(t.as('amigo')).expect(200);
      expect(rooms.body.find((r: any) => r.id === room.body.id).participants).toHaveLength(1);
      await t.api().delete(`/voice/rooms/${room.body.id}`).set(t.as('amigo')).expect(404);
      await t.api().delete(`/voice/rooms/${room.body.id}`).set(t.as('free')).expect(204);
    });
  });

  describe('panel de administrador', () => {
    it('solo accesible para admins', async () => {
      await t.api().get('/admin/stats').set(t.as('free')).expect(403);
      const stats = await t.api().get('/admin/stats').set(t.as('mod')).expect(200);
      expect(stats.body).toMatchObject({
        users: { total: expect.any(Number), banned: expect.any(Number) },
        sessions: { byStatus: expect.any(Object) },
        openReports: expect.any(Number),
      });
      expect(stats.body.topGames.length).toBeGreaterThan(0);
    });

    it('lista usuarios, cambia roles y no deja tocarse a uno mismo', async () => {
      const list = await t.api().get(`/admin/users?search=${t.users.free.username}`).set(t.as('mod')).expect(200);
      expect(list.body.items[0]).toMatchObject({ id: t.users.free.id, email: expect.stringContaining('@test.gz') });
      await t.api().patch(`/admin/users/${t.users.mod.id}`).set(t.as('mod')).send({ role: 'USER' }).expect(400);

      const sessions = await t.api().get('/admin/sessions?status=CANCELLED').set(t.as('mod')).expect(200);
      expect(sessions.body.items.length).toBeGreaterThan(0);
    });

    it('banear corta sus conexiones en vivo y su acceso', async () => {
      const chat = await t.connect('/chat', 'extra');
      const gone = nextEvent(chat, 'disconnect');
      await t.api().patch(`/admin/users/${t.users.extra.id}`).set(t.as('mod')).send({ isBanned: true }).expect(200);
      await gone;
      await t.api().get('/users/me').set(t.as('extra')).expect(401);
    });

    it('gestiona reportes y avisa a quien reportó', async () => {
      const r = await t.api().post('/reports').set(t.as('free')).send({ reason: 'FAKE_ACCOUNT', targetUserId: t.users.extra.id }).expect(201);
      const queue = await t.api().get('/admin/reports?status=OPEN&limit=100').set(t.as('mod')).expect(200);
      expect(queue.body.items.find((i: any) => i.id === r.body.id)).toMatchObject({ targetUser: { id: t.users.extra.id, isBanned: true } });

      await t.api().patch(`/admin/reports/${r.body.id}`).set(t.as('free')).send({ status: 'RESOLVED' }).expect(403);
      const done = await t.api().patch(`/admin/reports/${r.body.id}`).set(t.as('mod')).send({ status: 'RESOLVED', resolutionNote: 'Cuenta baneada' }).expect(200);
      expect(done.body).toMatchObject({ status: 'RESOLVED', resolvedBy: { id: t.users.mod.id } });

      const notes = (await t.api().get('/notifications').set(t.as('free')).expect(200)).body;
      expect(notes.some((n: any) => n.title === 'Hemos revisado tu reporte')).toBe(true);
    });
  });

  describe('login con Google', () => {
    it('sin GOOGLE_CLIENT_ID está desactivado', async () => {
      const providers = await t.api().get('/auth/providers').expect(200);
      expect(providers.body.google).toBe(false);
      await t.api().post('/auth/google').send({ idToken: 'x' }).expect(503);
    });

    it('crea la cuenta, luego entra con ella, y vincula una cuenta existente por email', async () => {
      const verifier = t.app.get(GoogleVerifier);
      const original = verifier.verify.bind(verifier);
      const email = `google_${t.run}@test.gz`;
      verifier.verify = async () => ({ googleId: `g-${t.run}`, email, picture: 'https://lh3.example.com/a.png' });
      try {
        const first = await t.api().post('/auth/google').send({ idToken: 'token' }).expect(200);
        expect(first.body.user).toMatchObject({ email, authProvider: 'GOOGLE', avatarUrl: 'https://lh3.example.com/a.png' });
        expect(first.body.user.username).toMatch(/^google_/);

        const again = await t.api().post('/auth/google').send({ idToken: 'token' }).expect(200);
        expect(again.body.user.id).toBe(first.body.user.id);

        const existingEmail = (await t.prisma.user.findUniqueOrThrow({ where: { id: t.users.amigo.id } })).email;
        verifier.verify = async () => ({ googleId: `g2-${t.run}`, email: existingEmail });
        const linked = await t.api().post('/auth/google').send({ idToken: 'token' }).expect(200);
        expect(linked.body.user.id).toBe(t.users.amigo.id);
      } finally {
        verifier.verify = original;
      }
    });
  });
});
