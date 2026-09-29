import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Ban, Flag, Gamepad2, LayoutDashboard, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Badge, Button, Card, Empty, ErrorText, Input, PageHeader, PremiumBadge, Select, Spinner } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { PLATFORMS, REPORT_REASONS, SESSION_STATUS, SESSION_STATUS_STYLE, fullDate, timeAgo } from '../lib/format';
import { useGames } from '../lib/queries';
import type { Page, Platform, ReportReason, ReportStatus, SessionStatus, UserSummary } from '../lib/types';

interface Stats {
  users: { total: number; newLast7Days: number; banned: number; premium: number };
  sessions: { byStatus: Partial<Record<SessionStatus, number>>; newLast7Days: number };
  messagesLast24h: number;
  posts: number;
  openReports: number;
  topGames: { gameId: string; name: string; sessions: number }[];
}

interface AdminUser extends UserSummary {
  email: string;
  role: 'USER' | 'ADMIN';
  isBanned: boolean;
  isPremium: boolean;
  createdAt: string;
  sessionsCreated: number;
  openReports: number;
}

interface AdminReport {
  id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolutionNote: string | null;
  createdAt: string;
  reporter: UserSummary;
  targetUser: (UserSummary & { isBanned: boolean }) | null;
  targetSession: { id: string; title: string } | null;
  targetMessage: { id: string; content: string; sender: UserSummary } | null;
  targetPost: { id: string; content: string | null; author: UserSummary } | null;
}

const REPORT_STATUS: Record<ReportStatus, string> = { OPEN: 'Abierto', REVIEWING: 'En revisión', RESOLVED: 'Resuelto', DISMISSED: 'Descartado' };

function StatsTab() {
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api.get<Stats>('/admin/stats') });
  if (isLoading || !data) return <Spinner />;
  const tiles = [
    ['Usuarios', data.users.total, `+${data.users.newLast7Days} esta semana`],
    ['Premium', data.users.premium, `${data.users.banned} baneados`],
    ['Sesiones nuevas (7 días)', data.sessions.newLast7Days, `${data.sessions.byStatus.OPEN ?? 0} abiertas ahora`],
    ['Mensajes (24 h)', data.messagesLast24h, `${data.posts} publicaciones`],
    ['Reportes abiertos', data.openReports, 'pendientes de revisar'],
  ] as const;
  const maxGame = Math.max(1, ...data.topGames.map((g) => g.sessions));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {tiles.map(([label, value, hint]) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="mt-1 text-3xl font-extrabold text-white tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 font-bold text-white">Sesiones por estado</h3>
          <ul className="space-y-2">
            {(Object.keys(SESSION_STATUS) as SessionStatus[]).map((s) => (
              <li key={s} className="flex items-center justify-between text-sm">
                <Badge className={clsx('ring-1', SESSION_STATUS_STYLE[s])}>{SESSION_STATUS[s]}</Badge>
                <span className="text-slate-300 tabular-nums">{data.sessions.byStatus[s] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 font-bold text-white">Juegos con más sesiones</h3>
          <ul className="space-y-2.5">
            {data.topGames.map((g) => (
              <li key={g.gameId} className="text-sm">
                <div className="mb-1 flex justify-between">
                  <span className="text-slate-200">{g.name}</span>
                  <span className="text-slate-400 tabular-nums">{g.sessions}</span>
                </div>
                <div className="h-2 rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-brand-green" style={{ width: `${(g.sessions / maxGame) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function UsersTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [banned, setBanned] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', search, banned],
    queryFn: () => api.get<Page<AdminUser>>('/admin/users', { search, banned, limit: 50 }),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { role?: string; isBanned?: boolean } }) => api.patch(`/admin/users/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap gap-2 border-b border-white/8 p-4">
        <Input className="max-w-xs" placeholder="Usuario o email…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar usuarios" />
        <Select className="max-w-44" aria-label="Estado" value={banned} onChange={(e) => setBanned(e.target.value)} placeholder="Todos" options={{ false: 'Activos', true: 'Baneados' }} />
      </div>
      <ErrorText>{update.error && errorMessage(update.error)}</ErrorText>
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-400 uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Usuario</th>
                <th className="px-4 py-3 font-semibold">Alta</th>
                <th className="px-4 py-3 font-semibold">Sesiones</th>
                <th className="px-4 py-3 font-semibold">Reportes</th>
                <th className="px-4 py-3 font-semibold">Rol</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data?.items.map((u) => (
                <tr key={u.id} className={u.isBanned ? 'opacity-60' : ''}>
                  <td className="px-4 py-3">
                    <Link to={`/users/${u.id}`} className="flex items-center gap-2">
                      <Avatar user={u} size="sm" />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 font-medium text-white">
                          {u.username} {u.isPremium && <PremiumBadge />} {u.isBanned && <Badge className="bg-brand-red/15 text-brand-red-soft ring-brand-red/30">Baneado</Badge>}
                        </p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{timeAgo(u.createdAt)}</td>
                  <td className="px-4 py-3 tabular-nums">{u.sessionsCreated}</td>
                  <td className={clsx('px-4 py-3 tabular-nums', u.openReports && 'font-semibold text-brand-red-soft')}>{u.openReports}</td>
                  <td className="px-4 py-3">
                    <Select aria-label={`Rol de ${u.username}`} className="py-1.5" value={u.role} onChange={(e) => update.mutate({ id: u.id, body: { role: e.target.value } })} options={{ USER: 'Usuario', ADMIN: 'Admin' }} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant={u.isBanned ? 'secondary' : 'danger'} onClick={() => update.mutate({ id: u.id, body: { isBanned: !u.isBanned } })}>
                      {u.isBanned ? <ShieldCheck className="size-3.5" /> : <Ban className="size-3.5" />} {u.isBanned ? 'Readmitir' : 'Banear'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ReportsTab() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReportStatus | ''>('OPEN');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', status],
    queryFn: () => api.get<Page<AdminReport>>('/admin/reports', { status, limit: 50 }),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });
  const resolve = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReportStatus }) => api.patch(`/admin/reports/${id}`, { status, resolutionNote: notes[id] || undefined }),
    onSuccess: refresh,
  });
  const ban = useMutation({ mutationFn: (id: string) => api.patch(`/admin/users/${id}`, { isBanned: true }), onSuccess: refresh });
  const deletePost = useMutation({ mutationFn: (id: string) => api.delete(`/posts/${id}`), onSuccess: refresh });

  const target = (r: AdminReport) => {
    if (r.targetUser) return <>Usuario <Link className="text-brand-green hover:underline" to={`/users/${r.targetUser.id}`}>{r.targetUser.username}</Link></>;
    if (r.targetSession) return <>Sesión <Link className="text-brand-green hover:underline" to={`/sessions/${r.targetSession.id}`}>{r.targetSession.title}</Link></>;
    if (r.targetMessage) return <>Mensaje de {r.targetMessage.sender.username}: <q className="text-slate-300">{r.targetMessage.content}</q></>;
    if (r.targetPost) return <>Publicación de {r.targetPost.author.username}: <q className="text-slate-300">{r.targetPost.content ?? '(solo archivos)'}</q></>;
    return 'Elemento eliminado';
  };
  const offender = (r: AdminReport) => r.targetUser ?? r.targetMessage?.sender ?? r.targetPost?.author;

  return (
    <div className="space-y-4">
      <Select className="max-w-52" aria-label="Estado" value={status} onChange={(e) => setStatus(e.target.value as ReportStatus)} placeholder="Todos" options={REPORT_STATUS} />
      <ErrorText>{(resolve.error || ban.error || deletePost.error) && errorMessage(resolve.error ?? ban.error ?? deletePost.error)}</ErrorText>
      {isLoading ? (
        <Spinner />
      ) : !data?.items.length ? (
        <Card>
          <Empty icon={<Flag className="size-10" />} title="No hay reportes en este estado" />
        </Card>
      ) : (
        data.items.map((r) => {
          const who = offender(r);
          return (
            <Card key={r.id} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-brand-red/15 text-brand-red-soft ring-brand-red/30">{REPORT_REASONS[r.reason]}</Badge>
                <Badge>{REPORT_STATUS[r.status]}</Badge>
                <span className="text-xs text-slate-500">
                  por {r.reporter.username} · {fullDate(r.createdAt)}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-400">{target(r)}</p>
              {r.details && <p className="mt-2 rounded-lg bg-white/4 px-3 py-2 text-sm text-slate-300">{r.details}</p>}
              {r.resolutionNote && <p className="mt-2 text-xs text-slate-500">Nota: {r.resolutionNote}</p>}
              {(r.status === 'OPEN' || r.status === 'REVIEWING') && (
                <div className="mt-4 space-y-2">
                  <Input placeholder="Nota de resolución (opcional)" value={notes[r.id] ?? ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} aria-label="Nota de resolución" />
                  <div className="flex flex-wrap gap-2">
                    {who && !('isBanned' in who && who.isBanned) && (
                      <Button size="sm" variant="danger" loading={ban.isPending} onClick={() => ban.mutate(who.id)}>
                        <Ban className="size-3.5" /> Banear a {who.username}
                      </Button>
                    )}
                    {r.targetPost && (
                      <Button size="sm" variant="danger" onClick={() => deletePost.mutate(r.targetPost!.id)}>
                        <Trash2 className="size-3.5" /> Borrar publicación
                      </Button>
                    )}
                    {r.status === 'OPEN' && (
                      <Button size="sm" variant="secondary" onClick={() => resolve.mutate({ id: r.id, status: 'REVIEWING' })}>
                        Marcar en revisión
                      </Button>
                    )}
                    <Button size="sm" onClick={() => resolve.mutate({ id: r.id, status: 'RESOLVED' })}>
                      Resolver
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => resolve.mutate({ id: r.id, status: 'DISMISSED' })}>
                      Descartar
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}

function GamesTab() {
  const queryClient = useQueryClient();
  const { data: games, isLoading } = useGames();
  const [form, setForm] = useState({ name: '', genre: '', coverUrl: '', tags: '', platforms: [] as Platform[] });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['games'] });
  const create = useMutation({
    mutationFn: () =>
      api.post('/games', {
        name: form.name,
        genre: form.genre,
        coverUrl: form.coverUrl || undefined,
        platforms: form.platforms,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      setForm({ name: '', genre: '', coverUrl: '', tags: '', platforms: [] });
      refresh();
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/games/${id}`), onSuccess: refresh });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="divide-y divide-white/5">
        {isLoading ? (
          <Spinner />
        ) : (
          games?.map((g) => (
            <div key={g.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">{g.name}</p>
                <p className="text-xs text-slate-400">
                  {g.genre} · {g.platforms.map((p) => PLATFORMS[p]).join(', ')}
                </p>
              </div>
              <button onClick={() => remove.mutate(g.id)} className="rounded-lg p-1.5 text-slate-500 hover:text-brand-red-soft" aria-label={`Eliminar ${g.name}`}>
                <Trash2 className="size-4" />
              </button>
            </div>
          ))
        )}
      </Card>
      <Card className="h-fit p-5">
        <h3 className="mb-3 font-bold text-white">Agregar juego</h3>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Input required placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Nombre" />
          <Input required placeholder="Género" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} aria-label="Género" />
          <Input type="url" placeholder="URL de portada (https)" value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} aria-label="Portada" />
          <Input placeholder="Etiquetas separadas por comas" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} aria-label="Etiquetas" />
          <fieldset className="flex flex-wrap gap-2">
            <legend className="label">Plataformas</legend>
            {(Object.keys(PLATFORMS) as Platform[]).map((p) => {
              const on = form.platforms.includes(p);
              return (
                <button
                  type="button"
                  key={p}
                  aria-pressed={on}
                  onClick={() => setForm({ ...form, platforms: on ? form.platforms.filter((x) => x !== p) : [...form.platforms, p] })}
                  className={on ? 'rounded-full bg-brand-green/15 px-2.5 py-1 text-xs text-brand-green ring-1 ring-brand-green/40' : 'rounded-full px-2.5 py-1 text-xs text-slate-400 ring-1 ring-white/10'}
                >
                  {PLATFORMS[p]}
                </button>
              );
            })}
          </fieldset>
          <ErrorText>{(create.error || remove.error) && errorMessage(create.error ?? remove.error)}</ErrorText>
          <Button type="submit" className="w-full" loading={create.isPending} disabled={!form.platforms.length}>
            <Plus className="size-4" /> Agregar
          </Button>
        </form>
      </Card>
    </div>
  );
}

const TABS = [
  { key: 'stats', label: 'Resumen', icon: LayoutDashboard, Component: StatsTab },
  { key: 'reports', label: 'Reportes', icon: Flag, Component: ReportsTab },
  { key: 'users', label: 'Usuarios', icon: Users, Component: UsersTab },
  { key: 'games', label: 'Juegos', icon: Gamepad2, Component: GamesTab },
] as const;

export function AdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('stats');
  const Active = TABS.find((t) => t.key === tab)!.Component;
  return (
    <>
      <PageHeader title="Administración" subtitle="Moderación, usuarios, catálogo y estadísticas." />
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-white/4 p-1" role="tablist">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={clsx('flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium', tab === key ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white')}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      <Active />
    </>
  );
}
