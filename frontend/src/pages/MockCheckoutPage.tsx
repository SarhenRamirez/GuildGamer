import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, FlaskConical } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, ErrorText } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { money } from '../lib/format';
import type { Plans } from '../lib/types';

export function MockCheckoutPage() {
  const { paymentId = '' } = useParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const queryClient = useQueryClient();
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api.get<Plans>('/payments/plans') });

  const simulate = useMutation({
    mutationFn: (outcome: 'success' | 'failure') => api.post(`/payments/${paymentId}/simulate`, { outcome }),
    onSuccess: async (_d, outcome) => {
      await queryClient.invalidateQueries({ queryKey: ['subscription'] });
      await refresh();
      navigate(outcome === 'success' ? '/premium?status=success' : '/premium', { replace: true });
    },
  });

  const premium = plans.data?.premium;
  return (
    <div className="mx-auto max-w-md pt-6">
      <Card className="p-6">
        <div className="mb-5 flex items-center gap-2 rounded-xl bg-brand-gold/10 px-3 py-2 text-xs text-brand-gold-soft ring-1 ring-brand-gold/20">
          <FlaskConical className="size-4 shrink-0" /> Pasarela de pruebas: elige el resultado del pago. No se cobra nada.
        </div>
        <h1 className="text-xl font-bold text-white">Pago de GuildGamer Premium</h1>
        {premium && (
          <p className="mt-1 text-sm text-slate-400">
            {money(premium.priceCents, premium.currency)} por {premium.intervalDays} días
          </p>
        )}
        <div className="my-6 flex items-center gap-3 rounded-xl bg-white/5 p-4">
          <CreditCard className="size-6 text-slate-400" />
          <span className="font-mono text-sm tracking-widest text-slate-300">4242 4242 4242 4242</span>
        </div>
        <div className="grid gap-2">
          <Button loading={simulate.isPending && simulate.variables === 'success'} onClick={() => simulate.mutate('success')}>
            Simular pago correcto
          </Button>
          <Button variant="secondary" loading={simulate.isPending && simulate.variables === 'failure'} onClick={() => simulate.mutate('failure')}>
            Simular pago rechazado
          </Button>
          <Button variant="ghost" onClick={() => navigate('/premium')}>
            Volver
          </Button>
        </div>
        <ErrorText>{simulate.error && errorMessage(simulate.error)}</ErrorText>
      </Card>
    </div>
  );
}
