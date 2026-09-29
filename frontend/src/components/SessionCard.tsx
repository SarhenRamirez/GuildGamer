import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Clock, Mic, Trophy, UserPlus, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { PLATFORMS, SESSION_STATUS, SESSION_STATUS_STYLE, SKILL_LEVELS, languageName, sessionTime, timeAgo } from '../lib/format';
import type { SessionMemberView, SessionSummary } from '../lib/types';
import { Avatar, Badge, Button, Tag } from './ui';

export function GameCover({ game, className }: { game: { name: string; coverUrl: string | null }; className?: string }) {
  return game.coverUrl ? (
    <img src={game.coverUrl} alt="" className={clsx('object-cover', className)} />
  ) : (
    <div aria-hidden className={clsx('flex items-center justify-center bg-brand-green/12 font-extrabold text-brand-green ring-1 ring-brand-green/20', className)}>
      {game.name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')}
    </div>
  );
}

function SpotsBar({ filled, total }: { filled: number; total: number }) {
  return (
    <div className="flex gap-1" aria-hidden>
      {Array.from({ length: Math.min(total, 10) }).map((_, i) => (
        <span key={i} className={clsx('h-1.5 flex-1 rounded-full', i < filled ? 'bg-brand-green' : 'bg-white/8')} />
      ))}
    </div>
  );
}

export function SessionCard({ session }: { session: SessionSummary }) {
  return (
    <Link to={`/sessions/${session.id}`} className="card group flex flex-col gap-3 p-4 transition hover:border-brand-green/30">
      <div className="flex items-start gap-3">
        <GameCover game={session.game} className="size-12 shrink-0 rounded-xl text-base" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold tracking-wider text-brand-green uppercase">{session.game.name}</p>
          <h3 className="truncate font-bold text-white">{session.title}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="size-3.5" /> {sessionTime(session.startsAt)}
          </p>
        </div>
        {session.status === 'OPEN' ? (
          <Tag tone="green" caps>
            {session.spotsLeft} {session.spotsLeft === 1 ? 'puesto' : 'puestos'}
          </Tag>
        ) : (
          <Badge className={clsx('ring-1', SESSION_STATUS_STYLE[session.status])}>{SESSION_STATUS[session.status]}</Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {session.kind === 'TOURNAMENT' && (
          <Tag tone="red">
            <Trophy className="size-3" /> Torneo
          </Tag>
        )}
        <Tag>{PLATFORMS[session.platform]}</Tag>
        <Tag>{SKILL_LEVELS[session.skillLevel]}</Tag>
        {session.language && <Tag>{languageName(session.language)}</Tag>}
        {session.micRequired && (
          <Tag>
            <Mic className="size-3" /> Micro
          </Tag>
        )}
      </div>
      <div className="mt-auto space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <Avatar user={session.creator} size="xs" />
          <span className="truncate text-slate-400">{session.creator.username}</span>
          <span className="ml-auto flex items-center gap-1 font-semibold text-slate-200">
            <Users className="size-3.5" /> {session.playersCount}/{session.maxPlayers}
          </span>
        </div>
        <SpotsBar filled={session.playersCount} total={session.maxPlayers} />
      </div>
    </Link>
  );
}

export function LfgCard({ session, members }: { session: SessionSummary; members?: SessionMemberView[] }) {
  const queryClient = useQueryClient();
  const join = useMutation({
    mutationFn: () => api.post<{ status: string }>(`/sessions/${session.id}/join`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['session', session.id] });
    },
  });
  const joined = join.data?.status;

  return (
    <article className="card space-y-3 p-4">
      <div className="flex items-start gap-3">
        <GameCover game={session.game} className="size-11 shrink-0 rounded-xl text-sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/sessions/${session.id}`} className="truncate font-bold text-white hover:underline">
              {session.game.name}
            </Link>
            <Tag tone={session.kind === 'TOURNAMENT' ? 'red' : 'blue'}>{session.kind === 'TOURNAMENT' ? 'Torneo' : 'Busca squad'}</Tag>
          </div>
          <p className="text-xs text-slate-500">
            Por @{session.creator.username} · {timeAgo(session.createdAt)}
          </p>
        </div>
        <Tag>{SKILL_LEVELS[session.skillLevel]}</Tag>
      </div>
      <div>
        <h3 className="text-lg leading-snug font-bold text-white">{session.title}</h3>
        {session.description && <p className="mt-1 line-clamp-3 text-sm text-slate-300">{session.description}</p>}
      </div>
      <div className="flex items-center gap-3 rounded-xl bg-ink-850 px-3 py-2.5 text-sm">
        <div className="flex -space-x-2">
          {(members ?? [{ user: session.creator }]).slice(0, 4).map(({ user }) => (
            <Avatar key={user.id} user={user} size="xs" className="rounded-full ring-2 ring-ink-850" />
          ))}
        </div>
        <span className="text-slate-300">
          {session.playersCount}/{session.maxPlayers} listos
        </span>
        <span className="ml-auto flex items-center gap-1.5 font-semibold text-brand-green">
          <Clock className="size-4" /> {sessionTime(session.startsAt)}
        </span>
      </div>
      {joined ? (
        <Link to={`/sessions/${session.id}`}>
          <Button variant="soft" className="w-full">
            {joined === 'ACCEPTED' ? '¡Estás dentro! Ver la sesión' : 'Solicitud enviada · Ver la sesión'}
          </Button>
        </Link>
      ) : (
        <Button className="w-full" size="lg" loading={join.isPending} onClick={() => join.mutate()}>
          <UserPlus className="size-5" /> {session.joinMode === 'AUTOMATIC' ? 'Unirse a la party' : 'Solicitar unirse a la party'}
        </Button>
      )}
      {join.error && <p className="text-sm text-brand-red-soft">{errorMessage(join.error)}</p>}
    </article>
  );
}
