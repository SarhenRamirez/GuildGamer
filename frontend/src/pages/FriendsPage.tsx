import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { CheckCheck, MessageSquarePlus, Plus, Search, Shield, Trash2, UserPlus, UsersRound, Volume2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMe } from '../auth/AuthContext';
import { Avatar, Button, Card, Empty, ErrorText, Input, Modal, PageHeader, PillTabs, SectionTitle, Spinner, Tag } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { AVAILABILITY } from '../lib/format';
import { useFriends } from '../lib/queries';
import type { Availability, Conversation, FriendRequests, UserSummary, VoiceRoom } from '../lib/types';
import { VoicePanel } from '../voice/VoicePanel';

type Tab = 'all' | 'playing' | 'unread';

function shortTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

function VoiceRooms() {
  const me = useMe();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [openRoom, setOpenRoom] = useState<VoiceRoom | null>(null);
  const { data: rooms } = useQuery({ queryKey: ['voice-rooms'], queryFn: () => api.get<VoiceRoom[]>('/voice/rooms'), refetchInterval: 15_000 });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['voice-rooms'] });
  const create = useMutation({
    mutationFn: () => api.post('/voice/rooms', { name }),
    onSuccess: () => {
      setName('');
      refresh();
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/voice/rooms/${id}`), onSuccess: refresh });

  return (
    <section>
      <SectionTitle>Salas de voz</SectionTitle>
      <Card className="space-y-3 p-4">
        {rooms?.map((r) => (
          <div key={r.id} className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-green/12 text-brand-green">
              <Volume2 className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-white">{r.name}</p>
              <p className="text-xs text-slate-400">
                de {r.owner.id === me.id ? 'ti' : r.owner.username} · {r.participants.length} dentro
              </p>
            </div>
            <Button size="sm" variant="soft" onClick={() => setOpenRoom(r)}>
              Entrar
            </Button>
            {r.owner.id === me.id && (
              <button onClick={() => remove.mutate(r.id)} className="rounded-lg p-1.5 text-slate-500 hover:text-brand-red-soft" aria-label={`Eliminar sala ${r.name}`}>
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <Input placeholder="Nombre de una nueva sala" maxLength={50} value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre de la sala" />
          <Button type="submit" variant="secondary" loading={create.isPending} aria-label="Crear sala">
            <Plus className="size-4" />
          </Button>
        </form>
      </Card>
      <Modal open={!!openRoom} onClose={() => { setOpenRoom(null); refresh(); }} title={openRoom?.name ?? ''}>
        {openRoom && <VoicePanel target={{ roomId: openRoom.id }} />}
      </Modal>
    </section>
  );
}

function NewMessageModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: friends } = useFriends();
  const navigate = useNavigate();
  return (
    <Modal open={open} onClose={onClose} title="Nuevo mensaje">
      {!friends?.length ? (
        <p className="py-6 text-center text-sm text-slate-400">Agrega amigos para escribirles en privado.</p>
      ) : (
        <ul className="scrollbar-thin max-h-80 space-y-1 overflow-y-auto">
          {friends.map((f) => (
            <li key={f.user.id}>
              <button onClick={() => navigate(`/messages/${f.user.id}`)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/5">
                <Avatar user={f.user} size="sm" availability={f.user.availability} />
                <span className="truncate font-semibold">{f.user.username}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

interface Row {
  user: UserSummary & { availability?: Availability };
  last?: Conversation['lastMessage'];
  unread: number;
  playing?: string;
}

export function FriendsPage() {
  const me = useMe();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [newMessage, setNewMessage] = useState(false);
  const [showAllRequests, setShowAllRequests] = useState(false);
  const { data: friends, isLoading } = useFriends();
  const { data: requests } = useQuery({ queryKey: ['friends', 'requests'], queryFn: () => api.get<FriendRequests>('/friends/requests') });
  const { data: convs } = useQuery({ queryKey: ['conversations'], queryFn: () => api.get<Conversation[]>('/messages/conversations') });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['friends'] });
  const act = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSuccess: refresh });

  const online = friends?.filter((f) => f.user.availability === 'AVAILABLE').length ?? 0;
  const playing = friends?.filter((f) => f.playing) ?? [];

  const rows = useMemo<Row[]>(() => {
    const byId = new Map<string, Row>();
    for (const c of convs ?? []) byId.set(c.partner.id, { user: c.partner, last: c.lastMessage, unread: c.unread });
    for (const f of friends ?? []) {
      const row = byId.get(f.user.id);
      byId.set(f.user.id, { ...(row ?? { unread: 0 }), user: f.user, playing: f.playing?.game });
    }
    const q = search.trim().toLowerCase();
    return [...byId.values()]
      .filter((r) => !q || r.user.username.toLowerCase().includes(q))
      .filter((r) => (tab === 'playing' ? r.playing : tab === 'unread' ? r.unread > 0 : true))
      .sort((a, b) => (b.last ? new Date(b.last.createdAt).getTime() : 0) - (a.last ? new Date(a.last.createdAt).getTime() : 0));
  }, [convs, friends, search, tab]);

  const incoming = requests?.incoming ?? [];
  const totalUnread = convs?.reduce((n, c) => n + c.unread, 0) ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Amigos"
        subtitle={
          <>
            <span className="font-semibold text-brand-green">{online}</span> {online === 1 ? 'amigo conectado' : 'amigos conectados'} ahora
          </>
        }
        action={
          <Link to="/players">
            <Button variant="soft" size="sm">
              <UserPlus className="size-4" /> Agregar
            </Button>
          </Link>
        }
      />

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-500" />
        <Input className="pl-10" placeholder="Buscar por nombre de jugador…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar amigos" />
      </div>

      {incoming.length > 0 && (
        <Card className="space-y-3 border-brand-green/25 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-green/12 text-brand-green">
              <Shield className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="section-label text-brand-green">Solicitudes de amistad</p>
              <p className="font-bold text-white">
                {incoming.length} {incoming.length === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}
              </p>
            </div>
            {incoming.length > 1 && (
              <button onClick={() => setShowAllRequests((s) => !s)} className="text-xs font-semibold text-slate-400 hover:text-white">
                {showAllRequests ? 'Ver menos' : 'Ver todas'}
              </button>
            )}
          </div>
          {(showAllRequests ? incoming : incoming.slice(0, 1)).map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-xl bg-ink-850 p-2.5">
              <Link to={`/users/${r.user.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar user={r.user} size="md" availability={r.user.availability} />
                <span className="truncate font-bold text-white">{r.user.username}</span>
              </Link>
              <Button size="sm" onClick={() => act.mutate(() => api.post(`/friends/requests/${r.id}/accept`))} aria-label={`Aceptar a ${r.user.username}`}>
                Aceptar
              </Button>
              <Button size="sm" variant="secondary" onClick={() => act.mutate(() => api.post(`/friends/requests/${r.id}/reject`))} aria-label={`Rechazar a ${r.user.username}`}>
                Rechazar
              </Button>
            </div>
          ))}
          <ErrorText>{act.error && errorMessage(act.error)}</ErrorText>
        </Card>
      )}

      {playing.length > 0 && (
        <section>
          <SectionTitle>
            En partida ahora <Tag tone="green" className="ml-2">{playing.length} activos</Tag>
          </SectionTitle>
          <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            {playing.map((f) => (
              <Card key={f.user.id} className="w-56 shrink-0 snap-start space-y-3 p-3.5">
                <div className="flex items-center gap-3">
                  <Avatar user={f.user} size="md" availability={f.user.availability} />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-white">{f.user.username}</p>
                    <p className="truncate text-xs font-bold tracking-wide text-brand-green uppercase">{f.playing!.game}</p>
                  </div>
                </div>
                <p className="truncate text-xs text-slate-400">{f.playing!.title}</p>
                <Link to={`/sessions/${f.playing!.sessionId}`}>
                  <Button size="sm" variant="soft" className="w-full">
                    Ver partida
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}

      <PillTabs<Tab>
        label="Filtrar"
        value={tab}
        onChange={setTab}
        tabs={[
          ['all', 'Todos'],
          ['playing', 'En partida'],
          ['unread', totalUnread ? `No leídos (${totalUnread})` : 'No leídos'],
        ]}
      />

      <Card className="divide-y divide-white/5 overflow-hidden">
        {isLoading ? (
          <Spinner />
        ) : !rows.length ? (
          <Empty icon={<UsersRound className="size-10" />} title={friends?.length ? 'Nada por aquí' : 'Aún no tienes amigos en GuildGamer'}>
            {friends?.length ? 'Prueba con otro filtro.' : 'Busca jugadores o agrega a quienes conozcas en tus sesiones.'}
          </Empty>
        ) : (
          rows.map((r) => {
            const mine = r.last?.sender.id === me.id;
            return (
              <Link key={r.user.id} to={`/messages/${r.user.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-white/3">
                <Avatar user={r.user} size="lg" availability={r.user.availability} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="truncate font-bold text-white">{r.user.username}</p>
                    {r.last && <span className="ml-auto shrink-0 text-xs text-slate-500">{shortTime(r.last.createdAt)}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className={clsx('min-w-0 flex-1 truncate text-sm', r.unread ? 'font-semibold text-slate-100' : 'text-slate-400')}>
                      {r.last ? (
                        <>
                          {mine && 'Tú: '}
                          {r.last.content}
                        </>
                      ) : r.playing ? (
                        <span className="text-brand-green">Jugando {r.playing}</span>
                      ) : (
                        r.user.availability && AVAILABILITY[r.user.availability]
                      )}
                    </p>
                    {r.unread > 0 ? (
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-green text-[11px] font-bold text-ink-950">{r.unread}</span>
                    ) : (
                      mine && <CheckCheck className={clsx('size-4 shrink-0', r.last?.readAt ? 'text-brand-green' : 'text-slate-500')} aria-label={r.last?.readAt ? 'Leído' : 'Enviado'} />
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </Card>

      {!!requests?.outgoing.length && (
        <section>
          <SectionTitle>Solicitudes enviadas</SectionTitle>
          <Card className="divide-y divide-white/5">
            {requests.outgoing.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Avatar user={r.user} size="sm" />
                <span className="flex-1 truncate font-semibold">{r.user.username}</span>
                <button className="flex items-center gap-1 text-xs text-slate-500 hover:text-brand-red-soft" onClick={() => act.mutate(() => api.delete(`/friends/requests/${r.id}`))}>
                  <X className="size-3.5" /> Cancelar
                </button>
              </div>
            ))}
          </Card>
        </section>
      )}

      <VoiceRooms />

      <button
        onClick={() => setNewMessage(true)}
        className="fixed right-4 bottom-36 z-30 flex items-center gap-2 rounded-2xl bg-brand-green px-4 py-3 text-sm font-bold text-ink-950 shadow-lg shadow-black/40 hover:bg-brand-green/90 lg:right-8 lg:bottom-24"
      >
        <MessageSquarePlus className="size-5" /> Nuevo mensaje
      </button>
      <NewMessageModal open={newMessage} onClose={() => setNewMessage(false)} />
    </div>
  );
}
