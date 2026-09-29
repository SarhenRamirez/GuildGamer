import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { MessageSquare, Send } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMe } from '../auth/AuthContext';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import type { ChatMessage, SessionMemberView } from '../lib/types';
import { useRealtime } from '../realtime/RealtimeContext';
import { ReportButton } from './ReportButton';
import { Empty, Spinner } from './ui';

type Ack<T = void> = { ok: true; data?: T } | { ok: false; error: string };

export function ChatPanel({ sessionId, members, readOnly }: { sessionId: string; members: SessionMemberView[]; readOnly?: boolean }) {
  const me = useMe();
  const { chat } = useRealtime();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [typing, setTyping] = useState<Record<string, number>>({});
  const listRef = useRef<HTMLDivElement>(null);
  const lastTypingSent = useRef(0);
  const key = ['messages', sessionId];

  const { data: messages, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.get<ChatMessage[]>(`/sessions/${sessionId}/messages`, { limit: 100 }),
  });

  useEffect(() => {
    if (!chat) return;
    const join = () => chat.emit('session:join', { sessionId });
    join();
    chat.on('connect', join);

    const onMessage = (m: ChatMessage) => {
      if (m.sessionId !== sessionId) return;
      queryClient.setQueryData<ChatMessage[]>(key, (old) => (old?.some((x) => x.id === m.id) ? old : [...(old ?? []), m]));
      setTyping((t) => {
        const { [m.sender.id]: _, ...rest } = t;
        return rest;
      });
    };
    const onTyping = (e: { sessionId: string; userId: string }) => {
      if (e.sessionId === sessionId) setTyping((t) => ({ ...t, [e.userId]: Date.now() }));
    };
    chat.on('message:new', onMessage);
    chat.on('typing', onTyping);
    return () => {
      chat.emit('session:leave', { sessionId });
      chat.off('connect', join);
      chat.off('message:new', onMessage);
      chat.off('typing', onTyping);
    };
  }, [chat, sessionId, queryClient]);

  useEffect(() => {
    const t = setInterval(() => setTyping((cur) => Object.fromEntries(Object.entries(cur).filter(([, at]) => Date.now() - at < 3000))), 1000);
    return () => clearInterval(t);
  }, []);

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
    const ack: Ack<ChatMessage> = await chat.emitWithAck('message:send', { sessionId, content });
    if (!ack.ok) {
      setError(ack.error);
      setText(content);
    }
  };

  const onType = (v: string) => {
    setText(v);
    if (chat && Date.now() - lastTypingSent.current > 2000) {
      lastTypingSent.current = Date.now();
      chat.emit('typing', { sessionId });
    }
  };

  const typingNames = Object.keys(typing)
    .filter((id) => id !== me.id)
    .map((id) => members.find((m) => m.user.id === id)?.user.username)
    .filter(Boolean);

  return (
    <div className="card flex h-[26rem] flex-col overflow-hidden lg:h-[30rem]">
      <div className="flex items-center gap-2 border-b border-white/6 px-4 py-3">
        <MessageSquare className="size-4 text-brand-green" />
        <h2 className="section-label flex-1">Chat de escuadra</h2>
        {!readOnly && <span className="text-xs font-semibold text-brand-green">En directo</span>}
      </div>
      <div ref={listRef} className="scrollbar-thin flex-1 space-y-1.5 overflow-y-auto px-4 py-3" aria-live="polite">
        {isLoading ? (
          <Spinner />
        ) : !messages?.length ? (
          <Empty icon={<MessageSquare className="size-8" />} title="Aún no hay mensajes">
            Saluda al grupo y coordinen la partida.
          </Empty>
        ) : (
          messages.map((m) => {
            const mine = m.sender.id === me.id;
            return (
              <div key={m.id} className="group flex items-start gap-2 rounded-lg px-2 py-1 text-sm hover:bg-white/3">
                <p className="min-w-0 flex-1 break-words whitespace-pre-wrap text-slate-200">
                  <span className={clsx('font-bold', mine ? 'text-brand-green' : 'text-white')}>{m.sender.username}:</span> {m.content}
                </p>
                <span className="shrink-0 pt-0.5 text-[11px] text-slate-600" title={timeAgo(m.createdAt)}>
                  {new Date(m.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {!mine && (
                  <span className="opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                    <ReportButton compact target={{ targetMessageId: m.id }} label="Reportar mensaje" />
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
      <p className="h-5 px-4 text-xs text-slate-500">{typingNames.length ? `${typingNames.join(', ')} está escribiendo…` : ''}</p>
      {readOnly ? (
        <p className="border-t border-white/6 p-4 text-center text-sm text-slate-500">El chat está cerrado.</p>
      ) : (
        <form onSubmit={send} className="border-t border-white/6 p-3">
          {error && <p className="mb-2 text-xs text-brand-red-soft">{error}</p>}
          <div className="flex gap-2">
            <input
              className="input py-2"
              value={text}
              onChange={(e) => onType(e.target.value)}
              placeholder="Escribe al equipo…"
              maxLength={2000}
              aria-label="Mensaje para el grupo"
            />
            <button disabled={!text.trim()} className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-brand-green ring-1 ring-white/8 hover:bg-ink-700 disabled:opacity-40" aria-label="Enviar">
              <Send className="size-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
