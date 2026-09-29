import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Flame, Heart, MessageSquare, Play, Share2, Trash2, Trophy, Video, X } from 'lucide-react';
import { Fragment, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMe } from '../auth/AuthContext';
import { ReportButton } from '../components/ReportButton';
import { GameCover, LfgCard } from '../components/SessionCard';
import { Avatar, Button, Card, Empty, ErrorText, PageHeader, PillTabs, Select, Spinner, Tag } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { timeAgo } from '../lib/format';
import { useGames } from '../lib/queries';
import type { Post, PostComment, PostKind, SessionSummary, UploadedFile } from '../lib/types';

type Tab = 'all' | 'friends' | PostKind;

const KIND_META: Record<Exclude<PostKind, 'GENERAL'>, { label: string; icon: typeof Video; tone: string }> = {
  CLIP: { label: 'Clip', icon: Video, tone: 'text-brand-green' },
  ACHIEVEMENT: { label: 'Logro', icon: Trophy, tone: 'text-brand-gold-soft' },
  DEBATE: { label: 'Debate', icon: Flame, tone: 'text-brand-red' },
};

function Composer({ onPosted }: { onPosted: () => void }) {
  const me = useMe();
  const { data: games } = useGames();
  const [content, setContent] = useState('');
  const [kind, setKind] = useState<PostKind>('GENERAL');
  const [gameId, setGameId] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: (file: File) => api.upload<UploadedFile>('/files', file),
    onSuccess: (f) => setFiles((cur) => [...cur, f]),
  });
  const publish = useMutation({
    mutationFn: () =>
      api.post('/posts', {
        content: content.trim() || undefined,
        kind,
        gameId: gameId || undefined,
        fileIds: files.map((f) => f.id),
      }),
    onSuccess: () => {
      setContent('');
      setFiles([]);
      setKind('GENERAL');
      onPosted();
    },
  });

  const toggleKind = (k: PostKind) => {
    setKind((cur) => (cur === k ? 'GENERAL' : k));
    if (k === 'CLIP') inputRef.current?.click();
  };

  const chip = (k: Exclude<PostKind, 'GENERAL'>, text: string) => {
    const { icon: Icon, tone } = KIND_META[k];
    const on = kind === k;
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => toggleKind(k)}
        className={clsx(
          'flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ring-1 transition',
          on ? 'bg-white/8 text-white ring-white/20' : 'bg-ink-850 text-slate-300 ring-white/6 hover:text-white',
        )}
      >
        <Icon className={clsx('size-4', tone)} /> {text}
      </button>
    );
  };

  return (
    <Card className="space-y-3 p-3.5">
      <div className="flex items-start gap-3">
        <Avatar user={me} size="md" availability={me.availability} />
        <textarea
          rows={content ? 3 : 1}
          maxLength={2000}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Comparte una jugada, clip o logro…"
          aria-label="Nueva publicación"
          className="input min-h-10 flex-1 resize-none"
        />
      </div>
      {!!files.length && (
        <div className="flex flex-wrap gap-2 pl-13">
          {files.map((f) => (
            <div key={f.id} className="relative">
              {f.mimeType.startsWith('video') ? (
                <video src={f.url} className="h-20 rounded-lg" muted />
              ) : (
                <img src={f.url} alt="" className="h-20 rounded-lg object-cover" />
              )}
              <button
                onClick={() => setFiles(files.filter((x) => x.id !== f.id))}
                className="absolute -top-2 -right-2 rounded-full bg-ink-800 p-0.5 ring-1 ring-white/20"
                aria-label="Quitar archivo"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) upload.mutate(e.target.files[0]);
          e.target.value = '';
        }}
      />
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
        {chip('CLIP', upload.isPending ? 'Subiendo…' : 'Subir clip')}
        {chip('ACHIEVEMENT', 'Presumir logro')}
        {chip('DEBATE', 'Debate')}
      </div>
      <div className="flex items-center gap-2">
        <Select
          aria-label="Juego"
          className="max-w-48 py-2 text-xs"
          placeholder="Sin juego"
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          options={(games ?? []).map((g) => [g.id, g.name] as [string, string])}
        />
        <Button className="ml-auto shrink-0" size="sm" loading={publish.isPending} disabled={!content.trim() && !files.length} onClick={() => publish.mutate()}>
          Publicar
        </Button>
      </div>
      <ErrorText>{(upload.error || publish.error) && errorMessage(upload.error ?? publish.error)}</ErrorText>
    </Card>
  );
}

function Comments({ post }: { post: Post }) {
  const me = useMe();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const key = ['comments', post.id];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => api.get<PostComment[]>(`/posts/${post.id}/comments`) });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ['posts'] });
  };
  const add = useMutation({
    mutationFn: () => api.post(`/posts/${post.id}/comments`, { content: text }),
    onSuccess: () => {
      setText('');
      refresh();
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/posts/${post.id}/comments/${id}`), onSuccess: refresh });

  return (
    <div className="space-y-3 border-t border-white/6 pt-3">
      {isLoading ? (
        <Spinner className="py-4" />
      ) : (
        data?.map((c) => (
          <div key={c.id} className="group flex gap-2.5 rounded-xl bg-ink-850 p-3 text-sm">
            <Avatar user={c.author} size="xs" />
            <div className="min-w-0 flex-1">
              <p>
                <span className="font-bold text-white">{c.author.username}</span>{' '}
                <span className="text-xs text-slate-500">· {timeAgo(c.createdAt)}</span>
              </p>
              <p className="text-slate-300">{c.content}</p>
            </div>
            {(c.author.id === me.id || post.author.id === me.id || me.role === 'ADMIN') && (
              <button onClick={() => remove.mutate(c.id)} className="self-start text-slate-600 opacity-0 group-hover:opacity-100 hover:text-brand-red-soft focus:opacity-100" aria-label="Borrar comentario">
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        ))
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) add.mutate();
        }}
      >
        <input className="input py-2" placeholder="Escribe un comentario…" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} aria-label="Comentario" />
        <Button size="sm" type="submit" loading={add.isPending} disabled={!text.trim()}>
          Enviar
        </Button>
      </form>
    </div>
  );
}

function Media({ files }: { files: Post['files'] }) {
  if (!files.length) return null;
  return (
    <div className={clsx('grid gap-1.5 overflow-hidden rounded-xl', files.length > 1 && 'grid-cols-2')}>
      {files.map((f) =>
        f.mimeType.startsWith('video') ? (
          <div key={f.id} className="relative">
            <video src={f.url} controls preload="metadata" className="max-h-[28rem] w-full bg-black" />
          </div>
        ) : (
          <a key={f.id} href={f.url} target="_blank" rel="noreferrer">
            <img src={f.url} alt="" loading="lazy" className="max-h-[28rem] w-full object-cover" />
          </a>
        ),
      )}
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const me = useMe();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [shared, setShared] = useState(false);
  const like = useMutation({
    mutationFn: () =>
      post.likedByMe
        ? api.delete<{ likeCount: number; likedByMe: boolean }>(`/posts/${post.id}/like`)
        : api.post<{ likeCount: number; likedByMe: boolean }>(`/posts/${post.id}/like`),
    onSuccess: (state) =>
      queryClient.setQueriesData<Post[]>({ queryKey: ['posts'] }, (old) => old?.map((p) => (p.id === post.id ? { ...p, ...state } : p))),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/posts/${post.id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),
  });

  const share = async () => {
    const url = `${window.location.origin}/feed#${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: 'GuildGamer', text: post.content ?? undefined, url });
      else await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
    }
  };

  const meta = post.kind !== 'GENERAL' ? KIND_META[post.kind] : null;

  return (
    <article id={post.id} className="card space-y-3 p-4">
      <header className="flex items-start gap-3">
        <Link to={`/users/${post.author.id}`}>
          <Avatar user={post.author} size="lg" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/users/${post.author.id}`} className="truncate font-bold text-white hover:underline">
              {post.author.username}
            </Link>
            {post.authorRank && (
              <Tag tone="green" caps>
                {post.authorRank}
              </Tag>
            )}
          </div>
          <p className="text-xs text-slate-500">
            @{post.author.username} · {timeAgo(post.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {post.game && <Tag>{post.game.name}</Tag>}
          {meta && (
            <span className={clsx('flex items-center gap-1 text-[11px] font-semibold', meta.tone)}>
              <meta.icon className="size-3.5" /> {meta.label}
            </span>
          )}
        </div>
      </header>

      {post.content && <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-slate-200">{post.content}</p>}

      {post.kind === 'ACHIEVEMENT' && (
        <div className="flex items-center gap-3 rounded-xl bg-ink-850 p-3.5 ring-1 ring-white/6">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-green/12 text-brand-green">
            <Trophy className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-extrabold text-white">{post.authorRank ?? 'Logro desbloqueado'}</p>
            <p className="truncate text-xs text-slate-400">{post.game ? post.game.name : 'Logro de la comunidad'}</p>
          </div>
          {post.game && <GameCover game={{ name: post.game.name, coverUrl: null }} className="size-10 shrink-0 rounded-lg text-xs" />}
        </div>
      )}

      <Media files={post.files} />

      <footer className="flex items-center gap-1 text-sm text-slate-400">
        <button
          onClick={() => like.mutate()}
          aria-pressed={post.likedByMe}
          aria-label={post.likedByMe ? 'Quitar me gusta' : 'Me gusta'}
          className={clsx('flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-white/5', post.likedByMe && 'text-brand-red')}
        >
          <Heart className={clsx('size-[18px]', post.likedByMe && 'fill-current')} /> <span className="tabular-nums">{post.likeCount}</span>
        </button>
        <button
          onClick={() => setShowComments((s) => !s)}
          aria-expanded={showComments}
          aria-label="Comentarios"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-white/5"
        >
          <MessageSquare className="size-[18px]" /> <span className="tabular-nums">{post.commentCount}</span>
        </button>
        <div className="ml-auto flex items-center gap-1">
          {post.author.id !== me.id && <ReportButton compact target={{ targetPostId: post.id }} label="Reportar publicación" />}
          {(post.author.id === me.id || me.role === 'ADMIN') && (
            <button onClick={() => remove.mutate()} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-brand-red-soft" aria-label="Borrar publicación">
              <Trash2 className="size-4" />
            </button>
          )}
          <button onClick={share} className="flex items-center gap-1 rounded-lg p-1.5 hover:bg-white/5 hover:text-white" aria-label="Compartir">
            <Share2 className="size-[18px]" />
            {shared && <span className="text-xs text-brand-green">Enlace copiado</span>}
          </button>
        </div>
      </footer>

      {showComments && <Comments post={post} />}
    </article>
  );
}

export function FeedPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('all');
  const query =
    tab === 'all' ? { feed: 'all' } : tab === 'friends' ? { feed: 'friends' } : { feed: 'all', kind: tab };
  const { data, isLoading } = useQuery({
    queryKey: ['posts', tab],
    queryFn: () => api.get<Post[]>('/posts', { ...query, limit: 30 }),
  });
  const { data: lfg } = useQuery({
    queryKey: ['sessions', 'recommended'],
    queryFn: () => api.get<SessionSummary[]>('/sessions/recommended'),
    enabled: tab === 'all',
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Comunidad" subtitle="Capturas, clips épicos y logros de la guild en vivo" />
      <Composer onPosted={() => queryClient.invalidateQueries({ queryKey: ['posts'] })} />
      <PillTabs<Tab>
        label="Filtrar publicaciones"
        value={tab}
        onChange={setTab}
        tabs={[
          ['all', 'Para ti'],
          ['friends', 'Amigos'],
          ['CLIP', 'Clips destacados'],
          ['ACHIEVEMENT', 'Logros'],
          ['DEBATE', 'Debates'],
        ]}
      />
      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <Card>
          <Empty icon={<Play className="size-10" />} title="Aún no hay publicaciones aquí">
            ¡Sé el primero en compartir algo!
          </Empty>
        </Card>
      ) : (
        data.map((p, i) => (
          <Fragment key={p.id}>
            <PostCard post={p} />
            {tab === 'all' && lfg && (i === 1 || i === 5) && lfg[i === 1 ? 0 : 1] && <LfgCard session={lfg[i === 1 ? 0 : 1]} />}
          </Fragment>
        ))
      )}
      {!isLoading && !data?.length && tab === 'all' && lfg?.[0] && <LfgCard session={lfg[0]} />}
    </div>
  );
}
