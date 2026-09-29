import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { setupApp } from './../src/setup-app.js';

describe('Juegos y sesiones (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const tokens: Record<'maria' | 'carlos' | 'admin', string> = { maria: '', carlos: '', admin: '' };
  let fortniteId: string;
  let lolId: string;
  let sessionId: string;

  const api = () => request(app.getHttpServer());
  const as = (who: keyof typeof tokens) => ({ Authorization: `Bearer ${tokens[who]}` });
  const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    for (const name of Object.keys(tokens) as (keyof typeof tokens)[]) {
      const res = await api()
        .post('/auth/register')
        .send({ email: `${name}_${run}@test.gz`, username: `${name}_${run}`, password: 'supersecreta1' })
        .expect(201);
      tokens[name] = res.body.accessToken;
    }
    await prisma.user.update({ where: { email: `admin_${run}@test.gz` }, data: { role: 'ADMIN' } });

    fortniteId = (await prisma.game.findUniqueOrThrow({ where: { slug: 'fortnite' } })).id;
    lolId = (await prisma.game.findUniqueOrThrow({ where: { slug: 'league-of-legends' } })).id;
  });

  afterAll(async () => {
    await prisma.gameSession.deleteMany({ where: { creator: { email: { endsWith: `${run}@test.gz` } } } });
    await prisma.game.deleteMany({ where: { name: { startsWith: `Juego ${run}` } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: `${run}@test.gz` } } });
    await app.close();
  });

  describe('catálogo de juegos', () => {
    it('es público y filtra por plataforma y búsqueda', async () => {
      const all = await api().get('/games').expect(200);
      expect(all.body.length).toBeGreaterThanOrEqual(10);

      const pcOnly = await api().get('/games?platform=MOBILE').expect(200);
      expect(pcOnly.body.every((g: { platforms: string[] }) => g.platforms.includes('MOBILE'))).toBe(true);
      expect(pcOnly.body.some((g: { slug: string }) => g.slug === 'league-of-legends')).toBe(false);

      const search = await api().get('/games?search=craft').expect(200);
      expect(search.body.map((g: { slug: string }) => g.slug)).toContain('minecraft');
    });

    it('se consulta por slug o id', async () => {
      const bySlug = await api().get('/games/fortnite').expect(200);
      expect(bySlug.body).toMatchObject({ id: fortniteId, playersCount: expect.any(Number) });
      await api().get(`/games/${fortniteId}`).expect(200);
      await api().get('/games/no-existe').expect(404);
    });

    it('solo un admin puede crear, editar y borrar juegos', async () => {
      const game = { name: `Juego ${run}`, genre: 'Indie', platforms: ['PC'] };
      await api().post('/games').send(game).expect(401);
      await api().post('/games').set(as('maria')).send(game).expect(403);

      const created = await api().post('/games').set(as('admin')).send(game).expect(201);
      expect(created.body.slug).toBe(`juego-${run}`);
      await api().post('/games').set(as('admin')).send(game).expect(409);

      await api().patch(`/games/${created.body.id}`).set(as('admin')).send({ genre: 'Puzzle' }).expect(200);
      await api().delete(`/games/${created.body.id}`).set(as('admin')).expect(204);
    });
  });

  describe('sesiones', () => {
    const base = () => ({
      title: 'Fortnite a las 8',
      gameId: fortniteId,
      platform: 'PC',
      maxPlayers: 4,
      skillLevel: 'INTERMEDIATE',
      language: 'es',
      micRequired: true,
      startsAt: inHours(3),
      joinInfo: 'Código de sala: ABC123',
    });

    it('crea una sesión con el creador como primer miembro', async () => {
      const res = await api().post('/sessions').set(as('maria')).send(base()).expect(201);
      expect(res.body).toMatchObject({
        status: 'OPEN',
        playersCount: 1,
        spotsLeft: 3,
        isCreator: true,
        myStatus: 'ACCEPTED',
        joinInfo: 'Código de sala: ABC123',
        pendingRequests: [],
        game: { slug: 'fortnite' },
      });
      expect(res.body.members).toHaveLength(1);
      sessionId = res.body.id;
    });

    it('valida juego, plataforma y horario', async () => {
      await api().post('/sessions').set(as('maria')).send({ ...base(), gameId: lolId, platform: 'XBOX' }).expect(400);
      await api().post('/sessions').set(as('maria')).send({ ...base(), startsAt: inHours(-1) }).expect(400);
      await api().post('/sessions').set(as('maria')).send({ ...base(), startsAt: inHours(24 * 90) }).expect(400);
      await api().post('/sessions').set(as('maria')).send({ ...base(), endsAt: inHours(1) }).expect(400);
      await api().post('/sessions').set(as('maria')).send({ ...base(), maxPlayers: 1 }).expect(400);
    });

    it('oculta joinInfo y las solicitudes a quien no es miembro', async () => {
      const res = await api().get(`/sessions/${sessionId}`).set(as('carlos')).expect(200);
      expect(res.body.joinInfo).toBeUndefined();
      expect(res.body.pendingRequests).toBeUndefined();
      expect(res.body).toMatchObject({ myStatus: null, isCreator: false });
    });

    it('busca con filtros combinados', async () => {
      const match = await api()
        .get(`/sessions?gameId=${fortniteId}&platform=PC&language=es&micRequired=true&limit=50`)
        .set(as('carlos'))
        .expect(200);
      expect(match.body.items.map((s: { id: string }) => s.id)).toContain(sessionId);
      expect(match.body.items[0].joinInfo).toBeUndefined();
      expect(match.body).toMatchObject({ page: 1, limit: 50 });

      const noMatch = await api()
        .get(`/sessions?gameId=${fortniteId}&platform=XBOX&search=${encodeURIComponent('a las 8')}`)
        .set(as('carlos'))
        .expect(200);
      expect(noMatch.body.items.map((s: { id: string }) => s.id)).not.toContain(sessionId);

      const tooLate = await api().get(`/sessions?to=${inHours(1)}&limit=50`).set(as('carlos')).expect(200);
      expect(tooLate.body.items.map((s: { id: string }) => s.id)).not.toContain(sessionId);

      await api().get('/sessions?limit=500').set(as('carlos')).expect(400);
    });

    it('solo el creador edita, sin cambiar juego ni plataforma', async () => {
      await api().patch(`/sessions/${sessionId}`).set(as('carlos')).send({ title: 'Mía' }).expect(403);
      await api().patch(`/sessions/${sessionId}`).set(as('maria')).send({ platform: 'XBOX' }).expect(400);

      const res = await api()
        .patch(`/sessions/${sessionId}`)
        .set(as('maria'))
        .send({ maxPlayers: 1 })
        .expect(400);
      expect(res.body.message).toBeDefined();

      const updated = await api()
        .patch(`/sessions/${sessionId}`)
        .set(as('maria'))
        .send({ title: 'Fortnite a las 9', startsAt: inHours(4), maxPlayers: 5 })
        .expect(200);
      expect(updated.body).toMatchObject({ title: 'Fortnite a las 9', spotsLeft: 4 });
    });

    it('cancelar deja la sesión inmutable y fuera de la búsqueda por defecto', async () => {
      await api().post(`/sessions/${sessionId}/cancel`).set(as('carlos')).expect(403);
      const res = await api().post(`/sessions/${sessionId}/cancel`).set(as('maria')).expect(200);
      expect(res.body.status).toBe('CANCELLED');

      await api().patch(`/sessions/${sessionId}`).set(as('maria')).send({ title: 'Otra vez' }).expect(409);
      await api().post(`/sessions/${sessionId}/cancel`).set(as('maria')).expect(409);

      const list = await api().get('/sessions?limit=50').set(as('carlos')).expect(200);
      expect(list.body.items.map((s: { id: string }) => s.id)).not.toContain(sessionId);
    });
  });
});
