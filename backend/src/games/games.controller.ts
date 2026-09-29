import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Public, Roles } from '../auth/decorators.js';
import { Role } from '../generated/prisma/enums.js';
import { CreateGameDto, GameQueryDto, UpdateGameDto } from './dto/game.dto.js';
import { CoversService } from './covers.service.js';
import { GamesService } from './games.service.js';

@ApiTags('games')
@Controller('games')
export class GamesController {
  constructor(
    private readonly games: GamesService,
    private readonly covers: CoversService,
  ) {}

  @Public()
  @Get()
  findAll(@Query() query: GameQueryDto) {
    return this.games.findAll(query);
  }

  @Public()
  @Get('popular')
  popular() {
    return this.games.popular(12);
  }

  @Roles(Role.ADMIN)
  @Post('covers/sync')
  @HttpCode(200)
  syncCovers(@Query('force') force?: string) {
    return this.covers.sync(force === 'true');
  }

  @Public()
  @Get(':idOrSlug')
  findOne(@Param('idOrSlug') idOrSlug: string) {
    return this.games.findOne(idOrSlug);
  }

  @Roles(Role.ADMIN)
  @Post()
  async create(@Body() dto: CreateGameDto) {
    const game = await this.games.create(dto);
    if (game.coverUrl) return game;
    const coverUrl = await this.covers.fill(game);
    return coverUrl ? { ...game, coverUrl } : game;
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGameDto) {
    return this.games.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.games.remove(id);
  }
}
