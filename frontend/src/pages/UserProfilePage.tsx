import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, BarChart3, Clock, Crown, Gamepad2, MessageCircle, Pencil, Star, UserCheck, UserMinus, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMe } from '../auth/AuthContext';
import { ReportButton } from '../components/ReportButton';
import { GameCover } from '../components/SessionCard';
import { Avatar, Badge, Button, Card, Empty, ErrorText, Modal, PremiumBadge, Spinner, Stars, Tag } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { AVAILABILITY, COMMUNICATION, PLATFORMS, REVIEW_TAGS, SKILL_LEVELS, languageName, timeAgo } from '../lib/format';
import type { AdvancedStats, FriendRequests, Page, Profile, Review, ReviewTag } from '../lib/types';
import { useFriends } from '../lib/queries';

function FriendActions({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { data: friends } = useFriends();
  const { data: requests } = useQuery({ queryKey: ['friends', 'requests'], queryFn: () => api.get<FriendRequests>('/friends/requests') });
  const [confirmBlock, setConfirmBlock] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['friends'] });
  const act = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSuccess: refresh });

  const isFriend = friends?.some((f) => f.user.id === userId);
  const incoming = requests?.incoming.find((r) => r.user.id === userId);
  const outgoing = requests?.outgoing.find((r) => r.user.id === userId);

  return (
    <div className="flex flex-wrap gap-2">
      {isFriend ? (
        <>
          <Link to={`/messages/${userId}`}>
            <Button>
              <MessageCircle className="size-4" /> Mensaje
            </Button>
          </Link>
          <Button variant="secondary" loading={act.isPending} onClick={() => act.mutate(() => api.delete(`/friends/${userId}`))}>
            <UserMinus className="size-4" /> Quitar amigo
          </Button>
        </>
      ) : incoming ? (
        <Button loading={act.isPending} onClick={() => act.mutate(() => api.post(`/friends/requests/${incoming.id}/accept`))}>
          <UserCheck className="size-4" /> Aceptar solicitud
        </Button>
      ) : outgoing ? (
        <Button variant="secondary" loading={act.isPending} onClick={() => act.mutate(() => api.delete(`/friends/requests/${outgoing.id}`))}>
          <Clock className="size-4" /> Solicitud enviada · Cancelar
        </Button>
      ) : (
        <Button loading={act.isPending} onClick={() => act.mutate(() => api.post('/friends/request', { userId }))}>
          <UserPlus className="size-4" /> Agregar amigo
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={() => setConfirmBlock(true)}>
        <Ban className="size-3.5" /> Bloquear
      </Button>
      <ReportButton target={{ targetUserId: userId }} />
      <ErrorText>{act.error && errorMessage(act.error)}</ErrorText>
      <Modal open={confirmBlock} onClose={() => setConfirmBlock(false)} title="¿Bloquear a este jugador?">
        <p className="mb-5 text-sm text-slate-300">Dejarán de ser amigos y no podrá enviarte solicitudes ni mensajes.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmBlock(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={() => act.mutate(() => api.post(`/friends/${userId}/block`), { onSettled: () => setConfirmBlock(false) })}
          >
            Bloquear
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function AdvancedStatsCard() {
  const { data, isLoading } = useQuery({ queryKey: ['stats'], queryFn: () => api.get<AdvancedStats>('/users/me/stats') });
  if (isLoading) return <Spinner />;
  if (!data) return null;
  const max = Math.max(1, ...data.byGame.map((g) => g.sessions));
  return (
    <Card className="p-5">
      <h2 className="mb-4 flex items-center gap-2 font-bold text-white">
        <BarChart3 className="size-4 text-brand-gold-soft" /> Estadísticas avanzadas
      </h2>
      <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Sesiones jugadas', data.sessionsPlayed],
          ['Sesiones creadas', data.sessionsCreated],
          ['Horas jugadas', data.totalHours],
          ['Valoraciones dadas', data.reviewsGiven],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white/4 p-3">
            <dt className="text-xs text-slate-400">{label}</dt>
            <dd className="text-2xl font-bold text-white tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {data.byGame.length > 0 && (
        <>
          <h3 className="mb-2 text-sm font-semibold text-slate-300">Por juego</h3>
          <ul className="mb-5 space-y-2">
            {data.byGame.map((g) => (
              <li key={g.game.id} className="text-sm">
                <div className="mb-1 flex justify-between">
                  <span className="text-slate-200">{g.game.name}</span>
                  <span className="text-slate-400 tabular-nums">
                    {g.sessions} sesiones · {g.hours} h
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-brand-green" style={{ width: `${(g.sessions / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {data.topTeammates.length > 0 && (
        <>
          <h3 className="mb-2 text-sm font-semibold text-slate-300">Compañeros habituales</h3>
          <ul className="flex flex-wrap gap-3">
            {data.topTeammates.map((t) => (
              <li key={t.user.id}>
                <Link to={`/users/${t.user.id}`} className="flex items-center gap-2 rounded-full bg-white/5 py-1 pr-3 pl-1 text-sm hover:bg-white/10">
                  <Avatar user={t.user} size="xs" /> {t.user.username} <span className="text-slate-500">×{t.sessions}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {!data.sessionsPlayed && <p className="text-sm text-slate-400">Juega tu primera sesión para ver tus estadísticas.</p>}
    </Card>
  );
}

export function UserProfilePage() {
  const { id = '' } = useParams();
  const me = useMe();
  const isMe = id === me.id;
  const { data: p, isLoading, error } = useQuery({ queryKey: ['profile', id], queryFn: () => api.get<Profile>(`/users/${id}`) });
  const reviews = useQuery({ queryKey: ['reviews', id], queryFn: () => api.get<Page<Review>>(`/users/${id}/reviews`, { limit: 10 }) });

  if (isLoading) return <Spinner />;
  if (error || !p) {
    return (
      <Card>
        <Empty title="Este jugador no existe" />
      </Card>
    );
  }

  const accent = p.isPremium && p.accentColor ? p.accentColor : undefined;
  const actions = isMe ? (
    <Link to="/profile">
      <Button variant="secondary" className="w-full sm:w-auto">
        <Pencil className="size-4" /> Editar perfil
      </Button>
    </Link>
  ) : (
    <FriendActions userId={id} />
  );
  const tagEntries = Object.entries(p.reputation.tags) as [ReviewTag, number][];

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div
          className="h-32 bg-ink-800 sm:h-40"
          style={
            p.isPremium && p.bannerUrl
              ? { backgroundImage: `url(${p.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : accent
                ? { background: `linear-gradient(90deg, ${accent}99, #16191e)` }
                : undefined
          }
        />
        <div className="px-5 pb-5 sm:px-6">
          <div className="-mt-10 flex items-end justify-between gap-3">
            <Avatar user={p} size="xl" availability={p.availability} className="rounded-full ring-4 ring-ink-900" />
            <div className="hidden pb-1 sm:block">{actions}</div>
          </div>
          <div className="mt-3 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 truncate text-2xl font-extrabold text-white" style={accent ? { color: accent } : undefined}>
                {p.username}
              </h1>
              {p.isPremium && <PremiumBadge />}
              {p.role === 'ADMIN' && <Tag tone="green">Admin</Tag>}
            </div>
            <p className="mt-0.5 text-sm text-slate-400">
              {AVAILABILITY[p.availability]} · {SKILL_LEVELS[p.skillLevel]} · {COMMUNICATION[p.communicationPreference]}
            </p>
          </div>
          <div className="mt-4 sm:hidden">{actions}</div>
          {p.bio && <p className="mt-4 max-w-2xl text-sm whitespace-pre-wrap text-slate-300">{p.bio}</p>}
          {!!p.languages.length && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {p.languages.map((l) => (
                <Badge key={l}>{languageName(l)}</Badge>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {isMe && me.isPremium && <AdvancedStatsCard />}
          {isMe && !me.isPremium && (
            <Card className="flex flex-wrap items-center gap-4 p-5">
              <Crown className="size-6 text-brand-gold-soft" />
              <p className="flex-1 text-sm text-slate-300">Con Premium verás tus horas por juego, tus compañeros habituales y más estadísticas.</p>
              <Link to="/premium">
                <Button variant="secondary">Ver Premium</Button>
              </Link>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 font-bold text-white">
              <Gamepad2 className="size-4" /> Juegos
            </h2>
            {!p.games.length ? (
              <p className="text-sm text-slate-400">{isMe ? 'Agrega tus juegos desde "Editar perfil".' : 'Aún no ha agregado juegos.'}</p>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {p.games.map((g) => (
                  <li key={`${g.game.id}-${g.platform}`} className="flex items-center gap-3 rounded-xl bg-white/4 p-3">
                    <GameCover game={g.game} className="size-11 shrink-0 rounded-lg text-sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">
                        {g.game.name} {g.isFavorite && <Star className="inline size-3.5 fill-brand-gold-soft text-brand-gold-soft" aria-label="Favorito" />}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {PLATFORMS[g.platform]}
                        {g.rank ? ` · ${g.rank}` : g.skillLevel && ` · ${SKILL_LEVELS[g.skillLevel]}`}
                        {g.role && ` · ${g.role}`}
                        {g.gamerTag && ` · ${g.gamerTag}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 font-bold text-white">Valoraciones recibidas</h2>
            {!reviews.data?.items.length ? (
              <p className="text-sm text-slate-400">Todavía no tiene valoraciones.</p>
            ) : (
              <ul className="space-y-4">
                {reviews.data.items.map((r) => (
                  <li key={r.id} className="border-b border-white/5 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <Avatar user={r.author} size="xs" />
                      <span className="text-sm font-medium text-slate-200">{r.author.username}</span>
                      <Stars value={r.stars} />
                      <span className="ml-auto text-xs text-slate-500">{timeAgo(r.createdAt)}</span>
                    </div>
                    {r.comment && <p className="mt-1.5 text-sm text-slate-300">{r.comment}</p>}
                    <p className="mt-1 text-xs text-slate-500">
                      {r.session.game.name} · {r.session.title}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 font-bold text-white">Reputación</h2>
            {p.reputation.reviewCount ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-white tabular-nums">{p.reputation.averageStars?.toFixed(1)}</span>
                  <Stars value={p.reputation.averageStars ?? 0} size="lg" />
                </div>
                <p className="mb-4 text-xs text-slate-400">{p.reputation.reviewCount} valoraciones</p>
                <ul className="space-y-1.5">
                  {tagEntries.map(([tag, n]) => (
                    <li key={tag} className="flex justify-between text-sm">
                      <span className="text-slate-300">{REVIEW_TAGS[tag]}</span>
                      <span className="text-slate-500 tabular-nums">×{n}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-slate-400">Sin valoraciones todavía.</p>
            )}
          </Card>
          <Card className="p-5">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-400">Sesiones jugadas</dt>
                <dd className="font-semibold text-white tabular-nums">{p.stats.sessionsPlayed}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">En GuildGamer</dt>
                <dd className="text-slate-200">{timeAgo(p.createdAt).replace('hace ', '')}</dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>
    </div>
  );
}
