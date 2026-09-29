import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Gamepad2, Plus, Sparkles, Star, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMe } from '../auth/AuthContext';
import { SessionCard } from '../components/SessionCard';
import { Avatar, Badge, Button, Card, Empty, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { AVAILABILITY, MEMBER_STATUS } from '../lib/format';
import { useFriends } from '../lib/queries';
import type { MemberStatus, PendingReview, Profile, SessionSummary } from '../lib/types';

function Section({ title, link, children }: { title: string; link?: { to: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {link && (
          <Link to={link.to} className="flex items-center gap-1 text-sm text-brand-green hover:underline">
            {link.label} <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function HomePage() {
  const me = useMe();
  const { data: profile } = useQuery({ queryKey: ['profile', me.id], queryFn: () => api.get<Profile>('/users/me') });
  const mine = useQuery({
    queryKey: ['sessions', 'mine'],
    queryFn: () => api.get<(SessionSummary & { myStatus: MemberStatus })[]>('/sessions/mine'),
  });
  const recommended = useQuery({
    queryKey: ['sessions', 'recommended'],
    queryFn: () => api.get<SessionSummary[]>('/sessions/recommended'),
  });
  const pending = useQuery({ queryKey: ['reviews', 'pending'], queryFn: () => api.get<PendingReview[]>('/reviews/pending') });
  const { data: friends } = useFriends();
  const online = friends?.filter((f) => f.user.availability !== 'UNAVAILABLE') ?? [];

  return (
    <>
      <div className="card relative mb-10 overflow-hidden p-6 sm:p-8">
        <p className="relative text-sm text-slate-400">Hola, {me.username} 👋</p>
        <h1 className="relative mt-1 text-2xl font-extrabold text-white sm:text-3xl">
          ¿A qué jugamos <span className="text-brand-green">hoy</span>?
        </h1>
        <div className="relative mt-5 flex flex-wrap gap-3">
          <Link to="/sessions/new">
            <Button>
              <Plus className="size-4" /> Crear sesión
            </Button>
          </Link>
          <Link to="/sessions">
            <Button variant="secondary">
              <Gamepad2 className="size-4" /> Buscar sesiones
            </Button>
          </Link>
          <Link to="/players">
            <Button variant="secondary">
              <UserPlus className="size-4" /> Buscar jugadores
            </Button>
          </Link>
        </div>
      </div>

      {profile && profile.games.length === 0 && (
        <Card className="mb-10 flex flex-wrap items-center gap-4 border-brand-green/30 p-5">
          <Sparkles className="size-6 text-brand-green" />
          <div className="flex-1">
            <p className="font-semibold text-white">Agrega tus juegos para recibir recomendaciones</p>
            <p className="text-sm text-slate-400">Dinos qué juegas y en qué plataforma, y te sugeriremos sesiones a tu medida.</p>
          </div>
          <Link to="/profile">
            <Button variant="secondary">Completar perfil</Button>
          </Link>
        </Card>
      )}

      {!!pending.data?.length && (
        <Section title="Valora a tus compañeros">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {pending.data.slice(0, 4).map((p) => (
              <Link key={p.session.id} to={`/sessions/${p.session.id}#valorar`} className="card flex items-center gap-3 p-4 hover:border-brand-gold/40">
                <Star className="size-5 shrink-0 text-brand-gold-soft" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{p.session.title}</p>
                  <p className="text-xs text-slate-400">{p.teammates.length} compañeros sin valorar</p>
                </div>
                <div className="flex -space-x-2">
                  {p.teammates.slice(0, 3).map((u) => (
                    <Avatar key={u.id} user={u} size="sm" className="ring-2 ring-ink-900 rounded-full" />
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section title="Mis próximas sesiones" link={{ to: '/sessions', label: 'Ver todas' }}>
        {mine.isLoading ? (
          <Spinner />
        ) : !mine.data?.length ? (
          <Card>
            <Empty icon={<Gamepad2 className="size-9" />} title="Todavía no tienes sesiones">
              Únete a una sesión abierta o crea la tuya para empezar.
            </Empty>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mine.data.map((s) => (
              <div key={s.id} className="relative">
                <SessionCard session={s} />
                {s.myStatus !== 'ACCEPTED' && (
                  <Badge className="absolute top-3 right-3 bg-brand-blue/20 text-brand-blue ring-brand-blue/30">{MEMBER_STATUS[s.myStatus]}</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Section title="Recomendadas para ti">
          {recommended.isLoading ? (
            <Spinner />
          ) : !recommended.data?.length ? (
            <Card>
              <Empty icon={<Sparkles className="size-9" />} title="Sin recomendaciones por ahora">
                Agrega juegos a tu perfil o vuelve más tarde: te mostraremos sesiones de tus juegos y plataformas.
              </Empty>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {recommended.data.slice(0, 6).map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>
          )}
        </Section>

        <Section title="Amigos conectados" link={{ to: '/friends', label: 'Todos' }}>
          <Card className="p-2">
            {!online.length ? (
              <p className="px-3 py-6 text-center text-sm text-slate-400">Ningún amigo disponible ahora mismo.</p>
            ) : (
              online.slice(0, 8).map((f) => (
                <Link key={f.user.id} to={`/users/${f.user.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/5">
                  <Avatar user={f.user} size="sm" availability={f.user.availability} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{f.user.username}</p>
                    <p className="text-xs text-slate-500">{AVAILABILITY[f.user.availability]}</p>
                  </div>
                </Link>
              ))
            )}
          </Card>
        </Section>
      </div>
    </>
  );
}
