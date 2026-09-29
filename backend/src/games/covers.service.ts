import { Injectable, Logger, OnApplicationBootstrap, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';

const RAWG_API = 'https://api.rawg.io/api';

const RAWG_SLUGS: Record<string, string> = {
  'gta-v': 'grand-theft-auto-v',
  'ea-sports-fc': 'ea-sports-fc-24',
};

interface RawgGame {
  background_image: string | null;
}

@Injectable()
export class CoversService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CoversService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  get enabled() {
    return !!this.key;
  }

  private get key() {
    return this.config.get<string>('RAWG_API_KEY') ?? '';
  }

  onApplicationBootstrap() {
    if (!this.enabled || process.env.NODE_ENV === 'test') return;
    this.sync()
      .then(({ updated }) => updated && this.logger.log(`Portadas traídas de RAWG: ${updated}`))
      .catch((e: Error) => this.logger.warn(`No se pudieron traer portadas de RAWG: ${e.message}`));
  }

  async find(game: { name: string; slug: string }) {
    const direct = await this.request<RawgGame>(`/games/${RAWG_SLUGS[game.slug] ?? game.slug}`);
    if (direct?.background_image) return direct.background_image;
    const search = await this.request<{ results: RawgGame[] }>('/games', {
      search: game.name,
      search_precise: 'true',
      page_size: '1',
    });
    return search?.results[0]?.background_image ?? null;
  }

  async fill(game: { id: string; name: string; slug: string }) {
    if (!this.enabled) return null;
    const coverUrl = await this.find(game).catch(() => null);
    if (coverUrl) await this.prisma.game.update({ where: { id: game.id }, data: { coverUrl } });
    return coverUrl;
  }

  async sync(force = false) {
    if (!this.enabled) {
      throw new ServiceUnavailableException('Configura RAWG_API_KEY en el backend para traer las portadas');
    }
    const games = await this.prisma.game.findMany({
      where: force ? {} : { coverUrl: null },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
    const missing: string[] = [];
    let updated = 0;
    for (const game of games) {
      if (await this.fill(game)) updated++;
      else missing.push(game.name);
    }
    return { updated, missing };
  }

  private async request<T>(path: string, params: Record<string, string> = {}) {
    const url = `${RAWG_API}${path}?${new URLSearchParams({ key: this.key, ...params })}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`RAWG respondió ${res.status}`);
    return (await res.json()) as T;
  }
}
