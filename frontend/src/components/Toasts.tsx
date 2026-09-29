import { Bell, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AppNotification } from '../lib/types';

export function notificationLink(n: AppNotification) {
  if (n.data?.sessionId) return `/sessions/${n.data.sessionId}`;
  if (n.data?.postId) return `/feed#${n.data.postId}`;
  if (n.type === 'NEW_MESSAGE' && n.data?.userId) return `/messages/${n.data.userId}`;
  if (n.type.startsWith('FRIEND')) return '/friends';
  if (n.type === 'PREMIUM_ACTIVATED') return '/premium';
  return '/notifications';
}

export function Toasts({ toasts, onDismiss }: { toasts: AppNotification[]; onDismiss: (id: string) => void }) {
  const navigate = useNavigate();
  return (
    <div className="pointer-events-none fixed top-20 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
      {toasts.map((n) => (
        <div key={n.id} className="card animate-toast pointer-events-auto flex gap-3 p-3.5 shadow-2xl shadow-black/40">
          <Bell className="mt-0.5 size-4 shrink-0 text-brand-green" aria-hidden />
          <button
            className="min-w-0 flex-1 text-left"
            onClick={() => {
              onDismiss(n.id);
              navigate(notificationLink(n));
            }}
          >
            <p className="text-sm font-semibold text-white">{n.title}</p>
            {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{n.body}</p>}
          </button>
          <button onClick={() => onDismiss(n.id)} className="self-start text-slate-500 hover:text-white" aria-label="Cerrar aviso">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
