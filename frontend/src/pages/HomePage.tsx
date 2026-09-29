import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowRight, Gamepad2, Monitor, Plus, Search, Sparkles, Star, Swords, UserPlus, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMe } from '../auth/AuthContext';
import { CoverFill, GameArt } from '../components/GameArt';
import { Avatar, Button, Card, Empty, Spinner, Tag } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { PLATFORMS, SKILL_LEVELS, timeAgo } from '../lib/format';
import type { AppNotification, MemberStatus, OnlinePlayer, Page, PendingReview, PopularGame, SessionSummary } from '../lib/types';

function SectionHeader({ icon: Icon, title, to, label = 'Ver todos' }: { icon: typeof Gamepad2; title: string; to?: string; label?: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-xl bg-accent/12 text-accent">
        <Icon className="size-5" />
      </span>
      <h2 className="text-lg font-extrabold text-white sm:text-xl">{title}</h2>
      {to && (
        <Link to={to} className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
          {label} <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

function Hero() {
  const me = useMe();
  return (
    <section className="relative overflow-hidden rounded-3xl border border-accent/25 bg-ink-900 p-6 shadow-[0_0_60px_-20px_var(--accent)] sm:p-8 lg:p-10">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="hero-art absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950/95 via-ink-950/70 to-ink-950/10 max-md:bg-ink-950/75" />
      </div>
      <div className="relative max-w-xl md:max-w-[56%]">
        <p className="text-base text-slate-300">Hola, {me.username} 👋</p>
        <h1 className="mt-2 text-3xl leading-tight font-black tracking-tight text-white sm:text-5xl">
          ¿A qué jugamos <span className="text-accent">hoy?</span>
        </h1>
        <p className="mt-3 text-base text-slate-300 sm:text-lg">Conecta, juega y disfruta con personas que comparten tu misma pasión.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link to="/sessions/new">
            <Button size="lg">
              <Plus className="size-5" /> Crear sesión
            </Button>
          </Link>
          <Link to="/sessions">
            <Button size="lg" variant="secondary" className="bg-ink-850/80">
              <Search className="size-5" /> Buscar sesiones
            </Button>
          </Link>
          <Link to="/players">
            <Button size="lg" variant="secondary" className="bg-ink-850/80">
              <UserPlus className="size-5" /> Buscar jugadores
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function PopularGames({ games }: { games: PopularGame[] }) {
  return (
    <section>
      <SectionHeader icon={Gamepad2} title="Juegos populares" to="/sessions" />
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
        {games.map((g) => (
          <Link
            key={g.id}
            to={`/sessions?gameId=${g.id}`}
            className="group w-36 shrink-0 snap-start sm:w-40"
            aria-label={`${g.name}: ${g.openSessions} sesiones abiertas`}
          >
            <GameArt game={g} showName className="aspect-[4/5] rounded-2xl ring-1 ring-white/8 transition group-hover:ring-accent/60">
              {g.openSessions > 0 && (
                <span className="absolute top-2.5 right-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-accent backdrop-blur">
                  {g.openSessions} {g.openSessions === 1 ? 'sesión' : 'sesiones'}
                </span>
              )}
            </GameArt>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SessionTile({ session }: { session: SessionSummary }) {
  const queryClient = useQueryClient();
  const join = useMutation({
    mutationFn: () => api.post<{ status: MemberStatus }>(`/sessions/${session.id}/join`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });
  const category = (session.mode || (session.kind === 'TOURNAMENT' ? 'Torneo' : SKILL_LEVELS[session.skillLevel])).toUpperCase();
  const members = session.previewMembers ?? [session.creator];

  return (
    <article className="card group relative flex flex-col overflow-hidden transition hover:border-accent/40">
      <div aria-hidden className="absolute inset-x-0 top-0 h-44 opacity-80 [mask-image:linear-gradient(to_bottom,black_25%,transparent)]">
        <CoverFill game={session.game} />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-900/90 via-ink-900/40 to-transparent" />
      </div>
      <div className="relative flex flex-1 flex-col gap-3 p-4">
        <div className="mb-8 flex items-center gap-2">
          <span className="relative size-8 overflow-hidden rounded-full ring-2 ring-white/15">
            <CoverFill game={session.game} />
          </span>
          <span className="truncate text-sm font-bold text-white drop-shadow">{session.game.name}</span>
        </div>
        <div>
          <p className="text-[11px] font-black tracking-wider text-accent">{category}</p>
          <Link to={`/sessions/${session.id}`} className="mt-0.5 line-clamp-1 text-lg font-extrabold text-white hover:underline">
            {session.title}
          </Link>
          <p className="mt-1 line-clamp-2 min-h-10 text-sm text-slate-400">{session.description || `Sesión de ${session.game.name} en ${PLATFORMS[session.platform]}.`}</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-300">
          <span className="flex items-center gap-1.5">
            <Users className="size-4 text-slate-500" /> {session.playersCount}/{session.maxPlayers}
          </span>
          <span className="flex items-center gap-1.5">
            <Monitor className="size-4 text-slate-500" /> {PLATFORMS[session.platform]}
          </span>
        </div>
        <div className="flex -space-x-2">
          {members.slice(0, 5).map((u) => (
            <Avatar key={u.id} user={u} size="sm" className="rounded-full ring-2 ring-ink-900" />
          ))}
        </div>
        <div className="mt-auto space-y-2">
          {join.data ? (
            <Link to={`/sessions/${session.id}`}>
              <Button variant="soft" className="w-full">
                {join.data.status === 'ACCEPTED' ? '¡Estás dentro!' : 'Solicitud enviada'}
              </Button>
            </Link>
          ) : (
            <Button className="w-full" loading={join.isPending} onClick={() => join.mutate()}>
              Unirse
            </Button>
          )}
          {join.error && <p className="text-xs text-brand-red-soft">{errorMessage(join.error)}</p>}
          <p className="text-xs text-slate-500">{timeAgo(session.createdAt)}</p>
        </div>
      </div>
    </article>
  );
}

function OnlinePlayers() {
  const { data, isLoading } = useQuery({
    queryKey: ['online'],
    queryFn: () => api.get<{ count: number; items: OnlinePlayer[] }>('/users/online'),
    refetchInterval: 30_000,
  });
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Users className="size-5 text-accent" />
        <h2 className="font-extrabold text-white">Jugadores en línea</h2>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-accent/12 px-2.5 py-0.5 text-xs font-bold text-accent">
          <span className="size-1.5 rounded-full bg-accent" /> {data?.count ?? 0}
        </span>
      </div>
      {isLoading ? (
        <Spinner className="py-6" />
      ) : !data?.items.length ? (
        <p className="py-4 text-center text-sm text-slate-500">Ahora mismo no hay nadie más conectado.</p>
      ) : (
        <ul className="space-y-3">
          {data.items.slice(0, 7).map((p) => (
            <li key={p.id}>
              <Link to={p.sessionId ? `/sessions/${p.sessionId}` : `/users/${p.id}`} className="flex items-center gap-3 rounded-xl hover:bg-white/3">
                <Avatar user={p} size="md" availability="AVAILABLE" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{p.username}</p>
                  {p.game && <p className="truncate text-xs text-slate-400">{p.game}</p>}
                </div>
                <span className={clsx('flex items-center gap-1.5 text-xs font-semibold', p.status === 'playing' ? 'text-accent' : 'text-online')}>
                  <span className={clsx('size-1.5 rounded-full', p.status === 'playing' ? 'bg-accent' : 'bg-online')} />
                  {p.status === 'playing' ? 'Jugando' : 'En línea'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecentActivity() {
  const { data } = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => api.get<AppNotification[]>('/notifications', { limit: 5 }),
  });
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Zap className="size-5 text-accent" />
        <h2 className="font-extrabold text-white">Actividad reciente</h2>
        <Link to="/notifications" className="ml-auto text-xs font-semibold text-accent hover:underline">
          Ver todo
        </Link>
      </div>
      {!data?.length ? (
        <p className="py-4 text-center text-sm text-slate-500">Aquí verás quién se une a tus sesiones, tus nuevos amigos y más.</p>
      ) : (
        <ul className="space-y-4">
          {data.map((n) => (
            <li key={n.id} className="flex gap-3">
              {n.actor ? (
                <Avatar user={n.actor} size="md" />
              ) : (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent">
                  <Sparkles className="size-4" />
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm leading-snug text-slate-200">{n.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{timeAgo(n.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CommunityPromo() {
  return (
    <div className="hero-bg relative overflow-hidden rounded-2xl border border-white/8 bg-ink-900 p-5">
      <Gamepad2 className="size-9 text-accent" />
      <p className="mt-3 text-xl leading-tight font-extrabold text-white">La mejor comunidad gamer te espera</p>
      <Link to="/feed" className="mt-4 inline-block">
        <Button size="sm">¡Juega, conecta, disfruta!</Button>
      </Link>
    </div>
  );
}

export function HomePage() {
  const { data: games = [] } = useQuery({ queryKey: ['games', 'popular'], queryFn: () => api.get<PopularGame[]>('/games/popular') });
  const sessions = useQuery({
    queryKey: ['sessions', 'home'],
    queryFn: () => api.get<Page<SessionSummary>>('/sessions', { limit: 6 }),
  });
  const mine = useQuery({
    queryKey: ['sessions', 'mine'],
    queryFn: () => api.get<(SessionSummary & { myStatus: MemberStatus })[]>('/sessions/mine'),
  });
  const pending = useQuery({ queryKey: ['reviews', 'pending'], queryFn: () => api.get<PendingReview[]>('/reviews/pending') });
  const available = sessions.data?.items.filter((s) => !mine.data?.some((m) => m.id === s.id)) ?? [];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="space-y-8">
        <Hero />

        {!!pending.data?.length && (
          <Link to={`/sessions/${pending.data[0].session.id}#valorar`} className="card flex items-center gap-3 border-brand-gold/25 p-4 hover:border-brand-gold/50">
            <Star className="size-5 shrink-0 text-brand-gold" />
            <p className="flex-1 text-sm text-slate-200">
              Tienes compañeros por valorar de <span className="font-bold text-white">{pending.data[0].session.title}</span>
            </p>
            <ArrowRight className="size-4 text-slate-500" />
          </Link>
        )}

        {games.length > 0 && <PopularGames games={games} />}

        {!!mine.data?.length && (
          <section>
            <SectionHeader icon={Swords} title="Mis próximas sesiones" to="/sessions" label="Ver todas" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {mine.data.slice(0, 3).map((s) => (
                <Link key={s.id} to={`/sessions/${s.id}`} className="card flex items-center gap-3 p-3 hover:border-accent/30">
                  <GameArt game={s.game} className="size-14 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-black tracking-wider text-accent uppercase">{s.game.name}</p>
                    <p className="truncate font-bold text-white">{s.title}</p>
                    <p className="text-xs text-slate-400">
                      {s.playersCount}/{s.maxPlayers} jugadores
                    </p>
                  </div>
                  {s.myStatus !== 'ACCEPTED' && <Tag tone="blue">{s.myStatus === 'PENDING' ? 'Pendiente' : 'Invitado'}</Tag>}
                </Link>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionHeader icon={Users} title="Sesiones disponibles" to="/sessions" label="Ver todas" />
          {sessions.isLoading ? (
            <Spinner />
          ) : !available.length ? (
            <Card>
              <Empty icon={<Gamepad2 className="size-10" />} title="No hay sesiones abiertas ahora mismo">
                <Link to="/sessions/new" className="text-accent hover:underline">
                  Crea la primera
                </Link>{' '}
                y deja que tu squad te encuentre.
              </Empty>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {available.slice(0, 6).map((s) => (
                <SessionTile key={s.id} session={s} />
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-5">
        <OnlinePlayers />
        <RecentActivity />
        <CommunityPromo />
      </aside>
    </div>
  );
}
