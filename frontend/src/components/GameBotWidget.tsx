import { useMutation } from '@tanstack/react-query';
import { Bot, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

interface BotReply {
  answer: string;
  matched: string | null;
  suggestions: string[];
}

interface Line {
  from: 'user' | 'bot';
  text: string;
  suggestions?: string[];
}

const WELCOME: Line = {
  from: 'bot',
  text: '¡Hola! Soy GameBot 🎮 Pregúntame cómo usar GuildGamer o cualquier duda sobre videojuegos.',
  suggestions: ['¿Cómo creo una sesión?', '¿Qué significa crossplay?', '¿Cómo encuentro jugadores?'],
};

export function GameBotWidget() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([WELCOME]);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const ask = useMutation({
    mutationFn: (question: string) => api.post<BotReply>('/gamebot/ask', { question }),
    onSuccess: (r) => setLines((l) => [...l, { from: 'bot', text: r.answer, suggestions: r.suggestions }]),
    onError: () => setLines((l) => [...l, { from: 'bot', text: 'Ahora mismo no puedo responder. Inténtalo en un momento.' }]),
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines, open]);

  const send = (q: string) => {
    const question = q.trim();
    if (!question || ask.isPending) return;
    setLines((l) => [...l, { from: 'user', text: question }]);
    setText('');
    ask.mutate(question);
  };

  return (
    <>
      {open && (
        <div className="card fixed right-4 bottom-36 z-40 flex h-[28rem] max-h-[calc(100vh-10rem)] w-[22rem] max-w-[calc(100vw-2rem)] flex-col shadow-2xl shadow-black/50 lg:bottom-24">
          <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
            <Bot className="size-5 text-brand-green" />
            <p className="font-semibold text-white">GameBot</p>
            <span className="text-xs text-slate-500">· ayuda</span>
            <button onClick={() => setOpen(false)} className="ml-auto text-slate-400 hover:text-white" aria-label="Cerrar GameBot">
              <X className="size-5" />
            </button>
          </div>
          <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {lines.map((line, i) => (
              <div key={i} className={line.from === 'user' ? 'flex justify-end' : ''}>
                <p
                  className={
                    line.from === 'user'
                      ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-brand-blue-deep/60 px-3 py-2 text-sm text-white'
                      : 'max-w-[90%] rounded-2xl rounded-bl-sm bg-white/6 px-3 py-2 text-sm text-slate-200'
                  }
                >
                  {line.text}
                </p>
                {line.suggestions && i === lines.length - 1 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {line.suggestions.map((s) => (
                      <button key={s} onClick={() => send(s)} className="rounded-full bg-brand-green/10 px-2.5 py-1 text-xs text-brand-green ring-1 ring-brand-green/25 hover:bg-brand-green/20">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {ask.isPending && <p className="text-xs text-slate-500">GameBot está escribiendo…</p>}
            <div ref={endRef} />
          </div>
          <form
            className="flex gap-2 border-t border-white/8 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
          >
            <input className="input py-2" value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe tu pregunta…" maxLength={500} aria-label="Pregunta para GameBot" />
            <button className="rounded-xl bg-brand-green/15 px-3 text-brand-green hover:bg-brand-green/25" aria-label="Enviar">
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed right-4 bottom-20 z-40 flex size-13 items-center justify-center rounded-full bg-brand-blue-deep text-white shadow-lg shadow-black/40 transition hover:bg-brand-blue-deep/85 lg:bottom-6"
        aria-label={open ? 'Cerrar GameBot' : 'Abrir GameBot'}
      >
        {open ? <X className="size-6" /> : <Bot className="size-6" />}
      </button>
    </>
  );
}
