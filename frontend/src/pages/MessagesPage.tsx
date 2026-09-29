import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, MessageCircle, Send } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMe } from '../auth/AuthContext';
import { Avatar, Card, Empty, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import { useFriends } from '../lib/queries';
import type { Conversation, DirectMessage, Profile } from '../lib/types';
import { useRealtime } from '../realtime/RealtimeContext';

type Ack<T> = { ok: true; data?: T } | { ok: false; error: string };

function Thread({ partnerId }: { partnerId: string }) {
  const me = useMe();
  const { chat } = useRealtime();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const key = ['dm', partnerId];

  const { data: partner } = useQuery({ queryKey: ['profile', partnerId], queryFn: () => api.get<Profile>(`/users/${partnerId}`) });
  const { data: messages, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.get<DirectMessage[]>(`/messages/direct/${partnerId}`, { limit: 100 }),
  });

  useEffect(() => {
    if (!messages?.some((m) => m.sender.id === partnerId && !m.readAt)) return;
    void api.post(`/messages/direct/${partnerId}/read`).then(() => queryClient.invalidateQueries({ queryKey: ['conversations'] }));
  }, [messages, partnerId, queryClient]);

  useEffect(() => {
    if (!chat) return;
    const onDm = (m: DirectMessage) => {
      if (m.partnerId !== partnerId) return;
      queryClient.setQueryData<DirectMessage[]>(['dm', partnerId], (old) => (old?.some((x) => x.id === m.id) ? old : [...(old ?? []), m]));
    };
    chat.on('dm:new', onDm);
    return () => {
      chat.off('dm:new', onDm);
    };
  }, [chat, partnerId, queryClient]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || !chat) return;
    setError('');
    setText('');
    const ack: Ack<DirectMessage> = await chat.emitWithAck('dm:send', { toUserId: partnerId, content });
    if (!ack.ok) {
      setError(ack.error);
      setText(content);
    }
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-96 flex-col">
      <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3">
        <Link to="/messages" className="rounded-lg p-1 text-slate-400 hover:text-white md:hidden" aria-label="Volver">
          <ArrowLeft className="size-5" />
        </Link>
        {partner && (
          <Link to={`/users/${partner.id}`} className="flex items-center gap-3">
            <Avatar user={partner} size="sm" availability={partner.availability} />
            <span className="font-semibold text-white">{partner.username}</span>
          </Link>
        )}
      </div>
      <div ref={listRef} className="scrollbar-thin flex-1 space-y-2 overflow-y-auto p-4" aria-live="polite">
        {isLoading ? (
          <Spinner />
        ) : !messages?.length ? (
          <Empty icon={<MessageCircle className="size-8" />} title="Empieza la conversación" />
        ) : (
          messages.map((m) => {
            const mine = m.sender.id === me.id;
            return (
              <div key={m.id} className={clsx('flex', mine && 'justify-end')}>
                <div className={clsx('max-w-[75%]', mine && 'text-right')}>
                  <p
                    className={clsx(
                      'inline-block rounded-2xl px-3 py-2 text-left text-sm break-words whitespace-pre-wrap',
                      mine ? 'rounded-br-sm bg-brand-blue-deep/70 text-white' : 'rounded-bl-sm bg-white/7 text-slate-100',
                    )}
                  >
                    {m.content}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{timeAgo(m.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={send} className="border-t border-white/8 p-3">
        {error && <p className="mb-2 text-xs text-brand-red-soft">{error}</p>}
        <div className="flex gap-2">
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe un mensaje…" maxLength={2000} aria-label="Mensaje" />
          <button disabled={!text.trim()} className="rounded-xl bg-brand-blue-deep px-4 text-white hover:bg-brand-blue-deep/85 disabled:opacity-40" aria-label="Enviar">
            <Send className="size-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

export function MessagesPage() {
  const { userId } = useParams();
  const { data: convs, isLoading } = useQuery({ queryKey: ['conversations'], queryFn: () => api.get<Conversation[]>('/messages/conversations') });
  const { data: friends } = useFriends();
  const withoutConv = friends?.filter((f) => !convs?.some((c) => c.partner.id === f.user.id)) ?? [];

  return (
    <Card className="grid overflow-hidden md:grid-cols-[18rem_1fr]">
      <aside className={clsx('border-r border-white/8', userId && 'hidden md:block')}>
        <h1 className="border-b border-white/8 px-4 py-3.5 font-bold text-white">Mensajes</h1>
        <div className="scrollbar-thin max-h-[calc(100vh-15rem)] overflow-y-auto p-2">
          {isLoading ? (
            <Spinner />
          ) : (
            <>
              {convs?.map((c) => (
                <Link
                  key={c.partner.id}
                  to={`/messages/${c.partner.id}`}
                  className={clsx('flex items-center gap-3 rounded-xl px-3 py-2.5', c.partner.id === userId ? 'bg-white/10' : 'hover:bg-white/5')}
                >
                  <Avatar user={c.partner} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="truncate font-medium text-white">{c.partner.username}</p>
                      <span className="ml-auto shrink-0 text-[11px] text-slate-500">{timeAgo(c.lastMessage.createdAt)}</span>
                    </div>
                    <p className={clsx('truncate text-xs', c.unread ? 'font-semibold text-slate-200' : 'text-slate-400')}>{c.lastMessage.content}</p>
                  </div>
                  {c.unread > 0 && <span className="rounded-full bg-brand-green px-1.5 text-[10px] font-bold text-ink-950">{c.unread}</span>}
                </Link>
              ))}
              {!!withoutConv.length && <p className="px-3 pt-4 pb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Amigos</p>}
              {withoutConv.map((f) => (
                <Link key={f.user.id} to={`/messages/${f.user.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/5">
                  <Avatar user={f.user} size="sm" availability={f.user.availability} />
                  <span className="truncate text-sm">{f.user.username}</span>
                </Link>
              ))}
              {!convs?.length && !friends?.length && (
                <p className="px-3 py-8 text-center text-sm text-slate-400">Agrega amigos para chatear en privado.</p>
              )}
            </>
          )}
        </div>
      </aside>
      <section className={clsx(!userId && 'hidden md:block')}>
        {userId ? (
          <Thread key={userId} partnerId={userId} />
        ) : (
          <Empty icon={<MessageCircle className="size-10" />} title="Elige una conversación">
            Solo puedes escribir en privado a tus amigos.
          </Empty>
        )}
      </section>
    </Card>
  );
}
