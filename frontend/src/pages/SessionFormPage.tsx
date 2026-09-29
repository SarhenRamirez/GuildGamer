import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMe } from '../auth/AuthContext';
import { Button, Card, ErrorText, Field, Input, PageHeader, Select, Spinner, Textarea } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { JOIN_MODES, LANGUAGES, PLATFORMS, SKILL_LEVELS, toLocalInput } from '../lib/format';
import { useGames } from '../lib/queries';
import type { JoinMode, Platform, SessionDetail, SessionKind, SkillLevel } from '../lib/types';

interface FormState {
  title: string;
  description: string;
  gameId: string;
  platform: Platform | '';
  kind: SessionKind;
  mode: string;
  maxPlayers: number;
  skillLevel: SkillLevel;
  language: string;
  micRequired: boolean;
  joinMode: JoinMode;
  startsAt: string;
  endsAt: string;
  joinInfo: string;
}

const inOneHour = () => {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return toLocalInput(d);
};

export function SessionFormPage() {
  const { id } = useParams();
  const editing = !!id;
  const me = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: games } = useGames();
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    gameId: '',
    platform: '',
    kind: 'CASUAL',
    mode: '',
    maxPlayers: 4,
    skillLevel: 'INTERMEDIATE',
    language: 'es',
    micRequired: false,
    joinMode: 'MANUAL',
    startsAt: inOneHour(),
    endsAt: '',
    joinInfo: '',
  });

  const existing = useQuery({
    queryKey: ['session', id],
    queryFn: () => api.get<SessionDetail>(`/sessions/${id}`),
    enabled: editing,
  });

  useEffect(() => {
    const s = existing.data;
    if (!s) return;
    setForm({
      title: s.title,
      description: s.description ?? '',
      gameId: s.game.id,
      platform: s.platform,
      kind: s.kind,
      mode: s.mode ?? '',
      maxPlayers: s.maxPlayers,
      skillLevel: s.skillLevel,
      language: s.language ?? '',
      micRequired: s.micRequired,
      joinMode: s.joinMode,
      startsAt: toLocalInput(new Date(s.startsAt)),
      endsAt: s.endsAt ? toLocalInput(new Date(s.endsAt)) : '',
      joinInfo: s.joinInfo ?? '',
    });
  }, [existing.data]);

  const game = games?.find((g) => g.id === form.gameId);
  const maxAllowed = form.kind === 'TOURNAMENT' ? 100 : 16;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      const common = {
        title: form.title,
        description: form.description || undefined,
        mode: form.mode || undefined,
        maxPlayers: form.maxPlayers,
        skillLevel: form.skillLevel,
        language: form.language || undefined,
        micRequired: form.micRequired,
        joinMode: form.joinMode,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
        joinInfo: form.joinInfo || undefined,
      };
      if (editing && existing.data) {
        const s = existing.data;
        if (form.startsAt === toLocalInput(new Date(s.startsAt))) delete (common as Partial<typeof common>).startsAt;
        if (s.endsAt && form.endsAt === toLocalInput(new Date(s.endsAt))) delete (common as Partial<typeof common>).endsAt;
      }
      return editing
        ? api.patch<SessionDetail>(`/sessions/${id}`, common)
        : api.post<SessionDetail>('/sessions', { ...common, gameId: form.gameId, platform: form.platform, kind: form.kind });
    },
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.setQueryData(['session', s.id], s);
      navigate(`/sessions/${s.id}`);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    save.mutate();
  };

  if (editing && existing.isLoading) return <Spinner />;
  if (editing && existing.data && !existing.data.isCreator && me.role !== 'ADMIN') {
    return <ErrorText>Solo el creador puede editar esta sesión.</ErrorText>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={editing ? 'Editar sesión' : 'Crear sesión'} subtitle="Cuenta qué vas a jugar, cuándo y a quién buscas." />
      <Card className="p-5 sm:p-6">
        <form onSubmit={submit} className="space-y-5">
          <Field label="Título">
            <Input required minLength={3} maxLength={100} placeholder="Ej.: Fortnite a las 8, buscamos squad" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Juego">
              <Select
                required
                disabled={editing}
                placeholder="Elige un juego"
                value={form.gameId}
                onChange={(e) => setForm((f) => ({ ...f, gameId: e.target.value, platform: '' }))}
                options={(games ?? []).map((g) => [g.id, g.name] as [string, string])}
              />
            </Field>
            <Field label="Plataforma">
              <Select
                required
                disabled={editing || !game}
                placeholder={game ? 'Elige plataforma' : 'Primero elige juego'}
                value={form.platform}
                onChange={(e) => set('platform', e.target.value as Platform)}
                options={(game?.platforms ?? []).map((p) => [p, PLATFORMS[p]] as [Platform, string])}
              />
            </Field>
          </div>

          {!editing && (
            <fieldset>
              <legend className="label">Tipo</legend>
              <div className="grid grid-cols-2 gap-2">
                {(['CASUAL', 'TOURNAMENT'] as const).map((k) => {
                  const locked = k === 'TOURNAMENT' && !me.isPremium;
                  return (
                    <label
                      key={k}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm ring-1 ${
                        form.kind === k ? 'bg-brand-blue/15 text-white ring-brand-blue/50' : 'bg-ink-850 text-slate-300 ring-white/10'
                      } ${locked ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <input
                        type="radio"
                        name="kind"
                        className="sr-only"
                        disabled={locked}
                        checked={form.kind === k}
                        onChange={() => setForm((f) => ({ ...f, kind: k, maxPlayers: Math.min(f.maxPlayers, k === 'CASUAL' ? 16 : 100) }))}
                      />
                      {k === 'CASUAL' ? 'Sesión normal (hasta 16)' : 'Torneo (hasta 100)'}
                      {k === 'TOURNAMENT' && <Crown className="ml-auto size-4 text-brand-gold-soft" />}
                    </label>
                  );
                })}
              </div>
              {!me.isPremium && (
                <p className="mt-1.5 text-xs text-slate-500">
                  Los torneos son <Link to="/premium" className="text-brand-gold-soft hover:underline">Premium</Link>.
                </p>
              )}
            </fieldset>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Jugadores (contándote)">
              <Input type="number" required min={2} max={maxAllowed} value={form.maxPlayers} onChange={(e) => set('maxPlayers', Number(e.target.value))} />
            </Field>
            <Field label="Nivel">
              <Select value={form.skillLevel} onChange={(e) => set('skillLevel', e.target.value as SkillLevel)} options={SKILL_LEVELS} />
            </Field>
            <Field label="Idioma">
              <Select placeholder="Cualquiera" value={form.language} onChange={(e) => set('language', e.target.value)} options={LANGUAGES} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Empieza">
              <Input type="datetime-local" required value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
            </Field>
            <Field label="Termina (opcional)" hint="Si no lo indicas, se da por terminada 3 h después">
              <Input type="datetime-local" value={form.endsAt} min={form.startsAt} onChange={(e) => set('endsAt', e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Modalidad (opcional)">
              <Input maxLength={50} placeholder="Duo, Squad, Ranked…" value={form.mode} onChange={(e) => set('mode', e.target.value)} />
            </Field>
            <Field label="Quién puede entrar">
              <Select value={form.joinMode} onChange={(e) => set('joinMode', e.target.value as JoinMode)} options={JOIN_MODES} />
            </Field>
          </div>

          <label className="flex items-center gap-3 text-sm text-slate-300">
            <input type="checkbox" className="size-4 accent-brand-green" checked={form.micRequired} onChange={(e) => set('micRequired', e.target.checked)} />
            Se necesita micrófono
          </label>

          <Field label="Descripción (opcional)">
            <Textarea rows={3} maxLength={1000} placeholder="Qué buscas, reglas del grupo…" value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>

          <Field label="Datos para entrar (opcional)" hint="Código de sala, enlace de invitación o tu ID gamer. Solo lo verán los miembros aceptados.">
            <Input maxLength={500} placeholder="Ej.: Código de sala ABC123" value={form.joinInfo} onChange={(e) => set('joinInfo', e.target.value)} />
          </Field>

          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending}>
              {editing ? 'Guardar cambios' : 'Publicar sesión'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
