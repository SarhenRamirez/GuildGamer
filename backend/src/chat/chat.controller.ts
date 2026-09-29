import { ApiTags } from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { ChatService, MAX_MESSAGE_LENGTH } from './chat.service.js';

class HistoryQueryDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  before?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}

class SendDirectDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, MAX_MESSAGE_LENGTH)
  content: string;
}

@ApiTags('chat')
@Controller()
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('sessions/:id/messages')
  history(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: HistoryQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.chat.history(id, user, query.before, query.limit);
  }

  @Get('messages/conversations')
  conversations(@CurrentUser() user: AuthUser) {
    return this.chat.conversations(user);
  }

  @Get('messages/direct/:userId')
  directHistory(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: HistoryQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.chat.directHistory(user, userId, query.before, query.limit);
  }

  @Post('messages/direct/:userId')
  sendDirect(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: SendDirectDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.chat.sendDirect(user, userId, dto.content);
  }

  @Post('messages/direct/:userId/read')
  @HttpCode(200)
  markRead(@Param('userId', ParseUUIDPipe) userId: string, @CurrentUser() user: AuthUser) {
    return this.chat.markDirectRead(user, userId);
  }
}
