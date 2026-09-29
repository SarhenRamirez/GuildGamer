import clsx from 'clsx';
import { Headphones, HeadphoneOff, Keyboard, Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react';
import { Avatar, Button, ErrorText } from '../components/ui';
import { useVoice } from './useVoice';

export function VoicePanel({ target, title }: { target: { sessionId: string } | { roomId: string }; title?: string }) {
  const v = useVoice(target);

  const control = (active: boolean) =>
    clsx('flex size-11 items-center justify-center rounded-full transition', active ? 'bg-brand-red/20 text-brand-red-soft ring-1 ring-brand-red/40' : 'bg-white/8 text-slate-200 hover:bg-white/14');

  return (
    <div className="p-4">
      {title && <p className="mb-3 text-sm font-semibold text-white">{title}</p>}
      {!v.connected ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand-green/10 ring-1 ring-brand-green/30">
            <Volume2 className="size-6 text-brand-green" />
          </span>
          <p className="text-sm text-slate-400">Habla con tu grupo mientras juegan. Tu navegador te pedirá acceso al micrófono.</p>
          <Button onClick={v.join} loading={v.connecting}>
            Entrar al canal de voz
          </Button>
          <ErrorText>{v.error}</ErrorText>
        </div>
      ) : (
        <>
          <ul className="mb-5 grid grid-cols-3 gap-3 sm:grid-cols-4" aria-label="Participantes de voz">
            {v.participants.map((p) => (
              <li key={p.socketId} className="flex flex-col items-center gap-1.5 text-center">
                <span className={clsx('rounded-full', p.speaking && !p.muted && 'speaking-ring')}>
                  <Avatar user={{ username: p.username, avatarUrl: null }} size="md" />
                </span>
                <span className="w-full truncate text-xs text-slate-300">
                  {p.username}
                  {p.socketId === v.selfId && ' (tú)'}
                </span>
                <span className="flex gap-1 text-slate-500">
                  {p.muted && <MicOff className="size-3" aria-label="Silenciado" />}
                  {p.deafened && <HeadphoneOff className="size-3" aria-label="Ensordecido" />}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-center gap-3">
            <button onClick={v.toggleMute} className={control(v.muted)} aria-pressed={v.muted} aria-label={v.muted ? 'Activar micrófono' : 'Silenciar micrófono'} title="Silenciar">
              {v.muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </button>
            <button onClick={v.toggleDeafen} className={control(v.deafened)} aria-pressed={v.deafened} aria-label={v.deafened ? 'Volver a oír' : 'Ensordecer'} title="Ensordecer">
              {v.deafened ? <HeadphoneOff className="size-5" /> : <Headphones className="size-5" />}
            </button>
            <button
              onClick={v.togglePushToTalk}
              className={clsx(control(false), v.pushToTalk && 'bg-brand-green/20 text-brand-green ring-1 ring-brand-green/40')}
              aria-pressed={v.pushToTalk}
              aria-label="Presionar para hablar"
              title="Presionar para hablar (mantén presionada la V)"
            >
              <Keyboard className="size-5" />
            </button>
            <button onClick={v.leave} className="flex size-11 items-center justify-center rounded-full bg-brand-red-deep text-white hover:bg-brand-red" aria-label="Salir del canal de voz" title="Salir">
              <PhoneOff className="size-5" />
            </button>
          </div>
          {v.pushToTalk && <p className="mt-3 text-center text-xs text-slate-400">Presionar para hablar activo: mantén presionada la tecla V.</p>}
          <ErrorText>{v.error}</ErrorText>
        </>
      )}
    </div>
  );
}
