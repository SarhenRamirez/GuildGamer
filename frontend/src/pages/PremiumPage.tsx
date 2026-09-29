import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Crown } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, ErrorText, PageHeader, Spinner } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { fullDate, money } from '../lib/format';
import type { Plans, SubscriptionInfo } from '../lib/types';

const FREE = ['Perfil gamer', 'Crear y unirte a sesiones', 'Chat de texto y canal de voz', 'Amigos, mensajes y publicaciones'];
const PAYMENT_STATUS: Record<string, string> = { PENDING: 'Pendiente', SUCCEEDED: 'Pagado', FAILED: 'Fallido', REFUNDED: 'Reembolsado' };

export function PremiumPage() {
  const { refresh } = useAuth();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api.get<Plans>('/payments/plans') });
  const sub = useQuery({ queryKey: ['subscription'], queryFn: () => api.get<SubscriptionInfo>('/payments/subscription') });

  const checkout = useMutation({
    mutationFn: () => api.post<{ checkoutUrl: string }>('/payments/checkout'),
    onSuccess: ({ checkoutUrl }) => window.location.assign(checkoutUrl),
  });
  const cancel = useMutation({
    mutationFn: () => api.post('/payments/cancel'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['subscription'] });
      await refresh();
    },
  });

  if (plans.isLoading || sub.isLoading) return <Spinner />;
  const premium = plans.data?.premium;
  const info = sub.data;
  const active = info?.isPremium;
  const cancelled = info?.subscription?.status === 'CANCELLED';

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="GuildGamer Premium" subtitle="Destaca en la comunidad y organiza torneos." />
      {params.get('status') === 'success' && (
        <p className="mb-6 rounded-xl bg-brand-green/10 px-4 py-3 text-sm text-brand-green ring-1 ring-brand-green/20">¡Pago completado! Tus ventajas Premium ya están activas.</p>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-bold text-white">Gratis</h2>
          <p className="mt-1 mb-5 text-3xl font-extrabold text-white">0 €</p>
          <ul className="space-y-2.5">
            {FREE.map((f) => (
              <li key={f} className="flex gap-2 text-sm text-slate-300">
                <Check className="size-4 shrink-0 text-brand-green" /> {f}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="relative overflow-hidden border-brand-gold/40 p-6">
          <div className="relative">
            <h2 className="flex items-center gap-2 text-lg font-bold text-brand-gold-soft">
              <Crown className="size-5" /> Premium
              {active && <Badge className="bg-brand-green/15 text-brand-green ring-brand-green/30">Activo</Badge>}
            </h2>
            {premium && (
              <p className="mt-1 mb-5 text-3xl font-extrabold text-white">
                {money(premium.priceCents, premium.currency)} <span className="text-sm font-normal text-slate-400">/ {premium.intervalDays} días</span>
              </p>
            )}
            <ul className="mb-6 space-y-2.5">
              {premium?.features.map((f) => (
                <li key={f} className="flex gap-2 text-sm text-slate-200">
                  <Check className="size-4 shrink-0 text-brand-gold-soft" /> {f}
                </li>
              ))}
            </ul>
            {active && info?.subscription?.currentPeriodEnd ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-300">
                  {cancelled ? 'Cancelado: sigues siendo Premium hasta el' : 'Premium activo hasta el'} {fullDate(info.subscription.currentPeriodEnd)}.
                </p>
                {cancelled ? (
                  <Button className="w-full" loading={checkout.isPending} onClick={() => checkout.mutate()}>
                    Renovar Premium
                  </Button>
                ) : (
                  <Button variant="secondary" className="w-full" loading={cancel.isPending} onClick={() => cancel.mutate()}>
                    Cancelar suscripción
                  </Button>
                )}
              </div>
            ) : (
              <Button className="w-full" loading={checkout.isPending} onClick={() => checkout.mutate()}>
                <Crown className="size-4" /> Hazte Premium
              </Button>
            )}
            <ErrorText>{(checkout.error || cancel.error) && errorMessage(checkout.error ?? cancel.error)}</ErrorText>
            {plans.data?.provider === 'mock' && <p className="mt-3 text-xs text-slate-500">Entorno de pruebas: el pago es simulado y no se cobra nada.</p>}
          </div>
        </Card>
      </div>

      {!!info?.payments.length && (
        <Card className="mt-6 p-5">
          <h2 className="mb-3 font-bold text-white">Historial de pagos</h2>
          <ul className="divide-y divide-white/5 text-sm">
            {info.payments.map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <span className="text-slate-400">{fullDate(p.createdAt)}</span>
                <span className="text-slate-200">
                  {money(p.amountCents, p.currency)} · {PAYMENT_STATUS[p.status] ?? p.status}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
