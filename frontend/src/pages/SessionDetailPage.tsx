import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Gamepad2,
  Languages,
  Mic,
  MicOff,
  Monitor,
  Pencil,
  Play,
  Shield,
  Star,
  Trophy,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMe } from '../auth/AuthContext';
import { ChatPanel } from '../components/ChatPanel';
import { ReportButton } from '../components/ReportButton';
import { Avatar, Button, Card, Empty, ErrorText, Modal, SectionTitle, Spinner, Tag, Textarea } from '../components/ui';
import { api, ApiError, errorMessage } from '../lib/api';
import { JOIN_MODES, MEMBER_STATUS, PLATFORMS, REVIEW_TAGS, SESSION_STATUS, SKILL_LEVELS, fullDate, languageName, sessionTime } from '../lib/format';
import { useFriends } from '../lib/queries';
import type { PendingReview, ReviewTag, SessionDetail, SessionMemberView, SessionStatus, UserSummary, VoiceParticipant } from '../lib/types';
import { useRealtime } from '../realtime/RealtimeContext';
import { useVoice } from '../voice/useVoice';
import { VoiceBar } from '../voice/VoiceBar';

const ACTIVE: SessionStatus[] = ['OPEN', 'FULL'];
const VOICE_OPEN: SessionStatus[] = ['OPEN', 'FULL', 'IN_PROGRESS'];

const STATUS_LABEL: Record<SessionStatus, string> = {
  OPEN: 'Lobby abierto',
  FULL: 'Lobby completo',
  IN_PROGRESS: 'En partida',
  FINISHED: SESSION_STATUS.FINISHED,
  CANCELLED: SESSION_STATUS.CANCELLED,
};

function InviteModal({ session, open, onClose }: { session: SessionDetail; open: boolean; onClose: () => void }) {
  const { data: friends } = useFriends();
  const [sent, setSent] = useState<Record<string, string>>({});
  const inSession = new Set([...session.members, ...(session.invited ?? []), ...(session.pendingRequests ?? [])].map((m) => m.user.id));
  const invite = useMutation({
    mutationFn: (userId: string) => api.post<{ directJoin: boolean }>(`/sessions/${session.id}/invite/${userId}`),
    onSuccess: (_r, userId) => setSent((s) => ({ ...s, [userId]: 'Invitado' })),
    onError: (e, userId) => setSent((s) => ({ ...s, [userId]: errorMessage(e) })),
  });
  const candidates = friends?.filter((f) => !inSession.has(f.user.id)) ?? [];

  return (
    <Modal open={open} onClose={onClose} title="Invitar al escuadrón">
      {session.isCreator && <p className="mb-3 text-sm text-slate-400">Como líder, tus invitados entran directamente sin esperar aprobación.</p>}
      {!candidates.length ? (
        <p className="py-6 text-center text-sm text-slate-400">
          No tienes amigos para invitar.{' '}
          <Link to="/players" className="text-brand-green hover:underline">
            Busca jugadores
          </Link>
        </p>
      ) : (
        <ul className="scrollbar-thin max-h-80 space-y-1 overflow-y-auto">
          {candidates.map((f) => (
            <li key={f.user.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5">
              <Avatar user={f.user} size="sm" availability={f.user.availability} />
              <span className="flex-1 truncate text-sm font-semibold">{f.user.username}</span>
              {sent[f.user.id] ? (
                <span className="text-xs text-slate-400">{sent[f.user.id]}</span>
              ) : (
                <Button size="sm" variant="soft" loading={invite.isPending && invite.variables === f.user.id} onClick={() => invite.mutate(f.user.id)}>
                  Invitar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function ReviewForm({ sessionId, user, onDone }: { sessionId: string; user: UserSummary; onDone: () => void }) {
  const [stars, setStars] = useState(5);
  const [tags, setTags] = useState<ReviewTag[]>([]);
  const [comment, setComment] = useState('');
  const send = useMutation({
    mutationFn: () => api.post(`/sessions/${sessionId}/reviews`, { targetId: user.id, stars, tags, comment: comment || undefined }),
    onSuccess: onDone,
  });
  return (
    <div className="rounded-xl bg-ink-850 p-4 ring-1 ring-white/6">
      <div className="mb-3 flex items-center gap-3">
        <Avatar user={user} size="sm" />
        <p className="font-semibold text-white">{user.username}</p>
        <div className="ml-auto flex" role="radiogroup" aria-label="Estrellas">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={stars === n}
              aria-label={`${n} estrellas`}
              onClick={() => setStars(n)}
              className={clsx('px-0.5 text-xl', n <= stars ? 'text-brand-gold-soft' : 'text-slate-600')}
            >
              ★
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(Object.keys(REVIEW_TAGS) as ReviewTag[]).map((t) => {
          const on = tags.includes(t);
          return (
            <button
              key={t}
              aria-pressed={on}
              onClick={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t])}
              className={clsx(
                'rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
                on ? 'bg-brand-green/15 text-brand-green ring-brand-green/30' : 'text-slate-400 ring-white/10 hover:text-white',
              )}
            >
              {REVIEW_TAGS[t]}
            </button>
          );
        })}
      </div>
      <Textarea rows={2} maxLength={500} placeholder="Comentario (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <ErrorText>{send.error && errorMessage(send.error)}</ErrorText>
      <div className="mt-3 flex justify-end">
        <Button size="sm" loading={send.isPending} onClick={() => send.mutate()}>
          <Star className="size-3.5" /> Enviar valoración
        </Button>
      </div>
    </div>
  );
}

function MemberRow({
  member,
  isMe,
  isLeader,
  voice,
  onKick,
}: {
  member: SessionMemberView;
  isMe: boolean;
  isLeader: boolean;
  voice?: VoiceParticipant;
  onKick?: () => void;
}) {
  const p = member.gameProfile;
  const role = p?.role;
  const level = p?.rank ?? (p?.skillLevel ? SKILL_LEVELS[p.skillLevel] : null);
  return (
    <li className="card flex items-center gap-3 p-3">
      <Link to={`/users/${member.user.id}`} className={clsx('rounded-full', voice?.speaking && !voice.muted && 'speaking-ring')}>
        <Avatar user={member.user} size="lg" availability={member.user.availability} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link to={`/users/${member.user.id}`} className="truncate font-bold text-white hover:underline">
            {member.user.username}
          </Link>
          {isMe && (
            <Tag tone="green" caps>
              Tú
            </Tag>
          )}
          {isLeader && (
            <Tag tone="blue" caps>
              Líder
            </Tag>
          )}
        </div>
        <p className="truncate text-xs">
          {role && <span className="font-semibold text-brand-green">{role}</span>}
          {role && level && <span className="text-slate-600"> · </span>}
          {level && <span className="text-slate-400">{level}</span>}
          {!role && !level && <span className="text-slate-500">Sin rango indicado</span>}
        </p>
      </div>
      {voice && (
        <span className={voice.muted ? 'text-slate-500' : 'text-brand-green'} aria-label={voice.muted ? 'En voz, silenciado' : 'En el canal de voz'}>
          {voice.muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        </span>
      )}
      {onKick && (
        <button onClick={onKick} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-brand-red-soft" aria-label={`Expulsar a ${member.user.username}`}>
          <X className="size-4" />
        </button>
      )}
    </li>
  );
}

function PlayNow({ session }: { session: SessionDetail }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!session.joinInfo) return;
    await navigator.clipboard.writeText(session.joinInfo).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="space-y-3">
      <Button size="lg" className="w-full" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Play className="size-5 fill-current" /> Jugar ahora (listos {session.playersCount}/{session.maxPlayers})
      </Button>
      {open && (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="section-label">Datos para entrar</p>
            <p className="mt-1 text-sm break-words text-slate-200">
              {session.joinInfo ?? `Abre ${session.game.name} en ${PLATFORMS[session.platform]} y busca a ${session.creator.username}.`}
            </p>
          </div>
          {session.joinInfo && (
            <Button variant="secondary" size="sm" onClick={copy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copiado' : 'Copiar'}
            </Button>
          )}
          {session.joinInfo && /^https?:\/\//.test(session.joinInfo) && (
            <a href={session.joinInfo} target="_blank" rel="noreferrer noopener">
              <Button variant="soft" size="sm">
                <ExternalLink className="size-4" /> Abrir
              </Button>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function SessionDetailPage() {
  const { id = '' } = useParams();
  const me = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { chat } = useRealtime();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const key = ['session', id];
  const voice = useVoice({ sessionId: id });

  const { data: s, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api.get<SessionDetail>(`/sessions/${id}`) });
  const isMember = s?.myStatus === 'ACCEPTED';
  const voiceOpen = !!s && VOICE_OPEN.includes(s.status);

  const polled = useQuery({
    queryKey: ['voice-participants', id],
    queryFn: () => api.get<VoiceParticipant[]>(`/voice/sessions/${id}/participants`),
    enabled: isMember && voiceOpen && !voice.connected,
    refetchInterval: 10_000,
  });
  const inVoice = voice.connected ? voice.participants : (polled.data ?? []);

  const pending = useQuery({
    queryKey: ['reviews', 'pending'],
    queryFn: () => api.get<PendingReview[]>('/reviews/pending'),
    enabled: s?.status === 'FINISHED' && isMember,
  });
  const toReview = pending.data?.find((p) => p.session.id === id)?.teammates ?? [];

  useEffect(() => {
    if (!chat) return;
    const refresh = (e: { sessionId: string }) => e.sessionId === id && queryClient.invalidateQueries({ queryKey: key });
    const events = ['member:joined', 'member:left', 'session:cancelled', 'session:status', 'session:removed'];
    events.forEach((ev) => chat.on(ev, refresh));
    return () => events.forEach((ev) => chat.off(ev, refresh));
  }, [chat, id, queryClient]);

  const act = useMutation({
    mutationFn: ({ method, path }: { method: 'post' | 'delete'; path: string }) => (method === 'post' ? api.post(path) : api.delete(path)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
  const run = (method: 'post' | 'delete', path: string) => act.mutate({ method, path });

  if (isLoading) return <Spinner />;
  if (error || !s) {
    return (
      <Card>
        <Empty icon={<Gamepad2 className="size-10" />} title={error instanceof ApiError && error.status === 404 ? 'Esta sesión no existe' : 'No se pudo cargar la sesión'}>
          <Link to="/sessions" className="text-brand-green hover:underline">
            Volver a las sesiones
          </Link>
        </Empty>
      </Card>
    );
  }

  const active = ACTIVE.includes(s.status);
  const started = new Date(s.startsAt).getTime() <= Date.now();
  const canManage = s.isCreator || me.role === 'ADMIN';
  const canInvite = (isMember || s.isCreator) && active;
  const lobbyCode = s.id.replace(/-/g, '').slice(0, 4).toUpperCase();

  const joinAction = () => {
    if (isMember || s.isCreator) return <PlayNow session={s} />;
    if (!active || started) return null;
    switch (s.myStatus) {
      case 'PENDING':
        return (
          <Button size="lg" variant="secondary" className="w-full" onClick={() => run('delete', `/sessions/${id}/leave`)} loading={act.isPending}>
            <X className="size-5" /> Retirar solicitud
          </Button>
        );
      case 'INVITED':
        return (
          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={() => run('post', `/sessions/${id}/join`)} loading={act.isPending}>
              <Check className="size-5" /> Aceptar invitación
            </Button>
            <Button size="lg" variant="secondary" onClick={() => run('delete', `/sessions/${id}/leave`)}>
              Rechazar
            </Button>
          </div>
        );
      case 'REJECTED':
      case 'KICKED':
        return <p className="rounded-xl bg-brand-red/10 p-4 text-center text-sm text-brand-red-soft">{MEMBER_STATUS[s.myStatus]}</p>;
      default:
        return s.status === 'FULL' ? (
          <p className="rounded-xl bg-ink-850 p-4 text-center text-sm text-slate-400">El escuadrón está completo</p>
        ) : (
          <Button size="lg" className="w-full" onClick={() => run('post', `/sessions/${id}/join`)} loading={act.isPending}>
            <UserPlus className="size-5" /> {s.joinMode === 'AUTOMATIC' ? 'Unirme al escuadrón' : 'Solicitar unirme'}
          </Button>
        );
    }
  };

  const cta = (
    <div className="space-y-2">
      {joinAction()}
      <ErrorText>{act.error && errorMessage(act.error)}</ErrorText>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-xl p-2 text-slate-300 ring-1 ring-white/8 hover:bg-white/5" aria-label="Volver">
          <ArrowLeft className="size-5" />
        </button>
        <p className="text-lg font-extrabold text-white">Detalle de sesión</p>
        <div className="ml-auto flex items-center gap-1">
          {canManage && active && (
            <Link to={`/sessions/${id}/edit`} className="rounded-xl p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Editar sesión">
              <Pencil className="size-5" />
            </Link>
          )}
          {!s.isCreator && <ReportButton compact target={{ targetSessionId: id }} label="Reportar sesión" />}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-5">
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone={s.status === 'CANCELLED' ? 'red' : s.status === 'FINISHED' ? 'gray' : 'green'} caps>
                {STATUS_LABEL[s.status]}
              </Tag>
              <span className="text-sm text-slate-300">
                {s.playersCount}/{s.maxPlayers} jugadores
              </span>
              <span className="flex items-center gap-1.5 text-sm text-slate-400" title={fullDate(s.startsAt)}>
                <span className="size-1.5 rounded-full bg-brand-green" /> {sessionTime(s.startsAt)}
              </span>
              <span className="ml-auto flex items-center gap-1.5">
                {s.kind === 'TOURNAMENT' && (
                  <Tag tone="red">
                    <Trophy className="size-3" /> Torneo
                  </Tag>
                )}
                <Tag tone="blue">
                  <Shield className="size-3" /> Sala #{lobbyCode}
                </Tag>
              </span>
            </div>
            <div>
              <p className="text-xs font-bold tracking-wider text-brand-green uppercase">{s.game.name}</p>
              <h1 className="mt-1 text-2xl leading-tight font-extrabold break-words text-white sm:text-3xl">{s.title}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Tag>
                <Shield className="size-3" /> Nivel: {SKILL_LEVELS[s.skillLevel]}
              </Tag>
              {s.micRequired && (
                <Tag>
                  <Mic className="size-3" /> Mic obligatorio
                </Tag>
              )}
              <Tag>
                <Monitor className="size-3" /> {PLATFORMS[s.platform]}
              </Tag>
              {s.language && (
                <Tag>
                  <Languages className="size-3" /> {languageName(s.language)}
                </Tag>
              )}
              {s.mode && <Tag>{s.mode}</Tag>}
              <Tag>
                <Clock className="size-3" /> {JOIN_MODES[s.joinMode]}
              </Tag>
            </div>
            {s.description && <p className="text-sm whitespace-pre-wrap text-slate-300">{s.description}</p>}
            {canManage && active && (
              <div className="flex flex-wrap gap-2 border-t border-white/6 pt-4">
                <Button variant="danger" size="sm" onClick={() => setConfirmCancel(true)}>
                  Cancelar sesión
                </Button>
              </div>
            )}
          </Card>

          <section>
            <SectionTitle action={s.spotsLeft > 0 && active && <span className="text-xs font-bold text-brand-green">{s.spotsLeft === 1 ? 'Falta 1 jugador' : `Faltan ${s.spotsLeft}`}</span>}>
              Escuadrón activo ({s.playersCount}/{s.maxPlayers})
            </SectionTitle>
            <ul className="space-y-2">
              {s.members.map((m) => (
                <MemberRow
                  key={m.user.id}
                  member={m}
                  isMe={m.user.id === me.id}
                  isLeader={m.user.id === s.creator.id}
                  voice={inVoice.find((v) => v.userId === m.user.id)}
                  onKick={canManage && m.user.id !== s.creator.id && active ? () => run('delete', `/sessions/${id}/members/${m.user.id}`) : undefined}
                />
              ))}
              {active &&
                Array.from({ length: s.spotsLeft }).map((_, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-2xl border border-dashed border-white/12 p-3">
                    <span className="flex size-12 items-center justify-center rounded-full bg-white/4 text-slate-500">
                      <UserPlus className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-brand-green">Puesto #{s.playersCount + i + 1} disponible</p>
                      <p className="truncate text-xs text-slate-500">Buscando · {SKILL_LEVELS[s.skillLevel]}</p>
                    </div>
                    {canInvite && (
                      <Button size="sm" variant="secondary" onClick={() => setInviteOpen(true)}>
                        <UserPlus className="size-3.5" /> Invitar
                      </Button>
                    )}
                  </li>
                ))}
            </ul>
          </section>

          {canManage && !!s.pendingRequests?.length && (
            <section>
              <SectionTitle>Solicitudes ({s.pendingRequests.length})</SectionTitle>
              <ul className="space-y-2">
                {s.pendingRequests.map((m) => (
                  <li key={m.user.id} className="card flex items-center gap-3 p-3">
                    <Avatar user={m.user} size="md" availability={m.user.availability} />
                    <div className="min-w-0 flex-1">
                      <Link to={`/users/${m.user.id}`} className="truncate font-bold text-white hover:underline">
                        {m.user.username}
                      </Link>
                      <p className="truncate text-xs text-slate-400">{m.gameProfile?.rank ?? m.gameProfile?.role ?? 'Quiere unirse'}</p>
                    </div>
                    <Button size="sm" onClick={() => run('post', `/sessions/${id}/members/${m.user.id}/accept`)} disabled={s.status === 'FULL'} aria-label={`Aceptar a ${m.user.username}`}>
                      <Check className="size-3.5" /> Aceptar
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => run('post', `/sessions/${id}/members/${m.user.id}/reject`)} aria-label={`Rechazar a ${m.user.username}`}>
                      <X className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {canManage && !!s.invited?.length && (
            <section>
              <SectionTitle>Invitados</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {s.invited.map((m) => (
                  <Link key={m.user.id} to={`/users/${m.user.id}`} className="flex items-center gap-2 rounded-full bg-ink-850 py-1 pr-3 pl-1 text-sm ring-1 ring-white/6">
                    <Avatar user={m.user} size="xs" /> {m.user.username}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="hidden lg:block">{cta}</div>
        </div>

        <aside className="space-y-4">
          {isMember && toReview.length > 0 && (
            <Card className="space-y-3 p-4">
              <h2 id="valorar" className="flex items-center gap-2 font-bold text-white">
                <Star className="size-4 text-brand-gold-soft" /> Valora a tu escuadrón
              </h2>
              {toReview.map((u) => (
                <ReviewForm key={u.id} sessionId={id} user={u} onDone={() => pending.refetch()} />
              ))}
            </Card>
          )}

          {isMember ? (
            <>
              {voiceOpen && <VoiceBar voice={voice} name={`Sala #${lobbyCode}`} count={inVoice.length} />}
              <ChatPanel sessionId={id} members={s.members} readOnly={s.status === 'CANCELLED'} />
              {active && !s.isCreator && (
                <button onClick={() => run('delete', `/sessions/${id}/leave`)} className="flex w-full items-center justify-center gap-2 py-2 text-sm text-slate-500 hover:text-brand-red-soft">
                  <UserMinus className="size-4" /> Salir del escuadrón
                </button>
              )}
            </>
          ) : (
            <Card className="p-5 text-center text-sm text-slate-400">
              <Mic className="mx-auto mb-2 size-6 text-slate-500" />
              El chat de escuadra y el canal de voz se abren al entrar en la sesión.
            </Card>
          )}
        </aside>
      </div>

      <div className="lg:hidden">{cta}</div>

      <InviteModal session={s} open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <Modal open={confirmCancel} onClose={() => setConfirmCancel(false)} title="¿Cancelar la sesión?">
        <p className="mb-5 text-sm text-slate-300">Todos los miembros recibirán un aviso. Esta acción no se puede deshacer.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
            Volver
          </Button>
          <Button
            variant="danger"
            loading={act.isPending}
            onClick={() =>
              act.mutate({ method: 'post', path: `/sessions/${id}/cancel` }, { onSettled: () => setConfirmCancel(false) })
            }
          >
            Sí, cancelar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
