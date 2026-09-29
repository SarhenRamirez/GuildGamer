import { vi } from 'vitest';
import { bootstrap } from './helpers.js';

const COVER = 'https://media.rawg.io/media/games/portada.jpg';

describe('Portadas reales desde RAWG (e2e)', () => {
  let t: Awaited<ReturnType<typeof bootstrap<'admin'>>>;
  const realFetch = globalThis.fetch;
  const rawgCalls: string[] = [];
  const names: string[] = [];

  beforeAll(async () => {
    t = await bootstrap(['admin'] as const);
    await t.prisma.user.update({ where: { id: t.users.admin.id }, data: { role: 'ADMIN' } });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (!url.startsWith('https://api.rawg.io/')) return realFetch(input, init);
      rawgCalls.push(url);
      const hit = names.some((n) => url.includes(`/games/${n.toLowerCase()}?`));
      if (hit) return Response.json({ background_image: COVER });
      if (url.includes('/games?')) return Response.json({ results: [] });
      return new Response('{}', { status: 404 });
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    delete process.env.RAWG_API_KEY;
    await t.prisma.game.deleteMany({ where: { name: { in: names } } });
    await t.cleanup();
  });

  const createGame = async (suffix: string) => {
    const name = `Rawg${suffix}${Date.now().toString(36)}`;
    names.push(name);
    const res = await t.api().post('/games').set(t.as('admin')).send({ name, genre: 'Shooter', platforms: ['PC'] }).expect(201);
    return res.body;
  };

  it('sin RAWG_API_KEY no consulta RAWG y avisa al sincronizar', async () => {
    const game = await createGame('a');
    expect(game.coverUrl).toBeNull();
    const res = await t.api().post('/games/covers/sync').set(t.as('admin')).expect(503);
    expect(res.body.message).toMatch(/RAWG_API_KEY/);
    expect(rawgCalls).toHaveLength(0);
  });

  it('con la clave, sincronizar llena las portadas que faltan', async () => {
    process.env.RAWG_API_KEY = 'clave-de-prueba';
    const res = await t.api().post('/games/covers/sync').set(t.as('admin')).expect(200);
    expect(res.body.updated).toBeGreaterThanOrEqual(1);
    const game = await t.prisma.game.findUniqueOrThrow({ where: { name: names[0] } });
    expect(game.coverUrl).toBe(COVER);
    expect(rawgCalls.every((u) => u.includes('key=clave-de-prueba'))).toBe(true);
  });

  it('al crear un juego trae su portada automáticamente', async () => {
    const game = await createGame('b');
    expect(game.coverUrl).toBe(COVER);
  });

  it('solo un admin puede sincronizar', async () => {
    const other = await t.api().post('/auth/register').send({
      email: `cov_${Date.now()}@test.gz`, username: `cov_${Date.now().toString(36)}`, password: 'supersecreta1',
    }).expect(201);
    await t.api().post('/games/covers/sync').set({ Authorization: `Bearer ${other.body.accessToken}` }).expect(403);
    await t.prisma.user.delete({ where: { id: other.body.user.id } });
  });
});
