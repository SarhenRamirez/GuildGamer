import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationLink } from '../components/Toasts';
import { Button, Card, Empty, PageHeader, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import type { AppNotification } from '../lib/types';

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => api.get<AppNotification[]>('/notifications', { limit: 50 }),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
  const readAll = useMutation({ mutationFn: () => api.post('/notifications/read-all'), onSuccess: refresh });
  const readOne = useMutation({ mutationFn: (id: string) => api.patch(`/notifications/${id}/read`), onSuccess: refresh });
  const unread = data?.filter((n) => !n.readAt).length ?? 0;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Notificaciones"
        subtitle={unread ? `${unread} sin leer` : 'Estás al día'}
        action={
          unread > 0 && (
            <Button variant="secondary" loading={readAll.isPending} onClick={() => readAll.mutate()}>
              <CheckCheck className="size-4" /> Marcar todas como leídas
            </Button>
          )
        }
      />
      <Card className="divide-y divide-white/5">
        {isLoading ? (
          <Spinner />
        ) : !data?.length ? (
          <Empty icon={<Bell className="size-10" />} title="No tienes notificaciones">
            Aquí verás solicitudes, recordatorios de sesiones y más.
          </Empty>
        ) : (
          data.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                if (!n.readAt) readOne.mutate(n.id);
                navigate(notificationLink(n));
              }}
              className={clsx('flex w-full gap-3 px-5 py-4 text-left transition hover:bg-white/4', !n.readAt && 'bg-brand-blue/5')}
            >
              <span className={clsx('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-brand-green')} aria-label={n.readAt ? undefined : 'Sin leer'} />
              <div className="min-w-0 flex-1">
                <p className={clsx('text-sm', n.readAt ? 'text-slate-300' : 'font-semibold text-white')}>{n.title}</p>
                {n.body && <p className="mt-0.5 text-sm text-slate-400">{n.body}</p>}
                <p className="mt-1 text-xs text-slate-500">{timeAgo(n.createdAt)}</p>
              </div>
            </button>
          ))
        )}
      </Card>
    </div>
  );
}
