import type { Socket } from 'socket.io-client';
import { bootstrap, inMinutes, nextEvent } from './helpers.js';

describe('Comunidad (e2e)', () => {
  let t: Awaited<ReturnType<typeof bootstrap<'ana' | 'beto' | 'caro' | 'dani'>>>;
  let fortniteId: string;

  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );

  const notificationsOf = async (who: 'ana' | 'beto' | 'caro' | 'dani', type: string) =>
    ((await t.api().get('/notifications?limit=100').set(t.as(who)).expect(200)).body as any[]).filter(
      (n) => n.type === type,
    );

  beforeAll(async () => {
    t = await bootstrap(['ana', 'beto', 'caro', 'dani'] as const);
    fortniteId = (await t.prisma.game.findUniqueOrThrow({ where: { slug: 'fortnite' } })).id;
  });
  afterAll(() => t.cleanup());

  describe('amigos', () => {
    it('solicitud, aceptación y lista con notificaciones', async () => {
      const req = await t.api().post('/friends/request').set(t.as('ana')).send({ userId: t.users.beto.id }).expect(201);
      expect(req.body.status).toBe('PENDING');
      await t.api().post('/friends/request').set(t.as('ana')).send({ userId: t.users.beto.id }).expect(409);
      await t.api().post('/friends/request').set(t.as('ana')).send({ userId: t.users.ana.id }).expect(400);

      const inbox = await t.api().get('/friends/requests').set(t.as('beto')).expect(200);
      expect(inbox.body.incoming.map((r: any) => r.user.id)).toContain(t.users.ana.id);
      expect(await notificationsOf('beto', 'FRIEND_REQUEST')).toHaveLength(1);

      await t.api().post(`/friends/requests/${req.body.id}/accept`).set(t.as('caro')).expect(404);
      await t.api().post(`/friends/requests/${req.body.id}/accept`).set(t.as('beto')).expect(200);
      expect(await notificationsOf('ana', 'FRIEND_ACCEPTED')).toHaveLength(1);

      const list = await t.api().get('/friends').set(t.as('ana')).expect(200);
      expect(list.body.map((f: any) => f.user.id)).toEqual([t.users.beto.id]);
    });

    it('si los dos se envían solicitud, se aceptan automáticamente', async () => {
      await t.api().post('/friends/request').set(t.as('caro')).send({ userId: t.users.ana.id }).expect(201);
      const res = await t.api().post('/friends/request').set(t.as('ana')).send({ userId: t.users.caro.id }).expect(201);
      expect(res.body.status).toBe('ACCEPTED');
    });

    it('bloquear corta la amistad e impide nuevas solicitudes', async () => {
      await t.api().post('/friends/request').set(t.as('dani')).send({ userId: t.users.caro.id }).expect(201);
      await t.api().post(`/friends/${t.users.dani.id}/block`).set(t.as('caro')).expect(204);
      await t.api().post('/friends/request').set(t.as('dani')).send({ userId: t.users.caro.id }).expect(403);
      await t.api().delete(`/friends/${t.users.dani.id}/block`).set(t.as('caro')).expect(204);
    });
  });

  describe('mensajes privados', () => {
    let anaSocket: Socket;
    let betoSocket: Socket;

    beforeAll(async () => {
      anaSocket = await t.connect('/chat', 'ana');
      betoSocket = await t.connect('/chat', 'beto');
    });

    it('entre amigos llegan en tiempo real a ambos', async () => {
      const toBeto = nextEvent(betoSocket, 'dm:new');
      const ack = await anaSocket.emitWithAck('dm:send', { toUserId: t.users.beto.id, content: '¿Jugamos luego?' });
      expect(ack).toMatchObject({ ok: true, data: { content: '¿Jugamos luego?' } });
      expect(await toBeto).toMatchObject({ content: '¿Jugamos luego?', partnerId: t.users.ana.id });
    });

    it('no se puede escribir a quien no es amigo', async () => {
      const ack = await anaSocket.emitWithAck('dm:send', { toUserId: t.users.dani.id, content: 'hola' });
      expect(ack).toEqual({ ok: false, error: 'Solo puedes escribir a tus amigos' });
      await t.api().post(`/messages/direct/${t.users.dani.id}`).set(t.as('ana')).send({ content: 'hola' }).expect(403);
    });

    it('conversaciones con no leídos y marcar como leído', async () => {
      await t.api().post(`/messages/direct/${t.users.beto.id}`).set(t.as('ana')).send({ content: 'Te espero' }).expect(201);

      const convs = await t.api().get('/messages/conversations').set(t.as('beto')).expect(200);
      expect(convs.body[0]).toMatchObject({ partner: { id: t.users.ana.id }, unread: 2, lastMessage: { content: 'Te espero' } });

      const history = await t.api().get(`/messages/direct/${t.users.ana.id}`).set(t.as('beto')).expect(200);
      expect(history.body.map((m: any) => m.content)).toEqual(['¿Jugamos luego?', 'Te espero']);

      await t.api().post(`/messages/direct/${t.users.ana.id}/read`).set(t.as('beto')).expect(200);
      const after = await t.api().get('/messages/conversations').set(t.as('beto')).expect(200);
      expect(after.body[0].unread).toBe(0);
    });

    it('si el destinatario no está conectado, recibe una notificación', async () => {
      await t.api().post(`/messages/direct/${t.users.caro.id}`).set(t.as('ana')).send({ content: 'Mira esto' }).expect(201);
      const [n] = await notificationsOf('caro', 'NEW_MESSAGE');
      expect(n).toMatchObject({ body: 'Mira esto', data: { userId: t.users.ana.id } });
      expect(await notificationsOf('beto', 'NEW_MESSAGE')).toHaveLength(0);
    });
  });

  describe('invitaciones a sesiones', () => {
    it('la invitación del creador salta la aprobación manual', async () => {
      const s = await t.api().post('/sessions').set(t.as('ana')).send({
        title: 'Squad', gameId: fortniteId, platform: 'PC', maxPlayers: 4, skillLevel: 'ADVANCED',
        startsAt: inMinutes(120).toISOString(), joinMode: 'MANUAL',
      }).expect(201);
      const id = s.body.id;

      await t.api().post(`/sessions/${id}/invite/${t.users.dani.id}`).set(t.as('ana')).expect(403);
      const inv = await t.api().post(`/sessions/${id}/invite/${t.users.beto.id}`).set(t.as('ana')).expect(200);
      expect(inv.body).toEqual({ invited: true, directJoin: true });
      expect(await notificationsOf('beto', 'SESSION_INVITE')).toHaveLength(1);

      const asBeto = await t.api().get(`/sessions/${id}`).set(t.as('beto')).expect(200);
      expect(asBeto.body.myStatus).toBe('INVITED');
      const asAna = await t.api().get(`/sessions/${id}`).set(t.as('ana')).expect(200);
      expect(asAna.body.invited.map((m: any) => m.user.id)).toEqual([t.users.beto.id]);

      const joined = await t.api().post(`/sessions/${id}/join`).set(t.as('beto')).expect(201);
      expect(joined.body.status).toBe('ACCEPTED');

      await t.api().post('/friends/request').set(t.as('beto')).send({ userId: t.users.dani.id }).expect(201);
      const req = await t.api().get('/friends/requests').set(t.as('dani')).expect(200);
      await t.api().post(`/friends/requests/${req.body.incoming[0].id}/accept`).set(t.as('dani')).expect(200);
      const inv2 = await t.api().post(`/sessions/${id}/invite/${t.users.dani.id}`).set(t.as('beto')).expect(200);
      expect(inv2.body.directJoin).toBe(false);
      const daniJoin = await t.api().post(`/sessions/${id}/join`).set(t.as('dani')).expect(201);
      expect(daniJoin.body.status).toBe('PENDING');
    });

    it('"mis sesiones" incluye las que creé, en las que estoy e invitaciones', async () => {
      const mine = await t.api().get('/sessions/mine').set(t.as('beto')).expect(200);
      expect(mine.body.map((s: any) => s.myStatus)).toContain('ACCEPTED');
      const dani = await t.api().get('/sessions/mine').set(t.as('dani')).expect(200);
      expect(dani.body.map((s: any) => s.myStatus)).toEqual(['PENDING']);
      const caro = await t.api().get('/sessions/mine').set(t.as('caro')).expect(200);
      expect(caro.body).toEqual([]);
    });

    it('rechazar una invitación con leave', async () => {
      const s = await t.api().post('/sessions').set(t.as('ana')).send({
        title: 'Otra', gameId: fortniteId, platform: 'PC', maxPlayers: 4, skillLevel: 'ADVANCED',
        startsAt: inMinutes(120).toISOString(),
      }).expect(201);
      await t.api().post(`/sessions/${s.body.id}/invite/${t.users.caro.id}`).set(t.as('ana')).expect(200);
      await t.api().delete(`/sessions/${s.body.id}/leave`).set(t.as('caro')).expect(204);
      const after = await t.api().get(`/sessions/${s.body.id}`).set(t.as('caro')).expect(200);
      expect(after.body.myStatus).toBe('LEFT');
    });
  });

  describe('valoraciones', () => {
    let sessionId: string;

    beforeAll(async () => {
      const s = await t.api().post('/sessions').set(t.as('ana')).send({
        title: 'Para valorar', gameId: fortniteId, platform: 'PC', maxPlayers: 4, skillLevel: 'BEGINNER',
        startsAt: inMinutes(60).toISOString(), joinMode: 'AUTOMATIC',
      }).expect(201);
      sessionId = s.body.id;
      await t.api().post(`/sessions/${sessionId}/join`).set(t.as('beto')).expect(201);
      await t.api().post(`/sessions/${sessionId}/join`).set(t.as('caro')).expect(201);
      await t.api().delete(`/sessions/${sessionId}/leave`).set(t.as('caro')).expect(204);
    });

    it('solo se valora cuando la sesión ha terminado', async () => {
      await t.api().post(`/sessions/${sessionId}/reviews`).set(t.as('ana')).send({ targetId: t.users.beto.id, stars: 5 }).expect(409);
      await t.prisma.gameSession.update({ where: { id: sessionId }, data: { status: 'FINISHED', startsAt: inMinutes(-200) } });
    });

    it('aparece como pendiente y se registra con etiquetas', async () => {
      const pending = await t.api().get('/reviews/pending').set(t.as('ana')).expect(200);
      const entry = pending.body.find((p: any) => p.session.id === sessionId);
      expect(entry.teammates.map((u: any) => u.id)).toEqual([t.users.beto.id]);

      await t.api()
        .post(`/sessions/${sessionId}/reviews`)
        .set(t.as('ana'))
        .send({ targetId: t.users.beto.id, stars: 5, tags: ['GOOD_TEAMMATE', 'PUNCTUAL', 'PUNCTUAL'], comment: 'Crack' })
        .expect(201);
      await t.api().post(`/sessions/${sessionId}/reviews`).set(t.as('ana')).send({ targetId: t.users.beto.id, stars: 4 }).expect(409);
      await t.api().post(`/sessions/${sessionId}/reviews`).set(t.as('ana')).send({ targetId: t.users.caro.id, stars: 1 }).expect(400);
      await t.api().post(`/sessions/${sessionId}/reviews`).set(t.as('ana')).send({ targetId: t.users.beto.id, stars: 6 }).expect(400);
      await t.api().post(`/sessions/${sessionId}/reviews`).set(t.as('dani')).send({ targetId: t.users.beto.id, stars: 1 }).expect(403);

      const after = await t.api().get('/reviews/pending').set(t.as('ana')).expect(200);
      expect(after.body.find((p: any) => p.session.id === sessionId)).toBeUndefined();
      expect(await notificationsOf('beto', 'REVIEW_RECEIVED')).toHaveLength(1);
    });

    it('la reputación del perfil refleja estrellas y etiquetas', async () => {
      const profile = await t.api().get(`/users/${t.users.beto.id}`).set(t.as('dani')).expect(200);
      expect(profile.body.reputation).toEqual({
        averageStars: 5,
        reviewCount: 1,
        tags: { GOOD_TEAMMATE: 1, PUNCTUAL: 1 },
      });
      const list = await t.api().get(`/users/${t.users.beto.id}/reviews`).set(t.as('dani')).expect(200);
      expect(list.body.items[0]).toMatchObject({ stars: 5, comment: 'Crack', author: { id: t.users.ana.id } });
    });
  });

  describe('publicaciones y archivos', () => {
    let fileId: string;
    let postId: string;

    it('sube imágenes validando el contenido real', async () => {
      const up = await t.api().post('/files').set(t.as('ana')).attach('file', PNG, { filename: 'captura.png', contentType: 'image/png' }).expect(201);
      expect(up.body).toMatchObject({ mimeType: 'image/png', url: expect.stringMatching(/\/uploads\/.+\.png$/) });
      fileId = up.body.id;

      const served = await t.api().get(new URL(up.body.url).pathname).expect(200);
      expect(served.headers['x-content-type-options']).toBe('nosniff');

      await t.api().post('/files').set(t.as('ana')).attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'x.png', contentType: 'image/png' }).expect(400);
      await t.api().post('/files').set(t.as('ana')).attach('file', Buffer.from('hola'), { filename: 'x.txt', contentType: 'text/plain' }).expect(400);
    });

    it('publica con archivo, y el archivo no se puede reutilizar ni usar ajeno', async () => {
      await t.api().post('/posts').set(t.as('beto')).send({ fileIds: [fileId] }).expect(400);
      const post = await t.api().post('/posts').set(t.as('ana')).send({ content: '¡Victoria magistral!', fileIds: [fileId] }).expect(201);
      expect(post.body).toMatchObject({ likeCount: 0, commentCount: 0, likedByMe: false, files: [{ id: fileId }] });
      postId = post.body.id;
      await t.api().post('/posts').set(t.as('ana')).send({ fileIds: [fileId] }).expect(400);
      await t.api().post('/posts').set(t.as('ana')).send({}).expect(400);
    });

    it('likes idempotentes y comentarios con notificación al autor', async () => {
      await t.api().post(`/posts/${postId}/like`).set(t.as('beto')).expect(200);
      const again = await t.api().post(`/posts/${postId}/like`).set(t.as('beto')).expect(200);
      expect(again.body).toEqual({ likeCount: 1, likedByMe: true });
      expect(await notificationsOf('ana', 'POST_LIKED')).toHaveLength(1);

      const c = await t.api().post(`/posts/${postId}/comments`).set(t.as('beto')).send({ content: 'GG' }).expect(201);
      expect(await notificationsOf('ana', 'POST_COMMENTED')).toHaveLength(1);
      await t.api().delete(`/posts/${postId}/comments/${c.body.id}`).set(t.as('dani')).expect(403);
      await t.api().delete(`/posts/${postId}/comments/${c.body.id}`).set(t.as('ana')).expect(204);

      await t.api().delete(`/posts/${postId}/like`).set(t.as('beto')).expect(200);
    });

    it('el feed de amigos solo muestra amigos y a uno mismo', async () => {
      await t.api().post('/posts').set(t.as('dani')).send({ content: `De dani ${t.run}` }).expect(201);
      const friendsFeed = await t.api().get('/posts?feed=friends').set(t.as('ana')).expect(200);
      const authors = new Set(friendsFeed.body.map((p: any) => p.author.id));
      expect(authors.has(t.users.dani.id)).toBe(false);
      expect(authors.has(t.users.ana.id)).toBe(true);

      const all = await t.api().get(`/posts?authorId=${t.users.dani.id}`).set(t.as('ana')).expect(200);
      expect(all.body).toHaveLength(1);
    });

    it('solo el autor o un admin borran la publicación', async () => {
      await t.api().delete(`/posts/${postId}`).set(t.as('beto')).expect(403);
      await t.api().delete(`/posts/${postId}`).set(t.as('ana')).expect(204);
      await t.api().get(`/posts/${postId}`).set(t.as('ana')).expect(404);
    });
  });

  describe('reportes', () => {
    it('exige un único objetivo y evita duplicados', async () => {
      await t.api().post('/reports').set(t.as('beto')).send({ reason: 'SPAM' }).expect(400);
      await t.api().post('/reports').set(t.as('beto')).send({ reason: 'SPAM', targetUserId: t.users.beto.id }).expect(400);
      await t.api().post('/reports').set(t.as('beto')).send({ reason: 'HARASSMENT', targetUserId: t.users.dani.id, targetPostId: t.users.dani.id }).expect(400);

      const r = await t.api().post('/reports').set(t.as('beto')).send({ reason: 'HARASSMENT', targetUserId: t.users.dani.id, details: 'Insultos' }).expect(201);
      expect(r.body.status).toBe('OPEN');
      await t.api().post('/reports').set(t.as('beto')).send({ reason: 'SPAM', targetUserId: t.users.dani.id }).expect(409);

      const mine = await t.api().get('/reports/mine').set(t.as('beto')).expect(200);
      expect(mine.body).toHaveLength(1);
    });

    it('no se puede reportar un mensaje que no puedes ver', async () => {
      const msg = await t.prisma.message.findFirstOrThrow({ where: { senderId: t.users.ana.id, recipientId: t.users.beto.id } });
      await t.api().post('/reports').set(t.as('dani')).send({ reason: 'SPAM', targetMessageId: msg.id }).expect(403);
      await t.api().post('/reports').set(t.as('beto')).send({ reason: 'SPAM', targetMessageId: msg.id }).expect(201);
    });
  });

  describe('GameBot', () => {
    it('responde preguntas del documento', async () => {
      const q1 = await t.api().post('/gamebot/ask').send({ question: '¿Cómo creo una sesión?' }).expect(200);
      expect(q1.body.matched).toBe('crear-sesion');
      const q2 = await t.api().post('/gamebot/ask').send({ question: 'que significa CROSSPLAY' }).expect(200);
      expect(q2.body.matched).toBe('crossplay');
      const q3 = await t.api().post('/gamebot/ask').send({ question: '¿Cómo encuentro jugadores?' }).expect(200);
      expect(q3.body.matched).toBe('encontrar-jugadores');
      expect(q3.body.suggestions.length).toBeGreaterThan(0);
    });

    it('saluda y sugiere cuando no entiende', async () => {
      const hi = await t.api().post('/gamebot/ask').send({ question: 'hola!' }).expect(200);
      expect(hi.body).toMatchObject({ matched: null, answer: expect.stringContaining('GameBot') });
      const unknown = await t.api().post('/gamebot/ask').send({ question: 'receta de tortilla' }).expect(200);
      expect(unknown.body.matched).toBeNull();
      expect(unknown.body.suggestions).toHaveLength(3);
      await t.api().post('/gamebot/ask').send({ question: '' }).expect(400);
    });
  });
});
