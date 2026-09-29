import { bootstrap, inMinutes, nextEvent } from './helpers.js';

describe('Inicio: tema, juegos populares, jugadores en línea y actividad (e2e)', () => {
  let t: Awaited<ReturnType<typeof bootstrap<'luna' | 'tachi' | 'oculto'>>>;
  let minecraftId: string;

  beforeAll(async () => {
    t = await bootstrap(['luna', 'tachi', 'oculto'] as const);
    minecraftId = (await t.prisma.game.findUniqueOrThrow({ where: { slug: 'minecraft' } })).id;
  });
  afterAll(() => t.cleanup());

  it('el color de tema se guarda y solo acepta los permitidos', async () => {
    const me = await t.api().get('/users/me').set(t.as('luna')).expect(200);
    expect(me.body.theme).toBe('green');
    const res = await t.api().patch(`/users/${t.users.luna.id}`).set(t.as('luna')).send({ theme: 'blue' }).expect(200);
    expect(res.body.theme).toBe('blue');
    await t.api().patch(`/users/${t.users.luna.id}`).set(t.as('luna')).send({ theme: 'neon' }).expect(400);
    const other = await t.api().get(`/users/${t.users.luna.id}`).set(t.as('tachi')).expect(200);
    expect(other.body.theme).toBeUndefined();
  });

  it('juegos populares: primero los destacados y luego por sesiones abiertas', async () => {
    await t.api().post('/sessions').set(t.as('luna')).send({
      title: 'Survival', gameId: minecraftId, platform: 'PC', maxPlayers: 4, skillLevel: 'BEGINNER',
      startsAt: inMinutes(90).toISOString(), joinMode: 'AUTOMATIC',
    }).expect(201);
    const res = await t.api().get('/games/popular').expect(200);
    expect(res.body.slice(0, 6).map((g: any) => g.slug)).toEqual([
      'valorant', 'minecraft', 'fortnite', 'league-of-legends', 'call-of-duty-warzone', 'gta-v',
    ]);
    const mc = res.body.find((g: any) => g.slug === 'minecraft');
    expect(mc.openSessions).toBeGreaterThanOrEqual(1);
    const counts = res.body.slice(6).map((g: any) => g.openSessions);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  it('se puede elegir un avatar gamer de la app, pero no rutas arbitrarias', async () => {
    const res = await t.api().patch(`/users/${t.users.oculto.id}`).set(t.as('oculto')).send({ avatarUrl: '/avatars/ninja.svg' }).expect(200);
    expect(res.body.avatarUrl).toBe('/avatars/ninja.svg');
    await t.api().patch(`/users/${t.users.oculto.id}`).set(t.as('oculto')).send({ avatarUrl: '/avatars/../etc/passwd' }).expect(400);
    await t.api().patch(`/users/${t.users.oculto.id}`).set(t.as('oculto')).send({ avatarUrl: 'javascript:alert(1)' }).expect(400);
  });

  it('las sesiones listadas traen los avatares de quienes ya están dentro', async () => {
    const s = (await t.api().get(`/sessions?gameId=${minecraftId}&limit=50`).set(t.as('tachi')).expect(200)).body.items
      .find((x: any) => x.creator.id === t.users.luna.id);
    expect(s.previewMembers).toEqual([expect.objectContaining({ id: t.users.luna.id, username: t.users.luna.username })]);
  });

  it('jugadores en línea: solo conectados, sin uno mismo y respetando "No disponible"', async () => {
    const before = await t.api().get('/users/online').set(t.as('luna')).expect(200);
    expect(before.body.items.map((u: any) => u.id)).not.toContain(t.users.tachi.id);

    await t.api().patch(`/users/${t.users.oculto.id}`).set(t.as('oculto')).send({ availability: 'UNAVAILABLE' }).expect(200);
    await t.api().put('/users/me/games').set(t.as('tachi')).send({ gameId: minecraftId, platform: 'PC', isFavorite: true }).expect(200);
    const tachi = await t.connect('/notifications', 'tachi');
    await t.connect('/notifications', 'oculto');
    await t.connect('/notifications', 'luna');

    const during = await t.api().get('/users/online').set(t.as('luna')).expect(200);
    const ids = during.body.items.map((u: any) => u.id);
    expect(ids).toContain(t.users.tachi.id);
    expect(ids).not.toContain(t.users.oculto.id);
    expect(ids).not.toContain(t.users.luna.id);
    expect(during.body.items.find((u: any) => u.id === t.users.tachi.id)).toMatchObject({ status: 'online', game: 'Minecraft' });

    const gone = nextEvent(tachi, 'disconnect');
    tachi.disconnect();
    await gone.catch(() => undefined);
    await new Promise((r) => setTimeout(r, 200));
    const after = await t.api().get('/users/online').set(t.as('luna')).expect(200);
    expect(after.body.items.map((u: any) => u.id)).not.toContain(t.users.tachi.id);
  });

  it('las notificaciones incluyen a quien las causó', async () => {
    const f = await t.api().post('/friends/request').set(t.as('tachi')).send({ userId: t.users.luna.id }).expect(201);
    expect(f.body.status).toBe('PENDING');
    const notes = await t.api().get('/notifications').set(t.as('luna')).expect(200);
    const n = notes.body.find((x: any) => x.type === 'FRIEND_REQUEST');
    expect(n.actor).toEqual({ id: t.users.tachi.id, username: t.users.tachi.username, avatarUrl: null });
  });
});
