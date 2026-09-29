import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Badge, Card, Empty, Input, PageHeader, PremiumBadge, Select, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { AVAILABILITY, COMMUNICATION, LANGUAGES, PLATFORMS, SKILL_LEVELS, languageName } from '../lib/format';
import { useGames } from '../lib/queries';
import type { Page, PublicUser } from '../lib/types';

export function PlayersPage() {
  const { data: games } = useGames();
  const [f, setF] = useState<Record<string, string>>({});
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const { data, isLoading } = useQuery({
    queryKey: ['players', f],
    queryFn: () => api.get<Page<PublicUser>>('/users', { ...f, limit: 30 }),
  });

  return (
    <>
      <PageHeader title="Jugadores" subtitle="Encuentra gente con tus juegos, tu nivel y tu idioma." />
      <Card className="mb-6 grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input placeholder="Nombre de usuario…" value={f.search ?? ''} onChange={set('search')} aria-label="Buscar por nombre" className="lg:col-span-2" />
        <Select aria-label="Juego" placeholder="Cualquier juego" value={f.gameId ?? ''} onChange={set('gameId')} options={(games ?? []).map((g) => [g.id, g.name] as [string, string])} />
        <Select aria-label="Plataforma" placeholder="Cualquier plataforma" value={f.platform ?? ''} onChange={set('platform')} options={PLATFORMS} />
        <Select aria-label="Nivel" placeholder="Cualquier nivel" value={f.skillLevel ?? ''} onChange={set('skillLevel')} options={SKILL_LEVELS} />
        <Select aria-label="Idioma" placeholder="Cualquier idioma" value={f.language ?? ''} onChange={set('language')} options={LANGUAGES} />
        <Select aria-label="Disponibilidad" placeholder="Cualquier disponibilidad" value={f.availability ?? ''} onChange={set('availability')} options={AVAILABILITY} />
        <Select aria-label="Comunicación" placeholder="Texto o voz" value={f.communicationPreference ?? ''} onChange={set('communicationPreference')} options={COMMUNICATION} />
      </Card>

      {isLoading ? (
        <Spinner />
      ) : !data?.items.length ? (
        <Card>
          <Empty icon={<Users className="size-10" />} title="Nadie coincide con esa búsqueda">
            Prueba con menos filtros.
          </Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((u) => (
            <Link
              key={u.id}
              to={`/users/${u.id}`}
              className="card flex gap-3 p-4 transition hover:border-brand-blue/40"
              style={u.isPremium && u.accentColor ? { borderColor: `${u.accentColor}66` } : undefined}
            >
              <Avatar user={u} size="md" availability={u.availability} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-white">{u.username}</p>
                  {u.isPremium && <PremiumBadge />}
                </div>
                <p className="text-xs text-slate-400">
                  {SKILL_LEVELS[u.skillLevel]} · {COMMUNICATION[u.communicationPreference]}
                </p>
                {!!u.languages.length && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {u.languages.map((l) => (
                      <Badge key={l}>{languageName(l)}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
