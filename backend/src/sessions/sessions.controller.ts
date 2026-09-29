import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import {
  CreateSessionDto,
  SessionQueryDto,
  UpdateSessionDto,
} from './dto/session.dto.js';
import { SessionsService } from './sessions.service.js';

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post()
  create(@Body() dto: CreateSessionDto, @CurrentUser() user: AuthUser) {
    return this.sessions.create(dto, user);
  }

  @Get()
  findAll(@Query() query: SessionQueryDto) {
    return this.sessions.findAll(query);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.sessions.mine(user);
  }

  @Get('recommended')
  recommended(@CurrentUser() user: AuthUser) {
    return this.sessions.recommended(user);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sessions.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sessions.update(id, dto, user);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sessions.cancel(id, user);
  }
}
