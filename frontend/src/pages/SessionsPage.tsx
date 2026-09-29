import { useQuery } from '@tanstack/react-query';
import { Gamepad2, Plus, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SessionCard } from '../components/SessionCard';
import { Button, Empty, Input, PageHeader, Select, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { LANGUAGES, PLATFORMS, SKILL_LEVELS } from '../lib/format';
import { useGames } from '../lib/queries';
import type { Page, SessionSummary } from '../lib/types';

const WHEN: Record<string, string> = { now: 'Próxima hora', today: 'Hoy', week: 'Esta semana' };

function whenRange(when: string) {
  const now = new Date();
  if (when === 'now') return new Date(now.getTime() + 3600_000).toISOString();
  if (when === 'today') {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return end.toISOString();
  }
  if (when === 'week') return new Date(now.getTime() + 7 * 24 * 3600_000).toISOString();
  return undefined;
}

export function SessionsPage() {
  const { data: games } = useGames();
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const filters = Object.fromEntries(params);
  const page = Number(filters.page ?? 1);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next, { replace: true });
  };

  const setPage = (n: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(n));
    setParams(next);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['sessions', filters],
    queryFn: () =>
      api.get<Page<SessionSummary>>('/sessions', {
        gameId: filters.gameId,
        platform: filters.platform,
        skillLevel: filters.skillLevel,
        language: filters.language,
        micRequired: filters.mic,
        kind: filters.kind,
        search: filters.search,
        to: filters.when ? whenRange(filters.when) : undefined,
        page,
        limit: 12,
      }),
  });

  const pages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <>
      <PageHeader
        title="Sesiones"
        subtitle="Partidas abiertas que empiezan pronto. Únete o crea la tuya."
        action={
          <Link to="/sessions/new">
            <Button>
              <Plus className="size-4" /> Crear sesión
            </Button>
          </Link>
        }
      />

      <div className="card mb-6 p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Buscar por título…"
            defaultValue={filters.search ?? ''}
            onChange={(e) => setFilter('search', e.target.value)}
            aria-label="Buscar sesiones"
          />
          <Button variant="secondary" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters} className="lg:hidden">
            <SlidersHorizontal className="size-4" />
          </Button>
        </div>
        <div className={`${showFilters ? 'grid' : 'hidden'} mt-3 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid lg:grid-cols-7`}>
          <Select
            aria-label="Juego"
            placeholder="Todos los juegos"
            value={filters.gameId ?? ''}
            onChange={(e) => setFilter('gameId', e.target.value)}
            options={(games ?? []).map((g) => [g.id, g.name] as [string, string])}
          />
          <Select aria-label="Plataforma" placeholder="Plataforma" value={filters.platform ?? ''} onChange={(e) => setFilter('platform', e.target.value)} options={PLATFORMS} />
          <Select aria-label="Nivel" placeholder="Nivel" value={filters.skillLevel ?? ''} onChange={(e) => setFilter('skillLevel', e.target.value)} options={SKILL_LEVELS} />
          <Select aria-label="Idioma" placeholder="Idioma" value={filters.language ?? ''} onChange={(e) => setFilter('language', e.target.value)} options={LANGUAGES} />
          <Select aria-label="Cuándo" placeholder="Cuándo" value={filters.when ?? ''} onChange={(e) => setFilter('when', e.target.value)} options={WHEN} />
          <Select aria-label="Micrófono" placeholder="Micrófono" value={filters.mic ?? ''} onChange={(e) => setFilter('mic', e.target.value)} options={{ true: 'Con micro', false: 'Sin micro' }} />
          <Select aria-label="Tipo" placeholder="Tipo" value={filters.kind ?? ''} onChange={(e) => setFilter('kind', e.target.value)} options={{ CASUAL: 'Casual', TOURNAMENT: 'Torneo' }} />
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !data?.items.length ? (
        <div className="card">
          <Empty icon={<Gamepad2 className="size-10" />} title="No hay sesiones con esos filtros">
            Prueba a quitar algún filtro o{' '}
            <Link to="/sessions/new" className="text-brand-green hover:underline">
              crea la tuya
            </Link>
            .
          </Empty>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-400">{data.total} sesiones</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
          {pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Anterior
              </Button>
              <span className="text-sm text-slate-400">
                {page} / {pages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              >
                Siguiente
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
