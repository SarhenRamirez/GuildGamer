import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Crown, Plus, Star, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth, useMe } from '../auth/AuthContext';
import { GameCover } from '../components/SessionCard';
import { Avatar, Badge, Button, Card, ErrorText, Field, Input, PageHeader, Select, Spinner, Textarea } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { AVAILABILITY, COMMUNICATION, LANGUAGES, PLATFORMS, SKILL_LEVELS } from '../lib/format';
import { useGames } from '../lib/queries';
import type { Availability, CommunicationPreference, Platform, Profile, SkillLevel, UploadedFile } from '../lib/types';

function GamesEditor({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const { data: games } = useGames();
  const [gameId, setGameId] = useState('');
  const [platform, setPlatform] = useState<Platform | ''>('');
  const [gamerTag, setGamerTag] = useState('');
  const [skill, setSkill] = useState<SkillLevel | ''>('');
  const [rank, setRank] = useState('');
  const [role, setRole] = useState('');
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['profile'] });
  const game = games?.find((g) => g.id === gameId);

  const add = useMutation({
    mutationFn: () => api.put('/users/me/games', { gameId, platform, gamerTag: gamerTag || undefined, skillLevel: skill || undefined, rank: rank || undefined, role: role || undefined }),
    onSuccess: () => {
      setGameId('');
      setPlatform('');
      setGamerTag('');
      setSkill('');
      setRank('');
      setRole('');
      refresh();
    },
  });
  const update = useMutation({
    mutationFn: (body: { gameId: string; platform: Platform; isFavorite: boolean }) => api.put('/users/me/games', body),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: ({ gameId, platform }: { gameId: string; platform: Platform }) => api.delete(`/users/me/games/${gameId}/${platform}`),
    onSuccess: refresh,
  });

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="mb-1 font-bold text-white">Juegos y plataformas</h2>
      <p className="mb-4 text-sm text-slate-400">Así te encuentran otros jugadores y te recomendamos sesiones.</p>
      {!!profile.games.length && (
        <ul className="mb-5 space-y-2">
          {profile.games.map((g) => (
            <li key={`${g.game.id}-${g.platform}`} className="flex items-center gap-3 rounded-xl bg-white/4 p-2.5">
              <GameCover game={g.game} className="size-10 shrink-0 rounded-lg text-xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{g.game.name}</p>
                <p className="truncate text-xs text-slate-400">
                  {PLATFORMS[g.platform]}
                  {g.rank && ` · ${g.rank}`}
                  {g.role && ` · ${g.role}`}
                  {g.gamerTag && ` · ${g.gamerTag}`}
                </p>
              </div>
              <button
                onClick={() => update.mutate({ gameId: g.game.id, platform: g.platform, isFavorite: !g.isFavorite })}
                className="rounded-lg p-1.5 hover:bg-white/8"
                aria-pressed={g.isFavorite}
                aria-label="Marcar como favorito"
              >
                <Star className={g.isFavorite ? 'size-4 fill-brand-gold-soft text-brand-gold-soft' : 'size-4 text-slate-500'} />
              </button>
              <button onClick={() => remove.mutate({ gameId: g.game.id, platform: g.platform })} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/8 hover:text-brand-red-soft" aria-label={`Quitar ${g.game.name}`}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <Select aria-label="Juego" required placeholder="Juego" value={gameId} onChange={(e) => { setGameId(e.target.value); setPlatform(''); }} options={(games ?? []).map((g) => [g.id, g.name] as [string, string])} />
        <Select aria-label="Plataforma" required disabled={!game} placeholder="Plataforma" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} options={(game?.platforms ?? []).map((p) => [p, PLATFORMS[p]] as [Platform, string])} />
        <Input aria-label="ID gamer" placeholder="ID gamer (opcional)" maxLength={50} value={gamerTag} onChange={(e) => setGamerTag(e.target.value)} />
        <Select aria-label="Nivel en este juego" placeholder="Nivel" value={skill} onChange={(e) => setSkill(e.target.value as SkillLevel)} options={SKILL_LEVELS} />
        <Input aria-label="Rango" placeholder="Rango (ej.: Diamante 1)" maxLength={40} value={rank} onChange={(e) => setRank(e.target.value)} />
        <Input aria-label="Rol" placeholder="Rol (ej.: Duelista / Jett)" maxLength={40} value={role} onChange={(e) => setRole(e.target.value)} />
        <Button type="submit" variant="soft" className="col-span-2 sm:col-span-3" loading={add.isPending}>
          <Plus className="size-4" /> Agregar juego
        </Button>
      </form>
      <ErrorText>{(add.error || update.error || remove.error) && errorMessage(add.error ?? update.error ?? remove.error)}</ErrorText>
    </Card>
  );
}

export function EditProfilePage() {
  const me = useMe();
  const { refresh } = useAuth();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);
  const { data: profile, isLoading } = useQuery({ queryKey: ['profile', me.id], queryFn: () => api.get<Profile>('/users/me') });

  const [form, setForm] = useState({
    username: me.username,
    bio: me.bio ?? '',
    avatarUrl: me.avatarUrl ?? '',
    bannerUrl: me.bannerUrl ?? '',
    accentColor: me.accentColor ?? '#a78bfa',
    skillLevel: me.skillLevel,
    availability: me.availability,
    communicationPreference: me.communicationPreference,
    languages: me.languages,
  });
  useEffect(() => {
    setSaved(false);
  }, [form]);

  const upload = useMutation({
    mutationFn: (file: File) => api.upload<UploadedFile>('/files', file),
    onSuccess: (f) => setForm((cur) => ({ ...cur, avatarUrl: f.url })),
  });

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/users/${me.id}`, {
        username: form.username,
        bio: form.bio,
        avatarUrl: form.avatarUrl || undefined,
        skillLevel: form.skillLevel,
        availability: form.availability,
        communicationPreference: form.communicationPreference,
        languages: form.languages,
        ...(me.isPremium ? { bannerUrl: form.bannerUrl || undefined, accentColor: form.accentColor } : {}),
      }),
    onSuccess: async () => {
      await refresh();
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setSaved(true);
    },
  });

  const toggleLang = (code: string) =>
    setForm((f) => ({ ...f, languages: f.languages.includes(code) ? f.languages.filter((l) => l !== code) : [...f.languages, code] }));

  if (isLoading || !profile) return <Spinner />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={params.get('welcome') ? '¡Bienvenido a GuildGamer!' : 'Editar perfil'}
        subtitle={params.get('welcome') ? 'Completa tu perfil gamer para que te encuentren y recibir recomendaciones.' : undefined}
        action={
          <Link to={`/users/${me.id}`}>
            <Button variant="ghost">Ver mi perfil</Button>
          </Link>
        }
      />

      <Card className="p-5 sm:p-6">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="flex items-center gap-4">
            <Avatar user={{ username: form.username || me.username, avatarUrl: form.avatarUrl || null }} size="xl" />
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])}
              />
              <Button type="button" variant="secondary" loading={upload.isPending} onClick={() => fileRef.current?.click()}>
                <Camera className="size-4" /> Cambiar avatar
              </Button>
              <p className="mt-1 text-xs text-slate-500">PNG, JPG, WEBP o GIF · máx. 5 MB</p>
              <ErrorText>{upload.error && errorMessage(upload.error)}</ErrorText>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre de usuario">
              <Input required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </Field>
            <Field label="Nivel general">
              <Select value={form.skillLevel} onChange={(e) => setForm({ ...form, skillLevel: e.target.value as SkillLevel })} options={SKILL_LEVELS} />
            </Field>
            <Field label="Disponibilidad">
              <Select value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value as Availability })} options={AVAILABILITY} />
            </Field>
            <Field label="Comunicación preferida">
              <Select value={form.communicationPreference} onChange={(e) => setForm({ ...form, communicationPreference: e.target.value as CommunicationPreference })} options={COMMUNICATION} />
            </Field>
          </div>

          <Field label="Biografía">
            <Textarea rows={3} maxLength={500} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Qué te gusta jugar, tus horarios, tu estilo…" />
          </Field>

          <fieldset>
            <legend className="label">Idiomas</legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(LANGUAGES).map(([code, name]) => {
                const on = form.languages.includes(code);
                return (
                  <button
                    type="button"
                    key={code}
                    aria-pressed={on}
                    onClick={() => toggleLang(code)}
                    className={on ? 'rounded-full bg-brand-green/15 px-3 py-1.5 text-sm text-brand-green ring-1 ring-brand-green/40' : 'rounded-full px-3 py-1.5 text-sm text-slate-400 ring-1 ring-white/10 hover:text-white'}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="rounded-xl border border-brand-gold/20 p-4">
            <legend className="flex items-center gap-2 px-1 text-sm font-semibold text-brand-gold-soft">
              <Crown className="size-4" /> Personalización Premium
            </legend>
            {me.isPremium ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
                <Field label="Imagen de portada (URL)">
                  <Input type="url" value={form.bannerUrl} onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })} placeholder="https://…" />
                </Field>
                <Field label="Color">
                  <input type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} className="h-11 w-20 cursor-pointer rounded-xl border border-white/10 bg-ink-850" />
                </Field>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                Portada y color de perfil propios con <Link to="/premium" className="text-brand-gold-soft hover:underline">Premium</Link>.
              </p>
            )}
          </fieldset>

          <ErrorText>{save.error && errorMessage(save.error)}</ErrorText>
          <div className="flex items-center justify-end gap-3">
            {saved && <Badge className="bg-brand-green/15 text-brand-green ring-brand-green/30">Guardado</Badge>}
            <Button type="submit" loading={save.isPending}>
              Guardar perfil
            </Button>
          </div>
        </form>
      </Card>

      <GamesEditor profile={profile} />
    </div>
  );
}
