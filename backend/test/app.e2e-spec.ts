import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';
import { setupApp } from './../src/setup-app.js';

describe('GameZone API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const alice = { email: `alice_${run}@test.gz`, username: `alice_${run}`, password: 'supersecreta1' };
  const bob = { email: `bob_${run}@test.gz`, username: `bob_${run}`, password: 'supersecreta2' };
  let aliceToken: string;
  let aliceId: string;
  let bobToken: string;

  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: `${run}@test.gz` } } });
    await app.close();
  });

  it('/health es pública', () => {
    return api().get('/health').expect(200).expect({ status: 'ok', database: 'up' });
  });

  describe('auth', () => {
    it('registra y devuelve token sin exponer el hash', async () => {
      const res = await api().post('/auth/register').send(alice).expect(201);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({ email: alice.email, username: alice.username });
      expect(res.body.user.passwordHash).toBeUndefined();
      aliceToken = res.body.accessToken;
      aliceId = res.body.user.id;

      bobToken = (await api().post('/auth/register').send(bob).expect(201)).body.accessToken;
    });

    it('rechaza email o usuario duplicado', async () => {
      await api().post('/auth/register').send({ ...alice, username: `otro_${run}` }).expect(409);
      await api()
        .post('/auth/register')
        .send({ ...alice, email: `x_${run}@test.gz`, username: alice.username.toUpperCase() })
        .expect(409);
    });

    it('dos registros simultáneos con el mismo email: uno entra y el otro recibe 409', async () => {
      const same = { email: `race_${run}@test.gz`, password: 'supersecreta1' };
      const results = await Promise.all(
        [1, 2, 3].map((i) => api().post('/auth/register').send({ ...same, username: `race${i}_${run}` })),
      );
      expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    });

    it('valida el cuerpo', async () => {
      await api().post('/auth/register').send({ email: 'no-es-email', username: 'a', password: '1' }).expect(400);
      await api().post('/auth/register').send({ ...alice, role: 'ADMIN' }).expect(400);
    });

    it('hace login con credenciales correctas y rechaza las incorrectas', async () => {
      await api().post('/auth/login').send({ email: alice.email.toUpperCase(), password: alice.password }).expect(200);
      await api().post('/auth/login').send({ email: alice.email, password: 'incorrecta' }).expect(401);
      await api().post('/auth/login').send({ email: `nadie_${run}@test.gz`, password: 'loquesea123' }).expect(401);
    });
  });

  describe('perfil', () => {
    it('exige token', async () => {
      await api().get('/users/me').expect(401);
      await api().get('/users/me').set('Authorization', 'Bearer basura').expect(401);
    });

    it('/users/me devuelve el perfil privado con reputación', async () => {
      const res = await api().get('/users/me').set('Authorization', `Bearer ${aliceToken}`).expect(200);
      expect(res.body).toMatchObject({
        id: aliceId,
        email: alice.email,
        games: [],
        reputation: { averageStars: null, reviewCount: 0 },
        stats: { sessionsPlayed: 0 },
      });
    });

    it('otro usuario ve el perfil sin email', async () => {
      const res = await api().get(`/users/${aliceId}`).set('Authorization', `Bearer ${bobToken}`).expect(200);
      expect(res.body.username).toBe(alice.username);
      expect(res.body.email).toBeUndefined();
    });

    it('edita el propio perfil pero no el ajeno', async () => {
      const res = await api()
        .patch(`/users/${aliceId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ bio: 'Main support', languages: ['es', 'en'], availability: 'AVAILABLE', skillLevel: 'INTERMEDIATE' })
        .expect(200);
      expect(res.body).toMatchObject({ bio: 'Main support', languages: ['es', 'en'], availability: 'AVAILABLE' });

      await api().patch(`/users/${aliceId}`).set('Authorization', `Bearer ${bobToken}`).send({ bio: 'hackeado' }).expect(403);
      await api().patch(`/users/${aliceId}`).set('Authorization', `Bearer ${aliceToken}`).send({ username: bob.username }).expect(409);
      await api().patch(`/users/${aliceId}`).set('Authorization', `Bearer ${aliceToken}`).send({ availability: 'DORMIDO' }).expect(400);
    });

    it('añade y quita juegos del perfil respetando las plataformas del juego', async () => {
      const auth = { Authorization: `Bearer ${aliceToken}` };
      const lol = await prisma.game.findUniqueOrThrow({ where: { slug: 'league-of-legends' } });

      const added = await api().put('/users/me/games').set(auth).send({ gameId: lol.id, platform: 'PC', gamerTag: 'Alice#LAN' }).expect(200);
      expect(added.body).toMatchObject({ platform: 'PC', gamerTag: 'Alice#LAN', game: { slug: 'league-of-legends' } });

      await api().put('/users/me/games').set(auth).send({ gameId: lol.id, platform: 'XBOX' }).expect(400);

      const me = await api().get('/users/me').set(auth).expect(200);
      expect(me.body.games).toHaveLength(1);

      await api().delete(`/users/me/games/${lol.id}/PC`).set(auth).expect(204);
      await api().delete(`/users/me/games/${lol.id}/PC`).set(auth).expect(404);
    });

    it('un usuario baneado pierde el acceso aunque tenga token', async () => {
      await prisma.user.update({ where: { id: aliceId }, data: { isBanned: true } });
      await api().get('/users/me').set('Authorization', `Bearer ${aliceToken}`).expect(401);
      await api().post('/auth/login').send({ email: alice.email, password: alice.password }).expect(401);
    });
  });
});
