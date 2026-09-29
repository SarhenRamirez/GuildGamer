import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Length } from 'class-validator';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { VoiceGateway } from './voice.gateway.js';
import { VoiceService } from './voice.service.js';

class CreateRoomDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, 50)
  name: string;
}

@ApiTags('voice')
@Controller('voice')
export class VoiceController {
  constructor(
    private readonly voice: VoiceService,
    private readonly gateway: VoiceGateway,
  ) {}

  @Get('ice-servers')
  iceServers() {
    return this.voice.iceServers();
  }

  @Get('rooms')
  async rooms(@CurrentUser() user: AuthUser) {
    const rooms = await this.voice.listRooms(user);
    return rooms.map((r) => ({ ...r, participants: this.gateway.participants({ roomId: r.id }) }));
  }

  @Post('rooms')
  createRoom(@Body() dto: CreateRoomDto, @CurrentUser() user: AuthUser) {
    return this.voice.createRoom(user, dto.name);
  }

  @Delete('rooms/:id')
  @HttpCode(204)
  deleteRoom(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.voice.deleteRoom(user, id);
  }

  @Get('sessions/:id/participants')
  async sessionParticipants(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.voice.authorize({ sessionId: id }, user);
    return this.gateway.participants({ sessionId: id });
  }
}
