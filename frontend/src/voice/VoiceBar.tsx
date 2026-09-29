import clsx from 'clsx';
import { Headphones, HeadphoneOff, Keyboard, Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react';
import { Button } from '../components/ui';
import type { useVoice } from './useVoice';

type Voice = ReturnType<typeof useVoice>;

export function VoiceBar({ voice, name, count }: { voice: Voice; name: string; count: number }) {
  const control = (active: boolean, danger?: boolean) =>
    clsx(
      'flex size-9 items-center justify-center rounded-lg ring-1 transition',
      danger
        ? 'bg-brand-red-deep text-white ring-brand-red/40 hover:bg-brand-red'
        : active
          ? 'bg-brand-red/15 text-brand-red-soft ring-brand-red/30'
          : 'bg-ink-800 text-brand-green ring-white/8 hover:text-white',
    );

  return (
    <div className="card p-3">
      <div className="flex items-center gap-3">
        <span className={clsx('size-2 shrink-0 rounded-full', voice.connected ? 'bg-brand-green' : 'bg-slate-500')} />
        <p className="min-w-0 flex-1 truncate text-xs font-bold tracking-wider text-slate-300 uppercase">
          Voz: {name} <span className="text-slate-500">({count} conectados)</span>
        </p>
        {voice.connected ? (
          <div className="flex gap-1.5">
            <button onClick={voice.toggleMute} className={control(voice.muted)} aria-pressed={voice.muted} aria-label={voice.muted ? 'Activar micrófono' : 'Silenciar micrófono'}>
              {voice.muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </button>
            <button onClick={voice.toggleDeafen} className={control(voice.deafened)} aria-pressed={voice.deafened} aria-label={voice.deafened ? 'Volver a oír' : 'Ensordecer'}>
              {voice.deafened ? <HeadphoneOff className="size-4" /> : <Headphones className="size-4" />}
            </button>
            <button
              onClick={voice.togglePushToTalk}
              className={clsx(control(false), voice.pushToTalk && 'bg-brand-green/15 ring-brand-green/30')}
              aria-pressed={voice.pushToTalk}
              aria-label="Presionar para hablar (mantén presionada la V)"
              title="Presionar para hablar (mantén presionada la V)"
            >
              <Keyboard className="size-4" />
            </button>
            <button onClick={voice.leave} className={control(false, true)} aria-label="Salir del canal de voz">
              <PhoneOff className="size-4" />
            </button>
          </div>
        ) : (
          <Button size="sm" variant="soft" loading={voice.connecting} onClick={voice.join}>
            <Volume2 className="size-4" /> Unirse
          </Button>
        )}
      </div>
      {voice.pushToTalk && voice.connected && <p className="mt-2 text-xs text-slate-400">Mantén presionada la tecla V para hablar.</p>}
      {voice.error && <p className="mt-2 text-xs text-brand-red-soft">{voice.error}</p>}
    </div>
  );
}
