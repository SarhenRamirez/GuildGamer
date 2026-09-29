import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { slugify } from '../common/slugify.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateGameDto, GameQueryDto, UpdateGameDto } from './dto/game.dto.js';

@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: GameQueryDto) {
    return this.prisma.game.findMany({
      where: {
        name: query.search
          ? { contains: query.search, mode: 'insensitive' }
          : undefined,
        genre: query.genre
          ? { equals: query.genre, mode: 'insensitive' }
          : undefined,
        platforms: query.platform ? { has: query.platform } : undefined,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(idOrSlug: string) {
    const game = await this.prisma.game.findUnique({
      where: isUUID(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug },
      include: {
        _count: {
          select: {
            players: true,
            sessions: { where: { status: 'OPEN', startsAt: { gte: new Date() } } },
          },
        },
      },
    });
    if (!game) throw new NotFoundException('Juego no encontrado');
    const { _count, ...rest } = game;
    return { ...rest, playersCount: _count.players, openSessions: _count.sessions };
  }

  async create(dto: CreateGameDto) {
    const slug = slugify(dto.name);
    await this.assertNameFree(dto.name, slug);
    return this.prisma.game.create({ data: { ...dto, slug } });
  }

  async update(id: string, dto: UpdateGameDto) {
    await this.findOne(id);
    const slug = dto.name ? slugify(dto.name) : undefined;
    if (dto.name && slug) await this.assertNameFree(dto.name, slug, id);
    return this.prisma.game.update({ where: { id }, data: { ...dto, slug } });
  }

  async remove(id: string) {
    await this.findOne(id);
    const sessions = await this.prisma.gameSession.count({ where: { gameId: id } });
    if (sessions) {
      throw new ConflictException(
        'No se puede borrar un juego que ya tiene sesiones',
      );
    }
    await this.prisma.game.delete({ where: { id } });
  }

  private async assertNameFree(name: string, slug: string, exceptId?: string) {
    const clash = await this.prisma.game.findFirst({
      where: {
        OR: [{ name: { equals: name, mode: 'insensitive' } }, { slug }],
        NOT: exceptId ? { id: exceptId } : undefined,
      },
      select: { id: true },
    });
    if (clash) throw new ConflictException('Ya existe un juego con ese nombre');
  }
}
