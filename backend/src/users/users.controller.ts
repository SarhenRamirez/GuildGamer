import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { Platform } from '../generated/prisma/enums.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UpsertUserGameDto } from './dto/upsert-user-game.dto.js';
import { UserSearchDto } from './dto/user-search.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  search(@Query() query: UserSearchDto, @CurrentUser() user: AuthUser) {
    return this.users.search(query, user);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.getProfile(user.id, user);
  }

  @Get('me/stats')
  stats(@CurrentUser() user: AuthUser) {
    return this.users.advancedStats(user.id);
  }

  @Put('me/games')
  upsertGame(@CurrentUser() user: AuthUser, @Body() dto: UpsertUserGameDto) {
    return this.users.upsertGame(user.id, dto);
  }

  @Delete('me/games/:gameId/:platform')
  @HttpCode(204)
  removeGame(
    @CurrentUser() user: AuthUser,
    @Param('gameId', ParseUUIDPipe) gameId: string,
    @Param('platform', new ParseEnumPipe(Platform)) platform: Platform,
  ) {
    return this.users.removeGame(user.id, gameId, platform);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.getProfile(id, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.updateProfile(id, dto, user);
  }
}
