import { useMutation } from '@tanstack/react-query';
import { Flag } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { REPORT_REASONS } from '../lib/format';
import type { ReportReason } from '../lib/types';
import { Button, ErrorText, Field, Modal, Select, Textarea } from './ui';

type Target = { targetUserId: string } | { targetSessionId: string } | { targetMessageId: string } | { targetPostId: string };

export function ReportButton({ target, label = 'Reportar', compact }: { target: Target; label?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('HARASSMENT');
  const [details, setDetails] = useState('');
  const [done, setDone] = useState(false);

  const report = useMutation({
    mutationFn: () => api.post('/reports', { ...target, reason, details: details || undefined }),
    onSuccess: () => setDone(true),
  });

  const close = () => {
    setOpen(false);
    setDone(false);
    setDetails('');
    report.reset();
  };

  return (
    <>
      {compact ? (
        <button onClick={() => setOpen(true)} className="rounded-lg p-1 text-slate-500 hover:bg-white/8 hover:text-brand-red-soft" aria-label={label} title={label}>
          <Flag className="size-3.5" />
        </button>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Flag className="size-3.5" /> {label}
        </Button>
      )}
      <Modal open={open} onClose={close} title="Reportar">
        {done ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">Gracias. El equipo de moderación lo revisará y te avisaremos cuando esté resuelto.</p>
            <Button className="w-full" onClick={close}>
              Cerrar
            </Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              report.mutate();
            }}
          >
            <Field label="Motivo">
              <Select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)} options={REPORT_REASONS} />
            </Field>
            <Field label="Detalles (opcional)">
              <Textarea rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Cuéntanos qué ha pasado" />
            </Field>
            <ErrorText>{report.error && errorMessage(report.error)}</ErrorText>
            <Button type="submit" variant="danger" className="w-full" loading={report.isPending}>
              Enviar reporte
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}
