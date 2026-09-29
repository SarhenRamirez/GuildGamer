import { bootstrap, inMinutes } from './helpers.js';

describe('Rango y rol por juego, tipos de publicación y actividad de amigos (e2e)', () => {
  let t: Awaited<ReturnType<typeof bootstrap<'sova' | 'jett'>>>;
  let valorantId: string;

  beforeAll(async () => {
    t = await bootstrap(['sova', 'jett'] as const);
    valorantId = (await t.prisma.game.findUniqueOrThrow({ where: { slug: 'valorant' } })).id;
  });
  afterAll(() => t.cleanup());

  it('guarda rango y rol por juego, y se pueden borrar', async () => {
    const res = await t.api().put('/users/me/games').set(t.as('sova'))
      .send({ gameId: valorantId, platform: 'PC', rank: '  Ascendant 2 ', role: 'Iniciador / Sova' }).expect(200);
    expect(res.body).toMatchObject({ rank: 'Ascendant 2', role: 'Iniciador / Sova' });

    await t.api().put('/users/me/games').set(t.as('sova')).send({ gameId: valorantId, platform: 'PC', rank: 'x'.repeat(41) }).expect(400);

    const cleared = await t.api().put('/users/me/games').set(t.as('sova')).send({ gameId: valorantId, platform: 'PC', role: '' }).expect(200);
    expect(cleared.body).toMatchObject({ rank: 'Ascendant 2', role: null });
    await t.api().put('/users/me/games').set(t.as('sova')).send({ gameId: valorantId, platform: 'PC', role: 'Iniciador / Sova' }).expect(200);
  });

  it('el detalle de la sesión muestra el rango y rol de cada miembro en ese juego', async () => {
    const s = await t.api().post('/sessions').set(t.as('sova')).send({
      title: 'Ranked 5v5', gameId: valorantId, platform: 'PC', maxPlayers: 5, skillLevel: 'ADVANCED',
      startsAt: inMinutes(60).toISOString(), joinMode: 'AUTOMATIC',
    }).expect(201);
    await t.api().post(`/sessions/${s.body.id}/join`).set(t.as('jett')).expect(201);

    const detail = await t.api().get(`/sessions/${s.body.id}`).set(t.as('jett')).expect(200);
    const byName = Object.fromEntries(detail.body.members.map((m: any) => [m.user.username, m]));
    expect(byName[t.users.sova.username].gameProfile).toMatchObject({ rank: 'Ascendant 2', role: 'Iniciador / Sova' });
    expect(byName[t.users.jett.username].gameProfile).toBeNull();
    expect(byName[t.users.sova.username].user.availability).toEqual(expect.any(String));

    const f = await t.api().post('/friends/request').set(t.as('sova')).send({ userId: t.users.jett.id }).expect(201);
    await t.api().post(`/friends/requests/${f.body.id}/accept`).set(t.as('jett')).expect(200);

    const before = await t.api().get('/friends').set(t.as('jett')).expect(200);
    expect(before.body[0].playing).toBeNull();

    await t.prisma.gameSession.update({ where: { id: s.body.id }, data: { status: 'IN_PROGRESS' } });
    const during = await t.api().get('/friends').set(t.as('jett')).expect(200);
    expect(during.body[0].playing).toEqual({ sessionId: s.body.id, title: 'Ranked 5v5', kind: 'CASUAL', game: 'Valorant' });
  });

  it('las publicaciones llevan tipo y juego, con el rango del autor, y se filtran', async () => {
    const clip = await t.api().post('/posts').set(t.as('sova'))
      .send({ content: `Clutch 1v4 ${t.run}`, kind: 'CLIP', gameId: valorantId }).expect(201);
    expect(clip.body).toMatchObject({ kind: 'CLIP', game: { slug: 'valorant' }, authorRank: 'Ascendant 2' });
    expect(clip.body.author.games).toBeUndefined();

    const plain = await t.api().post('/posts').set(t.as('jett')).send({ content: `Hola ${t.run}` }).expect(201);
    expect(plain.body).toMatchObject({ kind: 'GENERAL', game: null, authorRank: null });

    await t.api().post('/posts').set(t.as('sova')).send({ content: 'x', kind: 'MEME' }).expect(400);
    await t.api().post('/posts').set(t.as('sova')).send({ content: 'x', gameId: t.users.sova.id }).expect(400);

    const clips = await t.api().get(`/posts?kind=CLIP&authorId=${t.users.sova.id}`).set(t.as('jett')).expect(200);
    expect(clips.body.map((p: any) => p.id)).toEqual([clip.body.id]);
    const byGame = await t.api().get(`/posts?gameId=${valorantId}&authorId=${t.users.jett.id}`).set(t.as('jett')).expect(200);
    expect(byGame.body).toEqual([]);
  });
});
